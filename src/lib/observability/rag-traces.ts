export interface RagTracePerformance {
  routing_ms: number;
  retrieval_ms: number;
  prompt_build_ms: number;
  llm_ms: number;
  llm_primary_ms: number;
  llm_fallback_ms: number;
  persistence_ms: number;
  verifier_ms: number;
  total_ms: number;
  llm_model_used: string;
  llm_path: string;
  used_fallback_model: boolean;
  retrieval_cache_hit: boolean;
  response_cache_hit: boolean;
  guard_triggered: boolean;
  tool_used: string | null;
}

export interface RagTraceRecord {
  requestId: string;
  timestamp: string;
  success: boolean;
  queryLength: number;
  userId: string | null;
  conversationId: string | null;
  primarySpecialist: string | null;
  groundingConfidence: "high" | "medium" | "low" | "none" | null;
  citations: number;
  alerts: number;
  error: string | null;
  performance: RagTracePerformance | null;
}

interface RagTraceSummary {
  total: number;
  successRate: number;
  avgTotalMs: number;
  avgRetrievalMs: number;
  avgLlmMs: number;
  lowEvidenceRate: number;
  failedCount: number;
}

const TRACE_BUFFER_MAX = Number.parseInt(process.env.OBS_RAG_TRACE_BUFFER_MAX ?? "200", 10);

const traceBuffer: RagTraceRecord[] = [];

export function addRagTrace(trace: RagTraceRecord): void {
  traceBuffer.unshift(trace);
  if (traceBuffer.length > TRACE_BUFFER_MAX) {
    traceBuffer.length = TRACE_BUFFER_MAX;
  }
}

export function listRagTraces(limit = 30): RagTraceRecord[] {
  return traceBuffer.slice(0, limit);
}

export function summarizeRagTraces(limit = 100): RagTraceSummary {
  const traces = traceBuffer.slice(0, limit);
  if (traces.length === 0) {
    return {
      total: 0,
      successRate: 0,
      avgTotalMs: 0,
      avgRetrievalMs: 0,
      avgLlmMs: 0,
      lowEvidenceRate: 0,
      failedCount: 0,
    };
  }

  const successCount = traces.filter((trace) => trace.success).length;
  const failedCount = traces.length - successCount;
  const lowEvidenceCount = traces.filter(
    (trace) => trace.groundingConfidence === "low" || trace.groundingConfidence === "none"
  ).length;

  const totals = traces.reduce(
    (acc, trace) => {
      acc.totalMs += trace.performance?.total_ms ?? 0;
      acc.retrievalMs += trace.performance?.retrieval_ms ?? 0;
      acc.llmMs += trace.performance?.llm_ms ?? 0;
      return acc;
    },
    { totalMs: 0, retrievalMs: 0, llmMs: 0 }
  );

  return {
    total: traces.length,
    successRate: successCount / traces.length,
    avgTotalMs: totals.totalMs / traces.length,
    avgRetrievalMs: totals.retrievalMs / traces.length,
    avgLlmMs: totals.llmMs / traces.length,
    lowEvidenceRate: lowEvidenceCount / traces.length,
    failedCount,
  };
}
