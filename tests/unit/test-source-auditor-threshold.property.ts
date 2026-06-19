/**
 * Property-Based Test: RAG Source Audit Threshold Classification (Property 3)
 *
 * **Validates: Requirements 5.1, 5.2**
 *
 * Property statement: "For any set of RAG sources with known relevance scores,
 * calling auditSources(threshold) shall mark every source with relevance_score
 * < threshold as action: 'purge' and every source with relevance_score >=
 * threshold as action: 'keep'."
 *
 * Tests the classifySource pure function directly with random inputs.
 * Uses fast-check to generate arrays of sources with random relevance scores
 * and arbitrary thresholds.
 *
 * Run: npx tsx tests/unit/test-source-auditor-threshold.property.ts
 */

import * as fc from "fast-check";
import {
  classifySource,
  type RagDocumentRow,
} from "../../lib/rag/source-auditor";

// ─── Constants (mirrored from source-auditor) ───────────────────────────────────

const MERCADO_PURGE_THRESHOLD = 0.08;

// ─── Generators ─────────────────────────────────────────────────────────────────

/** Generates a non-Mercado RAG document with a random category. */
const nonMercadoDocArb: fc.Arbitrary<RagDocumentRow> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  category: fc.constantFrom("fiscal", "laboral", "legal", "territorial", null),
  source_url: fc.option(fc.webUrl(), { nil: null }),
  doc_metadata: fc.constant(null),
});

/** Generates a Mercado-tagged document. */
const mercadoDocArb: fc.Arbitrary<RagDocumentRow> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  category: fc.constantFrom("mercado", "Mercado", "MERCADO"),
  source_url: fc.option(fc.webUrl(), { nil: null }),
  doc_metadata: fc.constant(null),
});

/** Generates a relevance score between 0.0 and 1.0. */
const relevanceScoreArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 1,
  noNaN: true,
});

/** Generates a threshold between 0.0 and 1.0. */
const thresholdArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 1,
  noNaN: true,
});

// ─── Property Tests ─────────────────────────────────────────────────────────────

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

console.log(
  "\n=== Property 3: RAG Source Audit Threshold Classification ===\n",
);

// ── Main Property: Non-Mercado sources classified correctly by threshold ────────
console.log(
  "Property: Non-Mercado sources with score < threshold get 'purge', score >= threshold get 'keep'\n",
);

try {
  fc.assert(
    fc.property(
      nonMercadoDocArb,
      relevanceScoreArb,
      thresholdArb,
      (doc, score, threshold) => {
        const result = classifySource(doc, score, threshold);

        if (score < threshold) {
          return result.action === "purge";
        } else {
          return result.action === "keep";
        }
      },
    ),
    { numRuns: 5000, verbose: 0 },
  );
  reportResult(
    true,
    "Non-Mercado threshold classification correct (5000 runs)",
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Non-Mercado threshold classification correct", msg);
}

// ── Property: Mercado sources with score <= 0.08 always purged ──────────────────
console.log(
  "\nProperty: Mercado sources with score <= 0.08 are always purged regardless of threshold\n",
);

try {
  fc.assert(
    fc.property(
      mercadoDocArb,
      fc.double({ min: 0, max: MERCADO_PURGE_THRESHOLD, noNaN: true }),
      thresholdArb,
      (doc, score, threshold) => {
        const result = classifySource(doc, score, threshold);
        return result.action === "purge";
      },
    ),
    { numRuns: 3000, verbose: 0 },
  );
  reportResult(
    true,
    "Mercado sources with score <= 0.08 always purged (3000 runs)",
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Mercado sources with score <= 0.08 always purged", msg);
}

// ── Property: Mercado sources above 0.08 follow general threshold logic ─────────
console.log(
  "\nProperty: Mercado sources with score > 0.08 follow general threshold classification\n",
);

try {
  fc.assert(
    fc.property(
      mercadoDocArb,
      fc.double({ min: 0.08 + Number.EPSILON, max: 1, noNaN: true }),
      thresholdArb,
      (doc, score, threshold) => {
        // Score is strictly above 0.08, so Mercado special rule does not fire
        // General threshold logic applies
        const result = classifySource(doc, score, threshold);

        if (score < threshold) {
          return result.action === "purge";
        } else {
          return result.action === "keep";
        }
      },
    ),
    { numRuns: 3000, verbose: 0 },
  );
  reportResult(
    true,
    "Mercado sources > 0.08 follow general threshold (3000 runs)",
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Mercado sources > 0.08 follow general threshold", msg);
}

// ── Property: Batch classification — all sources in an array classified correctly
console.log(
  "\nProperty: Array of mixed sources all classified correctly against a single threshold\n",
);

interface SourceWithScore {
  doc: RagDocumentRow;
  score: number;
}

const sourceWithScoreArb: fc.Arbitrary<SourceWithScore> = fc.oneof(
  fc.tuple(nonMercadoDocArb, relevanceScoreArb).map(([doc, score]) => ({
    doc,
    score,
  })),
  fc.tuple(mercadoDocArb, relevanceScoreArb).map(([doc, score]) => ({
    doc,
    score,
  })),
);

try {
  fc.assert(
    fc.property(
      fc.array(sourceWithScoreArb, { minLength: 1, maxLength: 20 }),
      thresholdArb,
      (sources, threshold) => {
        for (const { doc, score } of sources) {
          const result = classifySource(doc, score, threshold);
          const isMercado = doc.category?.toLowerCase() === "mercado";

          // Mercado special rule
          if (isMercado && score <= MERCADO_PURGE_THRESHOLD) {
            if (result.action !== "purge") return false;
            continue;
          }

          // General threshold rule
          if (score < threshold) {
            if (result.action !== "purge") return false;
          } else {
            if (result.action !== "keep") return false;
          }
        }
        return true;
      },
    ),
    { numRuns: 3000, verbose: 0 },
  );
  reportResult(
    true,
    "Batch classification of mixed sources correct (3000 runs)",
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Batch classification of mixed sources correct", msg);
}

// ── Property: Edge case — score exactly at threshold gets 'keep' ────────────────
console.log("\nProperty: Score exactly equal to threshold results in 'keep'\n");

try {
  fc.assert(
    fc.property(nonMercadoDocArb, thresholdArb, (doc, threshold) => {
      // Score equals threshold → should be 'keep' (>= check)
      const result = classifySource(doc, threshold, threshold);
      return result.action === "keep";
    }),
    { numRuns: 2000, verbose: 0 },
  );
  reportResult(true, "Score exactly at threshold yields 'keep' (2000 runs)");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  reportResult(false, "Score exactly at threshold yields 'keep'", msg);
}

// ─── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`);
console.log(
  `PROPERTY 3 (Threshold Classification): ${passed} passed, ${failed} failed`,
);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
