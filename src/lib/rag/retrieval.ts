import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
): Promise<RAGChunk[]> {
  const { category, limit = 5, threshold = 0.35 } = options;
  const dbCategory = resolveCategory(category);

  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch (embeddingError) {
    console.error('[RAG] Embedding generation failed:', embeddingError);
    return [];
  }

  const { data, error } = await getSupabase().rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold:  threshold,
    match_count:      limit,
    filter_category:  dbCategory,
  });

  if (error) {
    console.error('[RAG] match_chunks RPC error:', error);
    return [];
  }

  return (data ?? []) as RAGChunk[];
}
