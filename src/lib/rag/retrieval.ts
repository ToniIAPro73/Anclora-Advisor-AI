import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TtlCache } from '../cache/memory';
import { generateEmbedding } from './embeddings';

// ----------------------------------------------------------------
// Domain alias map: orchestrator types → DB category values
// ----------------------------------------------------------------
const DOMAIN_ALIAS: Record<string, string> = {
  fiscal:  'fiscal',
  laboral: 'laboral',
  labor:   'laboral',   // orchestrator legacy key
  mercado: 'mercado',
  market:  'mercado',   // orchestrator legacy key
};

function resolveCategory(raw?: string): string {
  if (!raw) return '';
  return DOMAIN_ALIAS[raw.toLowerCase()] ?? raw.toLowerCase();
}

// ----------------------------------------------------------------
// Supabase client (service role — server-side only)
// ----------------------------------------------------------------
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        `RAG retrieval: missing Supabase env vars. ` +
        `SUPABASE_URL: ${!!url}, SUPABASE_SERVICE_ROLE_KEY: ${!!key}`
      );
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface RAGChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: {
    title: string;
    category: string;
    source_url: string;
    doc_metadata?: Record<string, unknown>;
  };
  similarity: number;
}

export interface RetrievalOptions {
  /** Domain ('fiscal' | 'laboral' | 'mercado' — or orchestrator aliases 'labor' | 'market') */
  category?: string;
  /** Max chunks to return (default: 5) */
  limit?: number;
  /** Minimum cosine similarity (default: 0.35 — tuned for 18-chunk corpus) */
  threshold?: number;
  /** Enable application-level hybrid fusion (default: true) */
  hybrid?: boolean;
}

export interface RetrievalResult {
  chunks: RAGChunk[];
  cacheHit: boolean;
}

const RETRIEVAL_CACHE_TTL_MS = Number.parseInt(process.env.RETRIEVAL_CACHE_TTL_MS ?? '300000', 10);
const RETRIEVAL_CACHE_MAX_ENTRIES = Number.parseInt(process.env.RETRIEVAL_CACHE_MAX_ENTRIES ?? '256', 10);
const retrievalCache = new TtlCache<RAGChunk[]>(RETRIEVAL_CACHE_TTL_MS, RETRIEVAL_CACHE_MAX_ENTRIES);
const HYBRID_ENABLED = process.env.RAG_HYBRID_ENABLED !== 'false';
const HYBRID_VECTOR_CANDIDATES = Number.parseInt(process.env.RAG_HYBRID_VECTOR_CANDIDATES ?? '12', 10);
const HYBRID_KEYWORD_CANDIDATES = Number.parseInt(process.env.RAG_HYBRID_KEYWORD_CANDIDATES ?? '12', 10);
const HYBRID_RRF_K = Number.parseInt(process.env.RAG_HYBRID_RRF_K ?? '60', 10);
const RERANK_ENABLED = process.env.RAG_RERANK_ENABLED !== 'false';
const RERANK_CANDIDATES = Number.parseInt(process.env.RAG_RERANK_CANDIDATES ?? '10', 10);
const TOKEN_STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'en', 'un', 'una', 'que', 'como', 'del', 'al',
  'para', 'por', 'con', 'sin', 'a', 'es', 'se', 'lo', 'las', 'los', 'su', 'sus', 'mi', 'mis',
]);

interface RawChunkRow {
  id: string;
  document_id: string;
  content: string;
  embedding: string | number[] | null;
  rag_documents:
    | {
        title: string | null;
        category: string | null;
        source_url: string | null;
        doc_metadata?: Record<string, unknown> | null;
      }
    | Array<{
        title: string | null;
        category: string | null;
        source_url: string | null;
        doc_metadata?: Record<string, unknown> | null;
      }>
    | null;
}

interface MetadataFilter {
  topic?: string;
  jurisdiction?: string;
  source_type?: string;
}

function parseEmbedding(value: string | number[] | null): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;

  const cleaned = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!cleaned) return null;

  const parsed = cleaned
    .split(',')
    .map((n) => Number.parseFloat(n.trim()))
    .filter((n) => Number.isFinite(n));

  return parsed.length > 0 ? parsed : null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return -1;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!Number.isFinite(denom) || denom === 0) return -1;
  return dot / denom;
}

function docMetadataFromRow(row: RawChunkRow): RAGChunk['metadata'] {
  const doc = Array.isArray(row.rag_documents) ? row.rag_documents[0] : row.rag_documents;
  return {
    title: doc?.title ?? 'Documento sin titulo',
    category: doc?.category ?? '',
    source_url: doc?.source_url ?? '',
    doc_metadata: (doc?.doc_metadata as Record<string, unknown> | null | undefined) ?? undefined,
  };
}

function inferMetadataFilter(query: string, category: string): MetadataFilter {
  const haystack = query.toLowerCase();
  const filter: MetadataFilter = {};

  if (haystack.includes('cuota cero')) filter.topic = 'cuota_cero';
  else if (haystack.includes('modelo 303') || /\biva\b/.test(haystack)) filter.topic = 'iva';
  else if (haystack.includes('modelo 130') || /\birpf\b/.test(haystack)) filter.topic = 'irpf';
  else if (haystack.includes('reta')) filter.topic = 'reta';
  else if (haystack.includes('pluriactividad')) filter.topic = 'pluriactividad';
  else if (haystack.includes('despido')) filter.topic = 'despido';
  else if (haystack.includes('alquiler') || haystack.includes('fianza') || haystack.includes('arrend')) filter.topic = 'arrendamiento';

  if (haystack.includes('baleares') || haystack.includes('balears') || haystack.includes('mallorca')) {
    filter.jurisdiction = 'es-bal';
  } else if (category) {
    filter.jurisdiction = 'es';
  }

  if (haystack.includes('boe') || haystack.includes('aeat') || haystack.includes('caib')) {
    filter.source_type = 'web_page';
  }

  return filter;
}

function matchesMetadataFilter(chunk: RAGChunk, filter: MetadataFilter): boolean {
  const meta = chunk.metadata.doc_metadata ?? {};

  if (filter.topic && meta.topic !== filter.topic) return false;
  if (filter.jurisdiction && meta.jurisdiction !== filter.jurisdiction) return false;
  if (filter.source_type && meta.source_type !== filter.source_type) return false;

  return true;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token));
}

function lexicalScore(queryTokens: string[], row: RawChunkRow): number {
  if (queryTokens.length === 0) return 0;
  const metadata = docMetadataFromRow(row);
  const haystack = `${metadata.title} ${row.content}`.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

function lexicalScoreForChunk(queryTokens: string[], chunk: RAGChunk): number {
  if (queryTokens.length === 0) return 0;
  const haystack = `${chunk.metadata.title} ${chunk.content}`.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

function rerankChunks(
  chunks: RAGChunk[],
  query: string,
  metadataFilter: MetadataFilter,
  limit: number
): RAGChunk[] {
  if (!RERANK_ENABLED || chunks.length <= 1) {
    return chunks.slice(0, limit);
  }

  const queryTokens = tokenize(query);
  const candidates = chunks.slice(0, Math.max(limit, RERANK_CANDIDATES));

  const reranked = candidates
    .map((chunk) => {
      const lexical = lexicalScoreForChunk(queryTokens, chunk);
      const meta = chunk.metadata.doc_metadata ?? {};
      let metadataBoost = 0;

      if (metadataFilter.topic && meta.topic === metadataFilter.topic) metadataBoost += 0.12;
      if (metadataFilter.jurisdiction && meta.jurisdiction === metadataFilter.jurisdiction) metadataBoost += 0.08;
      if (metadataFilter.source_type && meta.source_type === metadataFilter.source_type) metadataBoost += 0.04;

      const score = chunk.similarity * 0.65 + lexical * 0.25 + metadataBoost;
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);

  return reranked;
}

function fuseHybridResults(
  vectorChunks: RAGChunk[],
  keywordChunks: RAGChunk[],
  limit: number
): RAGChunk[] {
  const fused = new Map<string, { chunk: RAGChunk; score: number }>();

  vectorChunks.forEach((chunk, index) => {
    const score = 1 / (HYBRID_RRF_K + index + 1);
    const existing = fused.get(chunk.id);
    if (existing) {
      existing.score += score;
      existing.chunk.similarity = Math.max(existing.chunk.similarity, chunk.similarity);
      return;
    }
    fused.set(chunk.id, { chunk: { ...chunk }, score });
  });

  keywordChunks.forEach((chunk, index) => {
    const score = 1 / (HYBRID_RRF_K + index + 1);
    const existing = fused.get(chunk.id);
    if (existing) {
      existing.score += score;
      existing.chunk.similarity = Math.max(existing.chunk.similarity, chunk.similarity);
      return;
    }
    fused.set(chunk.id, { chunk: { ...chunk }, score });
  });

  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

async function fetchKeywordCandidates(
  queryText: string,
  category: string,
  limit: number
): Promise<RAGChunk[]> {
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return [];

  async function runSelect(includeDocMetadata: boolean): Promise<RawChunkRow[]> {
    let query = getSupabase()
      .from('rag_chunks')
      .select(
        includeDocMetadata
          ? `
      id,
      document_id,
      content,
      embedding,
      rag_documents!inner (
        title,
        category,
        source_url,
        doc_metadata
      )
    `
          : `
      id,
      document_id,
      content,
      embedding,
      rag_documents!inner (
        title,
        category,
        source_url
      )
    `
      )
      .limit(250);

    if (category) {
      query = query.eq('rag_documents.category', category);
    }

    const { data, error } = await query;
    if (error) {
      if (includeDocMetadata && error.code === '42703') {
        console.warn('[RAG] doc_metadata column not available yet, using lexical fallback without metadata column');
        return runSelect(false);
      }
      console.error('[RAG] keyword candidate query error:', error);
      return [];
    }

    return (data ?? []) as unknown as RawChunkRow[];
  }

  const rows = await runSelect(true);
  return rows
    .map((row) => {
      const score = lexicalScore(queryTokens, row);
      if (score <= 0) return null;
      return {
        id: row.id,
        document_id: row.document_id,
        content: row.content,
        metadata: docMetadataFromRow(row),
        similarity: score,
      } satisfies RAGChunk;
    })
    .filter((item): item is RAGChunk => item !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

async function fallbackRetrieveWithoutRpc(
  queryEmbedding: number[],
  category: string,
  limit: number,
  threshold: number
): Promise<RAGChunk[]> {
  let query = getSupabase()
    .from('rag_chunks')
    .select(
      `
      id,
      document_id,
      content,
      embedding,
      rag_documents!inner (
        title,
        category,
        source_url
      )
    `
    )
    .not('embedding', 'is', null)
    .limit(250);

  if (category) {
    query = query.eq('rag_documents.category', category);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[RAG] fallback query error:', error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawChunkRow[];

  const scored = rows
    .map((row) => {
      const emb = parseEmbedding(row.embedding);
      if (!emb || emb.length !== queryEmbedding.length) return null;

      const similarity = cosineSimilarity(queryEmbedding, emb);
      if (!Number.isFinite(similarity) || similarity < threshold) return null;

      return {
        id: row.id,
        document_id: row.document_id,
        content: row.content,
        metadata: docMetadataFromRow(row),
        similarity,
      } satisfies RAGChunk;
    })
    .filter((item): item is RAGChunk => item !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

// ----------------------------------------------------------------
// Core retrieval function
// ----------------------------------------------------------------
/**
 * Performs semantic similarity search on rag_chunks.
 * Returns chunks ordered by cosine similarity descending.
 * Returns [] on error (never throws — caller handles fallback).
 */
export async function retrieveContext(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult> {
  const { category, limit = 5, threshold = 0.35, hybrid = HYBRID_ENABLED } = options;
  const dbCategory = resolveCategory(category);
  const metadataFilter = inferMetadataFilter(query, dbCategory);
  const cacheKey = JSON.stringify({
    query: query.trim().toLowerCase(),
    category: dbCategory,
    limit,
    threshold,
    hybrid,
    metadataFilter,
  });

  const cached = retrievalCache.get(cacheKey);
  if (cached) {
    return { chunks: cached, cacheHit: true };
  }

  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch (embeddingError) {
    console.error('[RAG] Embedding generation failed:', embeddingError);
    return { chunks: [], cacheHit: false };
  }

  const vectorMatchCount = hybrid ? Math.max(limit, HYBRID_VECTOR_CANDIDATES) : limit;
  const { data, error } = await getSupabase().rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold:  threshold,
    match_count:      vectorMatchCount,
    filter_category:  dbCategory,
  });

  if (error) {
    if (error.code === 'PGRST202') {
      console.warn('[RAG] match_chunks RPC not found, using JS fallback retrieval');
      const fallbackChunks = await fallbackRetrieveWithoutRpc(embedding, dbCategory, vectorMatchCount, threshold);
      retrievalCache.set(cacheKey, fallbackChunks);
      return { chunks: fallbackChunks, cacheHit: false };
    }
    console.error('[RAG] match_chunks RPC error:', error);
    return { chunks: [], cacheHit: false };
  }

  const vectorChunks = (data ?? []) as RAGChunk[];
  const fusedChunks = hybrid
    ? fuseHybridResults(
        vectorChunks,
        await fetchKeywordCandidates(query, dbCategory, HYBRID_KEYWORD_CANDIDATES),
        Math.max(limit, RERANK_CANDIDATES)
      )
    : vectorChunks.slice(0, Math.max(limit, RERANK_CANDIDATES));

  const filteredChunks = fusedChunks.filter((chunk) => matchesMetadataFilter(chunk, metadataFilter));
  const baseChunks = filteredChunks.length > 0 ? filteredChunks : fusedChunks;
  const chunks = rerankChunks(baseChunks, query, metadataFilter, limit);

  retrievalCache.set(cacheKey, chunks);
  return { chunks, cacheHit: false };
}
