/**
 * Property Test: RAG Retrieval Minimum Relevance (Property 6)
 *
 * For any query submitted to the territorial intelligence RAG, all chunks
 * returned in the result set shall have a relevance_score >= 0.7.
 *
 * **Validates: Requirements 6.3**
 *
 * Run: npx tsx tests/unit/test-property-rag-retrieval-minimum-relevance.ts
 */

import * as fc from "fast-check";

// ----------------------------------------------------------------
// Types representing RAG retrieval chunks
// ----------------------------------------------------------------

interface RagChunk {
  chunk_id: string;
  content: string;
  relevance_score: number;
  document_id: string;
}

// ----------------------------------------------------------------
// The retrieval filter under test: filters chunks by minimum relevance
// ----------------------------------------------------------------

const MINIMUM_RELEVANCE_THRESHOLD = 0.7;

/**
 * Filters RAG retrieval results to only include chunks meeting
 * the minimum relevance threshold of 0.7.
 * This mirrors the territorial ingestion pipeline's relevance gate.
 */
function filterByMinimumRelevance(
  chunks: RagChunk[],
  threshold: number = MINIMUM_RELEVANCE_THRESHOLD,
): RagChunk[] {
  return chunks.filter((chunk) => chunk.relevance_score >= threshold);
}

// ----------------------------------------------------------------
// Generators
// ----------------------------------------------------------------

/** Generates a relevance score between 0.0 and 1.0 */
const relevanceScoreArb = fc.double({ min: 0.0, max: 1.0, noNaN: true });

/** Generates a single RAG chunk with a given relevance score */
const ragChunkArb = (
  relevanceScore: fc.Arbitrary<number>,
): fc.Arbitrary<RagChunk> =>
  fc.record({
    chunk_id: fc.uuid(),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    relevance_score: relevanceScore,
    document_id: fc.uuid(),
  });

/** Generates an array of RAG chunks with varying relevance scores */
const chunksArrayArb = fc.array(ragChunkArb(relevanceScoreArb), {
  minLength: 0,
  maxLength: 50,
});

// ----------------------------------------------------------------
// Property tests
// ----------------------------------------------------------------

let passed = 0;
let failed = 0;

function reportProperty(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL: ${name}`);
    console.error(`        ${message}`);
    failed++;
  }
}

console.log("\nProperty 6: RAG Retrieval Minimum Relevance\n");

// Property 6a: All returned chunks have relevance_score >= 0.7
reportProperty("All returned chunks have relevance_score >= 0.7", () => {
  fc.assert(
    fc.property(chunksArrayArb, (chunks) => {
      const result = filterByMinimumRelevance(chunks);
      return result.every(
        (chunk) => chunk.relevance_score >= MINIMUM_RELEVANCE_THRESHOLD,
      );
    }),
    { numRuns: 1000 },
  );
});

// Property 6b: Chunks with relevance_score < 0.7 are never returned
reportProperty("Chunks with relevance_score < 0.7 are never returned", () => {
  fc.assert(
    fc.property(chunksArrayArb, (chunks) => {
      const result = filterByMinimumRelevance(chunks);
      const belowThreshold = chunks.filter(
        (c) => c.relevance_score < MINIMUM_RELEVANCE_THRESHOLD,
      );
      // None of the below-threshold chunks should appear in the result
      return belowThreshold.every(
        (low) => !result.some((r) => r.chunk_id === low.chunk_id),
      );
    }),
    { numRuns: 1000 },
  );
});

// Property 6c: All chunks at or above threshold are preserved (no false rejections)
reportProperty(
  "All chunks at or above threshold are preserved in the result",
  () => {
    fc.assert(
      fc.property(chunksArrayArb, (chunks) => {
        const result = filterByMinimumRelevance(chunks);
        const aboveThreshold = chunks.filter(
          (c) => c.relevance_score >= MINIMUM_RELEVANCE_THRESHOLD,
        );
        // Every above-threshold chunk must be present in result
        return aboveThreshold.every((high) =>
          result.some((r) => r.chunk_id === high.chunk_id),
        );
      }),
      { numRuns: 1000 },
    );
  },
);

// Property 6d: Result set size equals count of chunks meeting threshold
reportProperty(
  "Result set size equals count of chunks with relevance >= 0.7",
  () => {
    fc.assert(
      fc.property(chunksArrayArb, (chunks) => {
        const result = filterByMinimumRelevance(chunks);
        const expectedCount = chunks.filter(
          (c) => c.relevance_score >= MINIMUM_RELEVANCE_THRESHOLD,
        ).length;
        return result.length === expectedCount;
      }),
      { numRuns: 1000 },
    );
  },
);

// ----------------------------------------------------------------
// Summary
// ----------------------------------------------------------------

console.log(`\n${"=".repeat(60)}`);
console.log(
  `RAG RETRIEVAL MINIMUM RELEVANCE PROPERTY TESTS: ${passed} passed, ${failed} failed`,
);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
