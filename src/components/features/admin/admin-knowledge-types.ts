"use client";

import type { AuditLogRecord } from "@/lib/audit/logs";

export interface AdminDocumentRecord {
  id: string;
  title: string;
  category: string | null;
  created_at: string;
  doc_metadata?: {
    notebook_id?: string | null;
    notebook_title?: string | null;
    jurisdiction?: string | null;
    topic?: string | null;
    reason_for_fit?: string | null;
  } | null;
}

export interface AdminIngestJobRecord {
  id: string;
  status: string;
  domain: string;
  notebook_title: string;
  source_count: number;
  documents_processed: number;
  chunks_inserted: number;
  replaced_documents: number;
  error_message: string | null;
  created_at: string;
}

export interface StatusResponse {
  success: boolean;
  counts: {
    documents: number;
    chunks: number;
    filteredDocuments?: number;
  };
  filters?: {
    domain: string;
    topic: string;
    query: string;
    limit: number;
    offset: number;
  };
  recentDocuments: AdminDocumentRecord[];
  recentJobs?: AdminIngestJobRecord[];
  error?: string;
}

export interface HardwareRuntimeGateSummary {
  decision: string;
  recommended_profile: string | null;
  reason: string;
  profiles?: Array<{
    profile: string;
    avg_chat_latency_ms: number | null;
    avg_embedding_latency_ms: number | null;
  }>;
}

export interface HardwareBaselineSummary {
  decision: string;
  checks: Array<{
    role: string;
    model: string;
    decision: string;
    quantization_level?: string;
    reason: string;
  }>;
}

export interface HardwareBenchmarkSummary {
  comparison_mode: string;
  profiles: Array<{
    profile: string;
    avg_chat_latency_ms: number | null;
    avg_embedding_latency_ms: number | null;
    configured_chat_models: string[];
    configured_embed_model: string;
  }>;
}

export interface ObservabilityTraceRecord {
  requestId: string;
  timestamp: string;
  success: boolean;
  queryLength: number;
  primarySpecialist: string | null;
  groundingConfidence: "high" | "medium" | "low" | "none" | null;
  citations: number;
  alerts: number;
  error: string | null;
  performance: {
    total_ms: number;
    retrieval_ms: number;
    llm_ms: number;
    llm_path: string;
    llm_model_used: string;
    tool_used: string | null;
  } | null;
}

export interface ObservabilityResponse {
  success: boolean;
  summary?: {
    total: number;
    successRate: number;
    avgTotalMs: number;
    avgRetrievalMs: number;
    avgLlmMs: number;
    lowEvidenceRate: number;
    failedCount: number;
  };
  traces?: ObservabilityTraceRecord[];
  hardware?: {
    runtimeGate?: HardwareRuntimeGateSummary | null;
    baseline?: HardwareBaselineSummary | null;
    benchmark?: HardwareBenchmarkSummary | null;
  };
  error?: string;
}

export interface AdminAuditLogsResponse {
  success: boolean;
  logs?: AuditLogRecord[];
  error?: string;
}

export interface IngestResponse {
  success: boolean;
  decision?: "GO" | "NO-GO";
  error?: string;
  code?: string;
  issues?: Array<{ code: string; message: string }>;
  result?: {
    documentsProcessed: number;
    chunksInserted: number;
    replacedDocuments: number;
  };
  jobId?: string;
  summary?: {
    sources: number;
    notebook_title: string;
    domain: string;
  };
}

export type NotebookPreset = {
  domain: "fiscal" | "laboral" | "mercado";
  notebookTitle: string;
  notebookId: string;
};
