import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const EMBEDDING_DIM = 384;

let embedder: FeatureExtractionPipeline | null = null;
let initPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Generates a 384-dimensional embedding for the given text.
 * Uses Xenova/paraphrase-multilingual-MiniLM-L12-v2 (local, no API key required).
 * Lazy-initializes and caches the pipeline across calls.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    if (!initPromise) {
      initPromise = pipeline('feature-extraction', MODEL) as Promise<FeatureExtractionPipeline>;
    }
    embedder = await initPromise;
  }

  const output = await embedder(text, { pooling: 'mean', normalize: true });
  const vec = Array.from(output.data) as number[];

  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${vec.length}. ` +
      `Ensure model is '${MODEL}'.`
    );
  }

  return vec;
}
