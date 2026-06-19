/**
 * RAG evaluation pipeline.
 * Benchmarks RAG responses against a golden dataset, produces a composite
 * score in [0.0, 1.0], and gates deployments when score < 0.7.
 */

import { retrieveContext, type RAGChunk } from "../../src/lib/rag/retrieval";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Single evaluation case from the golden benchmark dataset. */
export interface BenchmarkCase {
  question: string;
  expected: string;
  domain?: string;
}

/** Detail record for a single evaluated case. */
export interface EvaluationDetail {
  question: string;
  expected: string;
  actual: string;
  score: number;
}

/** Result of the full evaluation pipeline run. */
export interface EvaluationResult {
  composite_score: number; // 0.0 - 1.0
  passed: boolean; // score >= 0.7
  details: EvaluationDetail[];
}

/** Alert payload emitted to Command Center when score < 0.7. */
export interface CommandCenterAlert {
  type: "rag_quality_gate_failure";
  composite_score: number;
  threshold: number;
  timestamp: string;
  details: EvaluationDetail[];
}

/** Options for configuring the evaluation run. */
export interface EvaluationOptions {
  /** Minimum score to pass the gate (default: 0.7). */
  threshold?: number;
  /** Number of chunks to retrieve per query (default: 5). */
  retrievalLimit?: number;
  /** Minimum similarity for retrieval (default: 0.35). */
  retrievalThreshold?: number;
  /** Custom Command Center alert handler. */
  onAlert?: (_alert: CommandCenterAlert) => Promise<void>;
  /** Custom retrieval function for testing. */
  retrieveFn?: (
    _query: string,
    _options: { category?: string; limit?: number; threshold?: number },
  ) => Promise<{ chunks: RAGChunk[]; cacheHit: boolean }>;
}

// ----------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------

/** Minimum similarity threshold for retrieval (gate-level default). */
const DEFAULT_GATE_THRESHOLD = 0.7;
const DEFAULT_RETRIEVAL_LIMIT = 5;
const DEFAULT_RETRIEVAL_THRESHOLD = 0.35;

/**
 * Compute relevance score for a single case.
 * Measures how well the retrieved content matches the expected answer.
 * Returns a score in [0.0, 1.0].
 */
export function computeCaseScore(expected: string, chunks: RAGChunk[]): number {
  if (chunks.length === 0) return 0;

  const expectedTokens = tokenize(expected);
  if (expectedTokens.length === 0) return 0;

  // Combine all retrieved chunk content
  const retrievedContent = chunks.map((c) => c.content).join(" ");
  const retrievedLower = retrievedContent.toLowerCase();

  // Token overlap score: fraction of expected tokens found in retrieved content
  let matches = 0;
  for (const token of expectedTokens) {
    if (retrievedLower.includes(token)) {
      matches += 1;
    }
  }
  const overlapScore = matches / expectedTokens.length;

  // Similarity boost from top chunk (normalized to 0-1 range)
  const topSimilarity = chunks[0].similarity;

  // Weighted combination: 60% token overlap + 40% vector similarity
  const rawScore = overlapScore * 0.6 + topSimilarity * 0.4;

  return clampScore(rawScore);
}

/**
 * Compute the composite score from individual case scores.
 * Returns the arithmetic mean clamped to [0.0, 1.0].
 */
export function computeCompositeScore(scores: number[]): number {
  if (scores.length === 0) return 0;

  const sum = scores.reduce((acc, s) => acc + s, 0);
  const mean = sum / scores.length;

  return clampScore(mean);
}

/**
 * Clamp a score to the [0.0, 1.0] range.
 */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// ----------------------------------------------------------------
// Gate Logic
// ----------------------------------------------------------------

/**
 * Determine if a composite score passes the deployment gate.
 */
export function passesGate(
  compositeScore: number,
  threshold: number = DEFAULT_GATE_THRESHOLD,
): boolean {
  return compositeScore >= threshold;
}

/**
 * Build a Command Center alert for a failed gate.
 */
export function buildAlert(
  compositeScore: number,
  threshold: number,
  details: EvaluationDetail[],
): CommandCenterAlert {
  return {
    type: "rag_quality_gate_failure",
    composite_score: compositeScore,
    threshold,
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Emit alert to Command Center.
 * Default implementation logs a warning; override via options.onAlert for real integration.
 */
export async function emitAlert(
  alert: CommandCenterAlert,
  handler?: (_alert: CommandCenterAlert) => Promise<void>,
): Promise<void> {
  if (handler) {
    await handler(alert);
    return;
  }

  // Default stub: log to console. In production, this would POST to the Command Center API.
  console.warn(
    `[RAG Evaluation] DEPLOYMENT BLOCKED — composite_score=${alert.composite_score.toFixed(3)} ` +
      `(threshold=${alert.threshold}). Alert emitted at ${alert.timestamp}.`,
  );
}

// ----------------------------------------------------------------
// Pipeline
// ----------------------------------------------------------------

/**
 * Run the full RAG evaluation pipeline against a golden benchmark dataset.
 *
 * 1. For each benchmark case, retrieves RAG chunks using the query
 * 2. Scores each case by comparing retrieved content to expected answer
 * 3. Computes a composite score (mean of all case scores) in [0.0, 1.0]
 * 4. If score < threshold (default 0.7): blocks deployment and emits alert
 *
 * @param dataset - Golden benchmark cases to evaluate against
 * @param options - Configuration options for the evaluation run
 * @returns EvaluationResult with composite score, pass/fail, and details
 */
export async function runEvaluationPipeline(
  dataset: BenchmarkCase[],
  options: EvaluationOptions = {},
): Promise<EvaluationResult> {
  const threshold = options.threshold ?? DEFAULT_GATE_THRESHOLD;
  const retrievalLimit = options.retrievalLimit ?? DEFAULT_RETRIEVAL_LIMIT;
  const retrievalThreshold =
    options.retrievalThreshold ?? DEFAULT_RETRIEVAL_THRESHOLD;
  const retrieve = options.retrieveFn ?? retrieveContext;

  const details: EvaluationDetail[] = [];

  for (const benchmarkCase of dataset) {
    const { chunks } = await retrieve(benchmarkCase.question, {
      category: benchmarkCase.domain,
      limit: retrievalLimit,
      threshold: retrievalThreshold,
    });

    const actual =
      chunks.length > 0 ? chunks.map((c) => c.content).join(" | ") : "";

    const score = computeCaseScore(benchmarkCase.expected, chunks);

    details.push({
      question: benchmarkCase.question,
      expected: benchmarkCase.expected,
      actual,
      score: clampScore(score),
    });
  }

  const scores = details.map((d) => d.score);
  const composite_score = computeCompositeScore(scores);
  const passed = passesGate(composite_score, threshold);

  // Gate logic: emit alert and block deployment when below threshold
  if (!passed) {
    const alert = buildAlert(composite_score, threshold, details);
    await emitAlert(alert, options.onAlert);
  }

  return {
    composite_score,
    passed,
    details,
  };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Simple tokenizer for scoring. Splits text into lowercase tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}
