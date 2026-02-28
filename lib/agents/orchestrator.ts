// lib/agents/orchestrator.ts
/**
 * ORCHESTRATOR CENTRAL - Anclora Advisor AI
 * Primary LLM: Ollama local (qwen2.5:14b)
 * Fallback LLM: Ollama local (llama3.1:8b)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { retrieveContext, RAGChunk } from '../../src/lib/rag/retrieval';
import { runDeterministicFiscalTool } from '../../src/lib/tools/deterministic-fiscal-tools';
import { GROUNDED_CHAT_PROMPT, NO_EVIDENCE_FALLBACK_PROMPT, RESPONSE_GUARD_PROMPT } from './prompts';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export type SpecialistType = 'fiscal' | 'labor' | 'market';

/** Internal DB category used for retrieval (must match rag_documents.category) */
type DbCategory = 'fiscal' | 'laboral' | 'mercado';

const SPECIALIST_TO_DB: Record<SpecialistType, DbCategory> = {
  fiscal: 'fiscal',
  labor:  'laboral',
  market: 'mercado',
};

export interface RoutingResult {
  primarySpecialist: SpecialistType;
  secondarySpecialists: SpecialistType[];
  confidence: number;
  reasoning: string;
}

export interface CitationRef {
  index: number;
  title: string;
  source_url: string;
  similarity: number;
  chunk_id: string;
}

export interface SpecialistContext {
  chunks: Array<{ id: string; content: string; source: string; confidence: number }>;
  totalConfidence: number;
  warnings: string[];
}

export interface OrchestratorResponse {
  success: boolean;
  routing: RoutingResult;
  primarySpecialistResponse: string;
  secondarySpecialistResponses?: Record<string, string>;
  contexts: SpecialistContext[];
  recommendations: string[];
  alerts: Array<{ type: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; message: string }>;
  citations: CitationRef[];
  groundingConfidence: 'high' | 'medium' | 'low' | 'none';
  performance: {
    routing_ms: number;
    retrieval_ms: number;
    prompt_build_ms: number;
    llm_ms: number;
    llm_primary_ms: number;
    llm_fallback_ms: number;
    persistence_ms: number;
    verifier_ms: number;
    total_ms: number;
    llm_model_used: string;
    llm_path: 'primary' | 'fast_simple' | 'fast_no_evidence' | 'fallback' | 'local_no_evidence' | 'local_tool';
    used_fallback_model: boolean;
    retrieval_cache_hit: boolean;
    response_cache_hit: boolean;
    guard_triggered: boolean;
    tool_used: string | null;
  };
}

interface GuardResult {
  supported: boolean;
  issue: string;
  revised_answer: string;
}

function stripSourcesSection(text: string): string {
  return text.replace(/\n## Fuentes consultadas[\s\S]*$/i, '').trim();
}

function hasInlineCitation(text: string): boolean {
  return /\[\d+\]/.test(text);
}

function hasSourcesSection(text: string): boolean {
  return /## Fuentes consultadas/i.test(text);
}

function appendInlineCitation(text: string, citationIndex: number): string {
  const cleaned = text.trim();
  if (!cleaned) return `[${citationIndex}]`;

  const sentenceMatch = cleaned.match(/^([\s\S]*?[.!?])(\s|$)/);
  if (sentenceMatch && sentenceMatch[1]) {
    const sentence = sentenceMatch[1];
    return cleaned.replace(sentence, `${sentence} [${citationIndex}]`);
  }

  return `${cleaned} [${citationIndex}]`;
}

function buildSourcesSection(citations: CitationRef[]): string {
  const lines = citations.map(
    (citation) => `[${citation.index}] ${citation.title} (Confianza: ${Math.round(citation.similarity * 100)}%)`
  );
  return `## Fuentes consultadas\n${lines.join('\n')}`;
}

function ensureCitationsInResponse(text: string, citations: CitationRef[]): string {
  if (citations.length === 0) {
    return stripSourcesSection(text);
  }

  let output = stripSourcesSection(text);
  if (!hasInlineCitation(output)) {
    output = appendInlineCitation(output, citations[0].index);
  }

  if (!hasSourcesSection(output)) {
    output = `${output}\n\n${buildSourcesSection(citations)}`.trim();
  }

  return output;
}

// ----------------------------------------------------------------
// Keyword routing
// ----------------------------------------------------------------
const FISCAL_KEYWORDS  = ['iva', 'irpf', 'reta', 'hacienda', 'fiscal', 'tributar', 'impuesto', 'cuota', 'deducir', 'deducción', 'autónomo', 'factura', 'modelo 303', 'modelo 130', 'rendimiento'];
const LABOR_KEYWORDS   = ['despido', 'laboral', 'pluriactividad', 'contrato', 'salario', 'convenio', 'trabajador', 'seguridad social', 'baja', 'nómina', 'preavis', 'indemnización'];
const MARKET_KEYWORDS  = ['mercado', 'mallorca', 'alquiler', 'vivienda', 'inmobiliario', 'venta', 'compra', 'propiedad', 'arrendamiento', 'plusvalía'];

function detectSpecialist(query: string): {
  primary: SpecialistType;
  secondary: SpecialistType[];
  reasoning: string;
  topScore: number;
} {
  const q = query.toLowerCase();
  const scores: Record<SpecialistType, number> = { fiscal: 0, labor: 0, market: 0 };

  for (const kw of FISCAL_KEYWORDS)  if (q.includes(kw)) scores.fiscal++;
  for (const kw of LABOR_KEYWORDS)   if (q.includes(kw)) scores.labor++;
  for (const kw of MARKET_KEYWORDS)  if (q.includes(kw)) scores.market++;

  const entries = Object.entries(scores) as [SpecialistType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const primary    = entries[0][1] > 0 ? entries[0][0] : 'fiscal'; // default
  const secondary  = entries.slice(1).filter(([, s]) => s > 0).map(([t]) => t);
  const topScore   = entries[0][1];
  const reasoning  = topScore > 0
    ? `Se detectaron ${topScore} término(s) de la categoría '${primary}'.`
    : "Consulta general: categoría fiscal asignada por defecto.";

  return { primary, secondary, reasoning, topScore };
}

// ----------------------------------------------------------------
// Context text builder
// ----------------------------------------------------------------
function buildContextText(chunks: RAGChunk[]): string {
  if (chunks.length === 0) return '';
  return chunks
    .map((c, i) =>
      `[${i + 1}] ${c.metadata.title} (confianza: ${Math.round(c.similarity * 100)}%)\n${c.content}`
    )
    .join('\n\n');
}

interface RetrievalAttempt {
  category?: DbCategory;
  threshold: number;
  limit: number;
}

interface RetrievalCascadeResult {
  chunks: RAGChunk[];
  cacheHit: boolean;
}

async function retrieveWithCascade(
  query: string,
  primaryCategory: DbCategory,
  allowGlobalFallback: boolean,
  noDomainSignal: boolean
): Promise<RetrievalCascadeResult> {
  const attempts: RetrievalAttempt[] = noDomainSignal
    ? [{ category: primaryCategory, threshold: 0.35, limit: 3 }]
    : [
        { category: primaryCategory, threshold: 0.35, limit: 3 },
        { category: primaryCategory, threshold: 0.25, limit: 3 },
      ];

  if (allowGlobalFallback) {
    attempts.push(
      { threshold: 0.30, limit: 3 },
      { threshold: 0.20, limit: 3 }
    );
  }

  for (const attempt of attempts) {
    const retrieval = await retrieveContext(query, {
      category: attempt.category,
      threshold: attempt.threshold,
      limit: attempt.limit,
    });

    if (retrieval.chunks.length > 0) {
      return { chunks: retrieval.chunks, cacheHit: retrieval.cacheHit };
    }
  }

  return { chunks: [], cacheHit: false };
}

// ----------------------------------------------------------------
// Orchestrator
// ----------------------------------------------------------------
export class Orchestrator {
  private supabase: SupabaseClient;
  private ollamaBaseUrl: string;
  private primaryModel: string;
  private fallbackModel: string;
  private fastModel: string;
  private noEvidenceFastModel: string;
  private guardModel: string;
  private fastPathEnabled: boolean;
  private localNoEvidenceEnabled: boolean;
  private guardEnabled: boolean;
  private contextMaxChunks: number;
  private contextChunkMaxChars: number;
  private responseCacheTtlMs: number;
  private responseCacheMaxEntries: number;
  private responseCache: Map<string, { value: OrchestratorResponse; expiresAt: number }>;

  constructor() {
    this.supabase  = createClient(
      process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder'
    );
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.primaryModel = process.env.OLLAMA_MODEL_PRIMARY ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:14b';
    this.fallbackModel = process.env.OLLAMA_MODEL_FALLBACK ?? 'llama3.1:8b';
    this.fastModel = process.env.OLLAMA_MODEL_FAST ?? 'llama3.2:latest';
    this.noEvidenceFastModel = process.env.OLLAMA_MODEL_NO_EVIDENCE ?? 'gemma3:1b';
    this.guardModel = process.env.OLLAMA_MODEL_GUARD ?? this.fastModel;
    this.fastPathEnabled = process.env.ORCHESTRATOR_FASTPATH_ENABLED !== 'false';
    this.localNoEvidenceEnabled = process.env.ORCHESTRATOR_LOCAL_NO_EVIDENCE !== 'false';
    this.guardEnabled = process.env.ORCHESTRATOR_GUARD_ENABLED !== 'false';
    this.contextMaxChunks = Number.parseInt(process.env.ORCHESTRATOR_CONTEXT_MAX_CHUNKS ?? '3', 10);
    this.contextChunkMaxChars = Number.parseInt(process.env.ORCHESTRATOR_CONTEXT_CHUNK_MAX_CHARS ?? '1200', 10);
    this.responseCacheTtlMs = Number.parseInt(process.env.ORCHESTRATOR_RESPONSE_CACHE_TTL_MS ?? '180000', 10);
    this.responseCacheMaxEntries = Number.parseInt(process.env.ORCHESTRATOR_RESPONSE_CACHE_MAX_ENTRIES ?? '128', 10);
    this.responseCache = new Map();
  }

  private getResponseCacheKey(query: string): string {
    return query.trim().toLowerCase();
  }

  private getCachedResponse(cacheKey: string): OrchestratorResponse | null {
    const entry = this.responseCache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return {
      ...entry.value,
      performance: { ...entry.value.performance },
    };
  }

  private setCachedResponse(cacheKey: string, value: OrchestratorResponse): void {
    if (this.responseCache.size >= this.responseCacheMaxEntries) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) this.responseCache.delete(oldestKey);
    }
    this.responseCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.responseCacheTtlMs,
    });
  }

  private trimContextForPrompt(chunks: RAGChunk[]): RAGChunk[] {
    const maxChunks = Number.isFinite(this.contextMaxChunks) && this.contextMaxChunks > 0 ? this.contextMaxChunks : 3;
    const maxChars = Number.isFinite(this.contextChunkMaxChars) && this.contextChunkMaxChars > 0 ? this.contextChunkMaxChars : 1200;

    return chunks.slice(0, maxChunks).map((chunk) => ({
      ...chunk,
      content: chunk.content.length > maxChars ? `${chunk.content.slice(0, maxChars)}...` : chunk.content,
    }));
  }

  private shouldUseFastModel(
    hasEvidence: boolean,
    topScore: number,
    query: string,
    chunks: RAGChunk[]
  ): boolean {
    if (!this.fastPathEnabled) return false;
    if (!hasEvidence) return true;
    const normalizedQuery = query.trim().toLowerCase();
    const tokenApprox = normalizedQuery.split(/\s+/).filter(Boolean).length;
    const topSimilarity = chunks[0]?.similarity ?? 0;
    const isFaqStyle =
      /^(que|qué|cuando|cuándo|como|cómo|cual|cuál|puedo|se puede|me corresponde|tengo derecho)/.test(normalizedQuery) ||
      normalizedQuery.includes('qué es') ||
      normalizedQuery.includes('que es');
    const contextChars = chunks.reduce((acc, chunk) => acc + chunk.content.length, 0);

    if (isFaqStyle && tokenApprox <= 18 && chunks.length <= 3 && contextChars <= 2600) {
      return true;
    }

    return topScore <= 2 && tokenApprox <= 12 && chunks.length <= 3 && topSimilarity < 0.45;
  }

  private selectModel(hasEvidence: boolean, topScore: number, query: string, chunks: RAGChunk[]): {
    model: string;
    path: OrchestratorResponse['performance']['llm_path'];
  } {
    if (!this.fastPathEnabled) {
      return { model: this.primaryModel, path: 'primary' };
    }

    if (!hasEvidence) {
      return { model: this.noEvidenceFastModel, path: 'fast_no_evidence' };
    }

    if (this.shouldUseFastModel(hasEvidence, topScore, query, chunks)) {
      return { model: this.fastModel, path: 'fast_simple' };
    }

    return { model: this.primaryModel, path: 'primary' };
  }

  private buildNoEvidenceResponse(): string {
    return 'No tengo evidencia suficiente en mi base de conocimientos especializada para responder esta consulta. Te recomiendo verificar la información en una fuente fiable o consultarlo con un asesor cualificado.';
  }

  private parseGuardResult(raw: string): GuardResult | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<GuardResult>;
      if (typeof parsed.supported !== 'boolean') return null;
      return {
        supported: parsed.supported,
        issue: typeof parsed.issue === 'string' ? parsed.issue : 'unknown',
        revised_answer: typeof parsed.revised_answer === 'string' ? parsed.revised_answer : '',
      };
    } catch {
      return null;
    }
  }

  private async verifyGroundedResponse(contextText: string, query: string, answer: string): Promise<GuardResult | null> {
    const prompt = RESPONSE_GUARD_PROMPT
      .replace('{context}', contextText)
      .replace('{query}', query)
      .replace('{answer}', answer);

    const raw = await this.generateWithOllama(this.guardModel, prompt, query);
    return this.parseGuardResult(raw);
  }

  private async generateWithOllama(model: string, systemPrompt: string, query: string): Promise<string> {
    const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 0.1,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama ${model} error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim() ?? '';
    if (!text) {
      throw new Error(`Ollama ${model} returned empty response`);
    }
    return text;
  }

  async processQuery(
    userId: string,
    conversationId: string,
    query: string
  ): Promise<OrchestratorResponse> {
    const tTotalStart = Date.now();
    let llmModelUsed = this.primaryModel;
    let usedFallbackModel = false;
    let llmPath: OrchestratorResponse['performance']['llm_path'] = 'primary';
    let llmPrimaryMs = 0;
    let llmFallbackMs = 0;
    let verifierMs = 0;
    let guardTriggered = false;
    let toolUsed: string | null = null;
    const responseCacheKey = this.getResponseCacheKey(query);
    const cachedResponse = this.getCachedResponse(responseCacheKey);
    if (cachedResponse) {
      const totalMs = Date.now() - tTotalStart;
      cachedResponse.performance.routing_ms = 0;
      cachedResponse.performance.retrieval_ms = 0;
      cachedResponse.performance.prompt_build_ms = 0;
      cachedResponse.performance.llm_ms = 0;
      cachedResponse.performance.llm_primary_ms = 0;
      cachedResponse.performance.llm_fallback_ms = 0;
      cachedResponse.performance.persistence_ms = 0;
      cachedResponse.performance.verifier_ms = 0;
      cachedResponse.performance.total_ms = totalMs;
      cachedResponse.performance.response_cache_hit = true;
      return cachedResponse;
    }

    // 1. Routing
    const tRoutingStart = Date.now();
    const deterministicTool = runDeterministicFiscalTool(query);
    if (deterministicTool) {
      const totalMs = Date.now() - tTotalStart;
      const response: OrchestratorResponse = {
        success: true,
        routing: {
          primarySpecialist: 'fiscal',
          secondarySpecialists: [],
          confidence: 0.99,
          reasoning: `Consulta detectada como calculo determinista (${deterministicTool.tool}).`,
        },
        primarySpecialistResponse: deterministicTool.response,
        contexts: [{
          chunks: [],
          totalConfidence: 1,
          warnings: [],
        }],
        recommendations: deterministicTool.recommendations,
        alerts: [],
        citations: [],
        groundingConfidence: 'none',
        performance: {
          routing_ms: Date.now() - tRoutingStart,
          retrieval_ms: 0,
          prompt_build_ms: 0,
          llm_ms: 0,
          llm_primary_ms: 0,
          llm_fallback_ms: 0,
          persistence_ms: 0,
          verifier_ms: 0,
          total_ms: totalMs,
          llm_model_used: `local:${deterministicTool.tool}`,
          llm_path: 'local_tool',
          used_fallback_model: false,
          retrieval_cache_hit: false,
          response_cache_hit: false,
          guard_triggered: false,
          tool_used: deterministicTool.tool,
        },
      };
      this.setCachedResponse(responseCacheKey, response);
      return response;
    }

    const { primary, secondary, reasoning, topScore } = detectSpecialist(query);
    const routing: RoutingResult = {
      primarySpecialist:    primary,
      secondarySpecialists: secondary,
      confidence: 0.92,
      reasoning,
    };
    const routingMs = Date.now() - tRoutingStart;

    // 2. Retrieval with cascade (domain strict -> domain relaxed -> global)
    const tRetrievalStart = Date.now();
    const dbCategory = SPECIALIST_TO_DB[primary];
    const retrieval = await retrieveWithCascade(query, dbCategory, topScore > 0, topScore === 0);
    const retrievedChunks = retrieval.chunks;
    const retrievalMs = Date.now() - tRetrievalStart;

    const hasEvidence = retrievedChunks.length > 0;
    const promptChunks = this.trimContextForPrompt(retrievedChunks);

    // 3. Build context text for prompt
    const tPromptBuildStart = Date.now();
    const contextText = hasEvidence
      ? buildContextText(promptChunks)
      : '';
    const promptBuildMs = Date.now() - tPromptBuildStart;

    // 4. LLM generation
    const tLlmStart = Date.now();
    let primaryResponse = '';
    const systemPrompt = hasEvidence
      ? GROUNDED_CHAT_PROMPT.replace('{context}', contextText).replace('{query}', query)
      : NO_EVIDENCE_FALLBACK_PROMPT.replace('{query}', query);
    const selectedModel = this.selectModel(hasEvidence, topScore, query, promptChunks);
    const modelToUse = selectedModel.model;
    llmModelUsed = modelToUse;
    llmPath = selectedModel.path;

    if (!hasEvidence && this.localNoEvidenceEnabled) {
      primaryResponse = this.buildNoEvidenceResponse();
      llmModelUsed = 'local:no_evidence';
      llmPath = 'local_no_evidence';
    } else {
      try {
        // Primary: Ollama qwen2.5:14b (default)
        const tPrimaryStart = Date.now();
        try {
          primaryResponse = await this.generateWithOllama(modelToUse, systemPrompt, query);
        } finally {
          llmPrimaryMs = Date.now() - tPrimaryStart;
        }
      } catch (primaryError) {
        console.error('[Orchestrator] Primary Ollama model failed, using local fallback:', primaryError);

        try {
          // Fallback: Ollama llama3.1:8b (default)
          const tFallbackStart = Date.now();
          try {
            primaryResponse = await this.generateWithOllama(this.fallbackModel, systemPrompt, query);
          } finally {
            llmFallbackMs = Date.now() - tFallbackStart;
          }
          llmModelUsed = this.fallbackModel;
          llmPath = 'fallback';
          usedFallbackModel = true;
        } catch (fallbackError) {
          console.error('[Orchestrator] Local Ollama fallback also failed:', fallbackError);
          primaryResponse = hasEvidence
            ? 'He encontrado información relevante en mi base de conocimientos pero no puedo generar una respuesta completa en este momento. Por favor, consulta con un asesor humano.'
            : 'No tengo evidencia suficiente en mi base de datos especializada para responder esta consulta. Te recomiendo consultar con un asesor fiscal, laboral o inmobiliario certificado.';
        }
      }
    }
    const llmMs = Date.now() - tLlmStart;

    const topSimilarity = retrievedChunks[0]?.similarity ?? 0;
    const groundingConf: OrchestratorResponse['groundingConfidence'] =
      !hasEvidence         ? 'none'
      : topSimilarity > 0.7 ? 'high'
      : topSimilarity > 0.5 ? 'medium'
      : 'low';

    if (hasEvidence && this.guardEnabled && groundingConf !== 'high') {
      const tVerifierStart = Date.now();
      try {
        const verification = await this.verifyGroundedResponse(contextText, query, primaryResponse);
        if (verification && !verification.supported && verification.revised_answer.trim()) {
          primaryResponse = verification.revised_answer.trim();
          guardTriggered = true;
        }
      } catch (guardError) {
        console.error('[Orchestrator] Guard verification failed:', guardError);
      } finally {
        verifierMs = Date.now() - tVerifierStart;
      }
    }

    // 5. Build citations
    const citations: CitationRef[] = retrievedChunks.map((c, i) => ({
      index:      i + 1,
      title:      c.metadata.title,
      source_url: c.metadata.source_url ?? '',
      similarity: Math.round(c.similarity * 100) / 100,
      chunk_id:   c.id,
    }));

    // 6. Alerts
    const alerts: OrchestratorResponse['alerts'] = [];
    if (primary === 'labor' && primaryResponse.toLowerCase().includes('vulnerable')) {
      alerts.push({
        type:    'CRITICAL',
        message: 'Se detectó una posible vulnerabilidad laboral. Consulta legal urgente recomendada.',
      });
    }
    if (!hasEvidence) {
      alerts.push({
        type:    'LOW',
        message: 'No se encontró evidencia suficiente en la base de conocimientos para esta consulta.',
      });
    }
    if (guardTriggered) {
      alerts.push({
        type: 'MEDIUM',
        message: 'La respuesta fue ajustada por el verificador de grounding para evitar afirmaciones no soportadas.',
      });
    }

    // 7. Grounding confidence
    // 8. Contexts for frontend
    const contexts: SpecialistContext[] = [{
      chunks: promptChunks.map(c => ({
        id:         c.id,
        content:    c.content,
        source:     c.metadata.title,
        confidence: c.similarity,
      })),
      totalConfidence: topSimilarity,
      warnings: hasEvidence ? [] : ['No se encontró evidencia suficiente en la base de conocimientos.'],
    }];

    if (hasEvidence && citations.length > 0) {
      primaryResponse = ensureCitationsInResponse(primaryResponse, citations);
    }

    const result: OrchestratorResponse = {
      success:                  true,
      routing,
      primarySpecialistResponse: primaryResponse,
      contexts,
      recommendations: [
        'Verifica los detalles en las fuentes citadas.',
        'Consulta con un asesor humano para casos críticos.',
      ],
      alerts,
      citations,
      groundingConfidence: groundingConf,
      performance: {
        routing_ms: routingMs,
        retrieval_ms: retrievalMs,
        prompt_build_ms: promptBuildMs,
        llm_ms: llmMs,
        llm_primary_ms: llmPrimaryMs,
        llm_fallback_ms: llmFallbackMs,
        persistence_ms: 0,
        verifier_ms: verifierMs,
        total_ms: 0,
        llm_model_used: llmModelUsed,
        llm_path: llmPath,
        used_fallback_model: usedFallbackModel,
        retrieval_cache_hit: retrieval.cacheHit,
        response_cache_hit: false,
        guard_triggered: guardTriggered,
        tool_used: toolUsed,
      },
    };

    // 9. Persist conversation
    const tPersistStart = Date.now();
    await this.saveConversation(userId, conversationId, query, primaryResponse, contexts);
    const persistenceMs = Date.now() - tPersistStart;
    const totalMs = Date.now() - tTotalStart;
    result.performance.persistence_ms = persistenceMs;
    result.performance.total_ms = totalMs;
    this.setCachedResponse(responseCacheKey, result);

    return result;
  }

  private async saveConversation(
    userId: string,
    conversationId: string,
    query: string,
    response: string,
    contexts: SpecialistContext[]
  ): Promise<void> {
    try {
      await this.supabase.from('messages').insert({
        conversation_id: conversationId,
        role:            'assistant',
        content:         response,
        context_chunks:  contexts.flatMap(ctx => ctx.chunks.map(ch => ch.id)),
      });
    } catch (error) {
      // Non-critical: log but do not propagate
      console.error('[Orchestrator] Save conversation error:', error);
    }
  }
}
