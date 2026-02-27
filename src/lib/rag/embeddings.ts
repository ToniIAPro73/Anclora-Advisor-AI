const EMBEDDING_DIM = 384;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'all-minilm';

function normalizeVector(values: number[]): number[] {
  let norm = 0;
  for (const v of values) norm += v * v;
  const mag = Math.sqrt(norm);
  if (!Number.isFinite(mag) || mag === 0) return values;
  return values.map((v) => v / mag);
}

async function generateEmbeddingWithOllama(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_EMBED_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Ollama embeddings request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as { embedding?: number[] };
  const embedding = data.embedding ?? [];
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Ollama embeddings returned empty embedding');
  }

  return normalizeVector(embedding);
}

/**
 * Generates a 384-dimensional embedding for the given text.
 * Uses local Ollama embeddings model (default: all-minilm).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const vec = await generateEmbeddingWithOllama(text);

  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${vec.length}. ` +
      `Ensure OLLAMA_EMBED_MODEL='all-minilm' (or any 384-dim embedding model).`
    );
  }

  return vec;
}
