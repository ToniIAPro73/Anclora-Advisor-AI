/**
 * Property-Based Test: RAG Post-Purge Referential Integrity (Property 4)
 *
 * **Validates: Requirements 5.3**
 *
 * Property statement: "For any knowledge base state after a purge operation,
 * all chunk references shall point to sources that still exist in the
 * knowledge base (no orphaned references)."
 *
 * Tests the pure purge logic in isolation (no Supabase calls).
 * Uses fast-check to generate random knowledge base states and purge subsets.
 *
 * Run: npx tsx tests/unit/test-source-auditor-referential-integrity.property.ts
 */

import * as fc from "fast-check";

// ─── Domain Model (mirrors source-auditor types) ────────────────────────────────

interface RagDocument {
  id: string;
  title: string;
  category: string | null;
}

interface RagChunk {
  id: string;
  document_id: string;
  content: string;
}

interface KnowledgeBaseState {
  documents: RagDocument[];
  chunks: RagChunk[];
}

interface PurgeScenario {
  initialState: KnowledgeBaseState;
  purgeIds: string[];
}

// ─── Pure Purge Logic (extracted from source-auditor.ts for testing) ────────────

/**
 * Simulates the purge operation:
 * - Removes documents whose IDs are in the purge set
 * - Removes all chunks referencing purged documents (CASCADE behavior)
 *
 * This mirrors the actual purgeSources behavior where deleting a rag_document
 * cascades to its rag_chunks via FK constraint.
 */
function purgeSourcesPure(
  state: KnowledgeBaseState,
  sourceIdsToPurge: string[],
): KnowledgeBaseState {
  const purgeSet = new Set(sourceIdsToPurge);

  const remainingDocuments = state.documents.filter(
    (doc) => !purgeSet.has(doc.id),
  );

  // CASCADE: remove chunks belonging to purged documents
  const remainingChunks = state.chunks.filter(
    (chunk) => !purgeSet.has(chunk.document_id),
  );

  return {
    documents: remainingDocuments,
    chunks: remainingChunks,
  };
}

// ─── Generators ─────────────────────────────────────────────────────────────────

/**
 * Generates a complete purge scenario: a knowledge base state with documents
 * and chunks, plus a subset of document IDs to purge.
 */
const purgeScenarioArb: fc.Arbitrary<PurgeScenario> = fc
  .array(fc.uuid(), { minLength: 1, maxLength: 15 })
  .chain((rawDocIds) => {
    const docIds = [...new Set(rawDocIds)];

    const documentsArb = fc.tuple(
      ...docIds.map((id) =>
        fc.record({
          id: fc.constant(id),
          title: fc.string({ minLength: 1, maxLength: 30 }),
          category: fc.option(
            fc.constantFrom("fiscal", "laboral", "mercado", "legal"),
            { nil: null },
          ),
        }),
      ),
    );

    const chunksArb = fc.array(
      fc.record({
        id: fc.uuid(),
        document_id: fc.constantFrom(...docIds),
        content: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      { minLength: 0, maxLength: 30 },
    );

    const purgeIdsArb = fc.subarray(docIds, {
      minLength: 0,
      maxLength: docIds.length,
    });

    return fc
      .tuple(documentsArb, chunksArb, purgeIdsArb)
      .map(([documents, chunks, purgeIds]) => ({
        initialState: { documents, chunks },
        purgeIds,
      }));
  });

// ─── Property Test ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function reportResult(success: boolean, label: string, details?: string): void {
  if (success) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    if (details) console.error(`        ${details}`);
  }
}

console.log("\n=== Property 4: RAG Post-Purge Referential Integrity ===\n");

// ── Main Property: No orphaned chunk references after purge ─────────────────────
console.log("Property: After purge, no chunk references a purged source\n");

try {
  fc.assert(
    fc.property(purgeScenarioArb, ({ initialState, purgeIds }) => {
      const afterPurge = purgeSourcesPure(initialState, purgeIds);
      const purgeSet = new Set(purgeIds);
      const remainingDocIds = new Set(afterPurge.documents.map((d) => d.id));

      // Assertion 1: No remaining chunk references a purged document
      for (const chunk of afterPurge.chunks) {
        if (purgeSet.has(chunk.document_id)) {
          return false;
        }
      }

      // Assertion 2: All remaining chunks reference documents that still exist
      for (const chunk of afterPurge.chunks) {
        if (!remainingDocIds.has(chunk.document_id)) {
          return false;
        }
      }

      return true;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "No orphaned chunk references after purge (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "No orphaned chunk references after purge", msg);
}

// ── Supporting Property: Purged documents are fully removed ─────────────────────
console.log("\nProperty: Purged documents do not remain in state\n");

try {
  fc.assert(
    fc.property(purgeScenarioArb, ({ initialState, purgeIds }) => {
      const afterPurge = purgeSourcesPure(initialState, purgeIds);
      const purgeSet = new Set(purgeIds);

      for (const doc of afterPurge.documents) {
        if (purgeSet.has(doc.id)) {
          return false;
        }
      }
      return true;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(true, "All purged documents fully removed (1000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "All purged documents fully removed", msg);
}

// ── Supporting Property: Non-purged documents and chunks are preserved ──────────
console.log(
  "\nProperty: Non-purged documents and their chunks are preserved\n",
);

try {
  fc.assert(
    fc.property(purgeScenarioArb, ({ initialState, purgeIds }) => {
      const afterPurge = purgeSourcesPure(initialState, purgeIds);
      const purgeSet = new Set(purgeIds);

      // All non-purged documents remain
      const keptDocs = initialState.documents.filter(
        (d) => !purgeSet.has(d.id),
      );
      const remainingDocIds = new Set(afterPurge.documents.map((d) => d.id));

      for (const doc of keptDocs) {
        if (!remainingDocIds.has(doc.id)) {
          return false;
        }
      }

      // All chunks belonging to non-purged documents remain
      const keptChunks = initialState.chunks.filter(
        (c) => !purgeSet.has(c.document_id),
      );
      const remainingChunkIds = new Set(afterPurge.chunks.map((c) => c.id));

      for (const chunk of keptChunks) {
        if (!remainingChunkIds.has(chunk.id)) {
          return false;
        }
      }

      return true;
    }),
    { numRuns: 1000, verbose: 0 },
  );
  reportResult(
    true,
    "Non-purged documents and their chunks preserved (1000 runs)",
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Non-purged documents and their chunks preserved", msg);
}

// ── Supporting Property: Empty purge is a no-op ─────────────────────────────────
console.log("\nProperty: Empty purge set leaves state unchanged\n");

try {
  fc.assert(
    fc.property(
      purgeScenarioArb.map((s) => ({ ...s, purgeIds: [] })),
      ({ initialState, purgeIds }) => {
        const afterPurge = purgeSourcesPure(initialState, purgeIds);

        if (afterPurge.documents.length !== initialState.documents.length) {
          return false;
        }
        if (afterPurge.chunks.length !== initialState.chunks.length) {
          return false;
        }
        return true;
      },
    ),
    { numRuns: 200, verbose: 0 },
  );
  reportResult(true, "Empty purge set is a no-op (200 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Empty purge set is a no-op", msg);
}

// ─── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(
  `PROPERTY 4 (Referential Integrity): ${passed} passed, ${failed} failed`,
);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
