/**
 * Unit tests for the RAG evaluation pipeline module.
 * Validates scoring, gating, and alert logic.
 */

import {
  clampScore,
  computeCaseScore,
  computeCompositeScore,
  passesGate,
  buildAlert,
  runEvaluationPipeline,
  type BenchmarkCase,
  type CommandCenterAlert,
} from "../../lib/rag/evaluation-pipeline";
import type { RAGChunk } from "../../src/lib/rag/retrieval";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function makeChunk(content: string, similarity: number): RAGChunk {
  return {
    id: `chunk-${Math.random().toString(36).slice(2, 8)}`,
    document_id: "doc-1",
    content,
    metadata: {
      title: "Test Document",
      category: "fiscal",
      source_url: "https://example.com",
    },
    similarity,
  };
}

function mockRetrieveFn(chunks: RAGChunk[]) {
  return async () => ({ chunks, cacheHit: false });
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${description}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${description}`);
  }
}

function assertApprox(
  actual: number,
  expected: number,
  tolerance: number,
  description: string,
): void {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    `${description} (actual=${actual.toFixed(4)}, expected=${expected.toFixed(4)})`,
  );
}

async function main(): Promise<void> {
  console.log("=== RAG Evaluation Pipeline Tests ===\n");

  // --- clampScore ---
  console.log("clampScore:");
  assert(clampScore(0.5) === 0.5, "keeps value in range");
  assert(clampScore(-0.1) === 0, "clamps negative to 0");
  assert(clampScore(1.5) === 1, "clamps above 1 to 1");
  assert(clampScore(0) === 0, "keeps 0");
  assert(clampScore(1) === 1, "keeps 1");
  assert(clampScore(NaN) === 0, "NaN becomes 0");
  assert(clampScore(Infinity) === 0, "Infinity becomes 0");
  assert(clampScore(-Infinity) === 0, "-Infinity becomes 0");

  // --- computeCompositeScore ---
  console.log("\ncomputeCompositeScore:");
  assert(computeCompositeScore([]) === 0, "empty array returns 0");
  assertApprox(
    computeCompositeScore([0.8, 0.6]),
    0.7,
    0.001,
    "mean of [0.8, 0.6] = 0.7",
  );
  assertApprox(computeCompositeScore([1, 1, 1]), 1, 0.001, "all 1s returns 1");
  assertApprox(computeCompositeScore([0, 0, 0]), 0, 0.001, "all 0s returns 0");
  assertApprox(
    computeCompositeScore([0.5]),
    0.5,
    0.001,
    "single value returns itself",
  );

  // --- passesGate ---
  console.log("\npassesGate:");
  assert(passesGate(0.7) === true, "0.7 passes default threshold");
  assert(passesGate(0.8) === true, "0.8 passes default threshold");
  assert(passesGate(0.69) === false, "0.69 fails default threshold");
  assert(passesGate(0) === false, "0 fails");
  assert(passesGate(1) === true, "1 passes");
  assert(passesGate(0.5, 0.5) === true, "0.5 passes custom threshold 0.5");
  assert(passesGate(0.49, 0.5) === false, "0.49 fails custom threshold 0.5");

  // --- buildAlert ---
  console.log("\nbuildAlert:");
  const alert = buildAlert(0.45, 0.7, []);
  assert(alert.type === "rag_quality_gate_failure", "alert type is correct");
  assert(alert.composite_score === 0.45, "alert score matches");
  assert(alert.threshold === 0.7, "alert threshold matches");
  assert(
    typeof alert.timestamp === "string" && alert.timestamp.length > 0,
    "alert has timestamp",
  );

  // --- computeCaseScore ---
  console.log("\ncomputeCaseScore:");
  assert(
    computeCaseScore("plazos IVA trimestral", []) === 0,
    "no chunks returns 0",
  );
  {
    const chunks = [
      makeChunk(
        "Los plazos de presentacion del IVA trimestral son trimestrales",
        0.85,
      ),
    ];
    const score = computeCaseScore("plazos IVA trimestral", chunks);
    assert(score > 0.5, `matching content scores high (${score.toFixed(3)})`);
    assert(score <= 1, "score does not exceed 1");
  }
  {
    const chunks = [
      makeChunk("Receta de paella valenciana con mariscos frescos", 0.1),
    ];
    const score = computeCaseScore("plazos IVA trimestral", chunks);
    assert(
      score < 0.5,
      `non-matching content scores low (${score.toFixed(3)})`,
    );
  }

  // --- runEvaluationPipeline ---
  console.log("\nrunEvaluationPipeline:");

  // Test with perfect retrieval
  {
    const dataset: BenchmarkCase[] = [
      {
        question: "plazos del IVA",
        expected: "plazos IVA trimestral presentacion",
        domain: "fiscal",
      },
      {
        question: "cuota autonomos",
        expected: "cuota cero autonomos baleares",
        domain: "fiscal",
      },
    ];
    const highChunks = [
      makeChunk(
        "Los plazos del IVA trimestral y su presentacion ante la AEAT",
        0.92,
      ),
      makeChunk(
        "La cuota cero para nuevos autonomos en Baleares permite exencion",
        0.88,
      ),
    ];
    const result = await runEvaluationPipeline(dataset, {
      retrieveFn: mockRetrieveFn(highChunks),
    });
    assert(result.composite_score >= 0, "composite score >= 0");
    assert(result.composite_score <= 1, "composite score <= 1");
    assert(result.details.length === 2, "two detail entries");
    assert(
      result.passed === result.composite_score >= 0.7,
      "passed is consistent with score",
    );
  }

  // Test gate logic: low score triggers alert
  {
    const dataset: BenchmarkCase[] = [
      {
        question: "plazos del IVA",
        expected: "plazos IVA trimestral",
        domain: "fiscal",
      },
    ];
    let alertEmitted = false;
    let emittedAlert: CommandCenterAlert | null = null;

    const result = await runEvaluationPipeline(dataset, {
      retrieveFn: mockRetrieveFn([]), // No chunks = score 0
      onAlert: async (alert) => {
        alertEmitted = true;
        emittedAlert = alert;
      },
    });
    assert(result.composite_score === 0, "zero chunks produces score 0");
    assert(result.passed === false, "zero score fails gate");
    assert(alertEmitted === true, "alert was emitted on failure");
    assert(
      emittedAlert !== null && emittedAlert.type === "rag_quality_gate_failure",
      "alert has correct type",
    );
  }

  // Test gate logic: high score does NOT trigger alert
  {
    const dataset: BenchmarkCase[] = [
      { question: "IVA", expected: "IVA trimestral", domain: "fiscal" },
    ];
    let alertEmitted = false;

    const highChunks = [
      makeChunk("IVA trimestral obligaciones fiscales presentacion", 0.95),
    ];
    const result = await runEvaluationPipeline(dataset, {
      retrieveFn: mockRetrieveFn(highChunks),
      onAlert: async () => {
        alertEmitted = true;
      },
    });
    assert(result.passed === true, "high score passes gate");
    assert(alertEmitted === false, "no alert emitted on pass");
  }

  // Test composite score is always in [0, 1] even with extreme inputs
  {
    const dataset: BenchmarkCase[] = Array.from({ length: 10 }, (_, i) => ({
      question: `query ${i}`,
      expected: `expected ${i}`,
    }));
    const result = await runEvaluationPipeline(dataset, {
      retrieveFn: mockRetrieveFn([makeChunk("random content", 1.5)]),
    });
    assert(
      result.composite_score >= 0,
      "composite always >= 0 with high similarity",
    );
    assert(
      result.composite_score <= 1,
      "composite always <= 1 with high similarity",
    );
  }

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
