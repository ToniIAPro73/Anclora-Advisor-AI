/**
 * Property-based test: RAG Evaluation Score Bounded and Gated (Property 7)
 *
 * **Validates: Requirements 7.2, 7.3**
 *
 * For any evaluation pipeline execution, the composite score shall be in
 * the range [0.0, 1.0], and if the score is below 0.7 then the deployment
 * gate shall be blocked and an alert emitted.
 *
 * Run: npx tsx tests/unit/test-evaluation-pipeline-property.ts
 */

import * as fc from "fast-check";
import {
  clampScore,
  computeCompositeScore,
  passesGate,
} from "../../lib/rag/evaluation-pipeline";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

let passed = 0;
let failed = 0;

function reportProperty(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

// ----------------------------------------------------------------
// Property Tests
// ----------------------------------------------------------------

console.log("\nProperty 7: RAG Evaluation Score Bounded and Gated\n");

// Property 7.1: clampScore always returns a value in [0.0, 1.0]
reportProperty(
  "clampScore always returns value in [0.0, 1.0] for arbitrary doubles",
  () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: false, noDefaultInfinity: false }),
        (value: number) => {
          const result = clampScore(value);
          return result >= 0.0 && result <= 1.0;
        },
      ),
      { numRuns: 10000 },
    );
  },
);

// Property 7.2: clampScore handles NaN and Infinity → 0
reportProperty("clampScore maps NaN and Infinity to 0", () => {
  fc.assert(
    fc.property(fc.constantFrom(NaN, Infinity, -Infinity), (value: number) => {
      const result = clampScore(value);
      return result === 0;
    }),
    { numRuns: 100 },
  );
});

// Property 7.3: computeCompositeScore always returns value in [0.0, 1.0]
// for arbitrary score arrays including edge cases
reportProperty(
  "computeCompositeScore always returns value in [0.0, 1.0] for arbitrary score arrays",
  () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({
            noNaN: false,
            noDefaultInfinity: false,
            min: -1e10,
            max: 1e10,
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (scores: number[]) => {
          const result = computeCompositeScore(scores);
          return result >= 0.0 && result <= 1.0;
        },
      ),
      { numRuns: 10000 },
    );
  },
);

// Property 7.4: computeCompositeScore for arrays of valid scores [0,1]
// always produces a result in [0.0, 1.0]
reportProperty(
  "computeCompositeScore of valid [0,1] scores is always in [0.0, 1.0]",
  () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
          minLength: 1,
          maxLength: 100,
        }),
        (scores: number[]) => {
          const result = computeCompositeScore(scores);
          return result >= 0.0 && result <= 1.0;
        },
      ),
      { numRuns: 10000 },
    );
  },
);

// Property 7.5: Gate is blocked (passed=false) when composite < 0.7
reportProperty("passesGate returns false when composite score < 0.7", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 0.6999999999, noNaN: true }),
      (score: number) => {
        return passesGate(score) === false;
      },
    ),
    { numRuns: 10000 },
  );
});

// Property 7.6: Gate passes (passed=true) when composite >= 0.7
reportProperty("passesGate returns true when composite score >= 0.7", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.7, max: 1.0, noNaN: true }),
      (score: number) => {
        return passesGate(score) === true;
      },
    ),
    { numRuns: 10000 },
  );
});

// Property 7.7: End-to-end — compositeScore + gate consistency
// If all individual scores are below 0.7, the gate should block
reportProperty(
  "computeCompositeScore + passesGate are consistent: composite < 0.7 implies gate blocked",
  () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
          minLength: 1,
          maxLength: 50,
        }),
        (scores: number[]) => {
          const composite = computeCompositeScore(scores);
          const gateResult = passesGate(composite);
          // Verify consistency: gateResult === (composite >= 0.7)
          return gateResult === composite >= 0.7;
        },
      ),
      { numRuns: 10000 },
    );
  },
);

// Property 7.8: passesGate respects custom thresholds
reportProperty("passesGate respects custom threshold parameter", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0.01, max: 0.99, noNaN: true }),
      (score: number, threshold: number) => {
        const result = passesGate(score, threshold);
        return result === score >= threshold;
      },
    ),
    { numRuns: 10000 },
  );
});

// ----------------------------------------------------------------
// Summary
// ----------------------------------------------------------------

console.log(
  `\n${passed + failed} properties tested — ${passed} passed, ${failed} failed\n`,
);
if (failed > 0) process.exit(1);
