// lib/agents/orchestrator.ts
/**
 * ORCHESTRATOR CENTRAL - Anclora Advisor AI
 * Primary LLM: Ollama local (qwen2.5:14b)
 * Fallback LLM: Ollama local (llama3.1:8b)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { retrieveContext, RAGChunk } from '../../src/lib/rag/retrieval';
import { GROUNDED_CHAT_PROMPT, NO_EVIDENCE_FALLBACK_PROMPT } from './prompts';

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

async function retrieveWithCascade(
  query: string,
  primaryCategory: DbCategory,
  allowGlobalFallback: boolean
): Promise<RAGChunk[]> {
  const attempts: RetrievalAttempt[] = [
    { category: primaryCategory, threshold: 0.35, limit: 5 },
    { category: primaryCategory, threshold: 0.25, limit: 5 },
  ];

  if (allowGlobalFallback) {
    attempts.push(
      { threshold: 0.30, limit: 5 },
      { threshold: 0.20, limit: 5 }
    );
  }

  for (const attempt of attempts) {
    const chunks = await retrieveContext(query, {
      category: attempt.category,
      threshold: attempt.threshold,
      limit: attempt.limit,
    });

    if (chunks.length > 0) {
      return chunks;
    }
  }

  return [];
}

// ----------------------------------------------------------------
// Orchestrator
// ----------------------------------------------------------------
export class Orchestrator {
  private supabase: SupabaseClient;
  private ollamaBaseUrl: string;
  private primaryModel: string;
  private fallbackModel: string;

  constructor() {
    this.supabase  = createClient(
      process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder'
    );
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.primaryModel = process.env.OLLAMA_MODEL_PRIMARY ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:14b';
    this.fallbackModel = process.env.OLLAMA_MODEL_FALLBACK ?? 'llama3.1:8b';
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

    // 1. Routing
    const { primary, secondary, reasoning, topScore } = detectSpecialist(query);
    const routing: RoutingResult = {
      primarySpecialist:    primary,
      secondarySpecialists: secondary,
      confidence: 0.92,
      reasoning,
    };

    // 2. Retrieval with cascade (domain strict -> domain relaxed -> global)
    const dbCategory = SPECIALIST_TO_DB[primary];
    const retrievedChunks = await retrieveWithCascade(query, dbCategory, topScore > 0);

    const hasEvidence = retrievedChunks.length > 0;

    // 3. Build context text for prompt
    const contextText = hasEvidence
      ? buildContextText(retrievedChunks)
      : '';

    // 4. LLM generation
    let primaryResponse = '';
    const systemPrompt = hasEvidence
      ? GROUNDED_CHAT_PROMPT.replace('{context}', contextText).replace('{query}', query)
      : NO_EVIDENCE_FALLBACK_PROMPT.replace('{query}', query);

    try {
      // Primary: Ollama qwen2.5:14b (default)
      primaryResponse = await this.generateWithOllama(this.primaryModel, systemPrompt, query);
    } catch (primaryError) {
      console.error('[Orchestrator] Primary Ollama model failed, using local fallback:', primaryError);

      try {
        // Fallback: Ollama llama3.1:8b (default)
        primaryResponse = await this.generateWithOllama(this.fallbackModel, systemPrompt, query);
      } catch (fallbackError) {
        console.error('[Orchestrator] Local Ollama fallback also failed:', fallbackError);
        primaryResponse = hasEvidence
          ? 'He encontrado información relevante en mi base de conocimientos pero no puedo generar una respuesta completa en este momento. Por favor, consulta con un asesor humano.'
          : 'No tengo evidencia suficiente en mi base de datos especializada para responder esta consulta. Te recomiendo consultar con un asesor fiscal, laboral o inmobiliario certificado.';
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

    // 7. Grounding confidence
    const topSimilarity  = retrievedChunks[0]?.similarity ?? 0;
    const groundingConf: OrchestratorResponse['groundingConfidence'] =
      !hasEvidence         ? 'none'
      : topSimilarity > 0.7 ? 'high'
      : topSimilarity > 0.5 ? 'medium'
      : 'low';

    // 8. Contexts for frontend
    const contexts: SpecialistContext[] = [{
      chunks: retrievedChunks.map(c => ({
        id:         c.id,
        content:    c.content,
        source:     c.metadata.title,
        confidence: c.similarity,
      })),
      totalConfidence: topSimilarity,
      warnings: hasEvidence ? [] : ['No se encontró evidencia suficiente en la base de conocimientos.'],
    }];

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
    };

    // 9. Persist conversation
    await this.saveConversation(userId, conversationId, query, primaryResponse, contexts);

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
