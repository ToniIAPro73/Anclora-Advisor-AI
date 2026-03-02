import { generateEmbeddingVector, getAIRuntimeConfig } from '../ai/runtime';
import { TtlCache } from '../cache/memory';

const EMBEDDING_CACHE_TTL_MS = Number.parseInt(process.env.EMBEDDING_CACHE_TTL_MS ?? '900000', 10);
const EMBEDDING_CACHE_MAX_ENTRIES = Number.parseInt(process.env.EMBEDDING_CACHE_MAX_ENTRIES ?? '256', 10);
const embeddingCache = new TtlCache<number[]>(EMBEDDING_CACHE_TTL_MS, EMBEDDING_CACHE_MAX_ENTRIES);

function normalizeVector(values: number[]): number[] {
  let norm = 0;
  for (const v of values) norm += v * v;
  const mag = Math.sqrt(norm);
  if (!Number.isFinite(mag) || mag === 0) return values;
  return values.map((v) => v / mag);
}

/**
 * Generates an embedding for the given text using the configured runtime profile.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const vec = normalizeVector(await generateEmbeddingVector(text));
  const expectedDimension = getAIRuntimeConfig().embeddings.expectedDimension;

  if (vec.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDimension}, got ${vec.length}. ` +
      `Ensure the selected embedding provider uses the same dimension as the indexed corpus.`
    );
  }

  embeddingCache.set(cacheKey, vec);
  return vec;
}
