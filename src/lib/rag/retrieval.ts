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
}

export interface RetrievalResult {
  chunks: RAGChunk[];
  cacheHit: boolean;
}

const RETRIEVAL_CACHE_TTL_MS = Number.parseInt(process.env.RETRIEVAL_CACHE_TTL_MS ?? '300000', 10);
const RETRIEVAL_CACHE_MAX_ENTRIES = Number.parseInt(process.env.RETRIEVAL_CACHE_MAX_ENTRIES ?? '256', 10);
const retrievalCache = new TtlCache<RAGChunk[]>(RETRIEVAL_CACHE_TTL_MS, RETRIEVAL_CACHE_MAX_ENTRIES);

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
      }
    | Array<{
        title: string | null;
        category: string | null;
        source_url: string | null;
      }>
    | null;
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
  };
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
  const { category, limit = 5, threshold = 0.35 } = options;
  const dbCategory = resolveCategory(category);
  const cacheKey = JSON.stringify({
    query: query.trim().toLowerCase(),
    category: dbCategory,
    limit,
    threshold,
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

  const { data, error } = await getSupabase().rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold:  threshold,
    match_count:      limit,
    filter_category:  dbCategory,
  });

  if (error) {
    if (error.code === 'PGRST202') {
      console.warn('[RAG] match_chunks RPC not found, using JS fallback retrieval');
      const fallbackChunks = await fallbackRetrieveWithoutRpc(embedding, dbCategory, limit, threshold);
      retrievalCache.set(cacheKey, fallbackChunks);
      return { chunks: fallbackChunks, cacheHit: false };
    }
    console.error('[RAG] match_chunks RPC error:', error);
    return { chunks: [], cacheHit: false };
  }

  const chunks = (data ?? []) as RAGChunk[];
  retrievalCache.set(cacheKey, chunks);
  return { chunks, cacheHit: false };
}
