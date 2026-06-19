/**
 * Territorial Intelligence Ingestion Pipeline
 *
 * Watches the designated ingestion folder, validates scope governance
 * (notebook_id, domain, reason_for_fit), and indexes valid documents
 * into the RAG knowledge base. Rejects documents that fail scope
 * validation or have low relevance.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import {
  validateNotebookScope,
  type IngestSourcePayload,
  type NotebookDomain,
} from "../../src/lib/rag/governance";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface IngestionDocument {
  document_id: string;
  notebook_id: string;
  domain: string;
  reason_for_fit: string;
  title: string;
  content: string;
  source_url?: string;
}

export interface IngestionResult {
  document_id: string;
  notebook_id: string;
  domain: string;
  reason_for_fit: string;
  status: "ingested" | "rejected";
  rejection_reason?: "SOURCE_SCOPE_MISMATCH" | "LOW_RELEVANCE";
}

export interface IngestionPipelineOptions {
  /** Minimum relevance score threshold for ingestion (default: 0.7) */
  relevanceThreshold?: number;
  /** Callback to compute relevance score for a document */
  computeRelevance?: (_document: IngestionDocument) => Promise<number>;
  /** Callback to persist the ingested document into the RAG store */
  persistDocument?: (_document: IngestionDocument) => Promise<void>;
}

// ----------------------------------------------------------------
// Notebook scope definitions (canonical mapping)
// ----------------------------------------------------------------

const NOTEBOOK_SCOPE_MAP: Record<
  string,
  { domain: NotebookDomain; title: string }
> = {
  NOTEBOOK_01: {
    domain: "fiscal",
    title: "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
  },
  NOTEBOOK_02: {
    domain: "laboral",
    title: "ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL",
  },
  NOTEBOOK_03: {
    domain: "mercado",
    title: "ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO",
  },
  // Also accept full canonical names
  ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL: {
    domain: "fiscal",
    title: "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
  },
  ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL: {
    domain: "laboral",
    title: "ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL",
  },
  ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO: {
    domain: "mercado",
    title: "ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO",
  },
};

// ----------------------------------------------------------------
// Minimum reason_for_fit length
// ----------------------------------------------------------------

const MIN_REASON_FOR_FIT_LENGTH = 24;

// ----------------------------------------------------------------
// Core validation
// ----------------------------------------------------------------

/**
 * Validates whether a document conforms to the NotebookLM scope governance.
 * Returns true if valid, false otherwise.
 */
export function validateScopeGovernance(document: IngestionDocument): {
  valid: boolean;
  reason?: "SOURCE_SCOPE_MISMATCH";
} {
  const notebookConfig = NOTEBOOK_SCOPE_MAP[document.notebook_id];

  // Unknown notebook_id
  if (!notebookConfig) {
    return { valid: false, reason: "SOURCE_SCOPE_MISMATCH" };
  }

  // Domain mismatch: declared domain doesn't match notebook's allowed scope
  if (document.domain !== notebookConfig.domain) {
    return { valid: false, reason: "SOURCE_SCOPE_MISMATCH" };
  }

  // Missing or insufficient reason_for_fit
  if (
    !document.reason_for_fit ||
    document.reason_for_fit.trim().length < MIN_REASON_FOR_FIT_LENGTH
  ) {
    return { valid: false, reason: "SOURCE_SCOPE_MISMATCH" };
  }

  // Use the existing governance validation for content-level scope checking
  const sourcePayload: IngestSourcePayload = {
    title: document.title,
    url: document.source_url ?? null,
    content: document.content,
    reason_for_fit: document.reason_for_fit,
  };

  const result = validateNotebookScope(notebookConfig.title, document.domain, [
    sourcePayload,
  ]);

  if (!result.ok) {
    return { valid: false, reason: "SOURCE_SCOPE_MISMATCH" };
  }

  return { valid: true };
}

// ----------------------------------------------------------------
// Default relevance scoring
// ----------------------------------------------------------------

/**
 * Default relevance computation based on keyword density and content quality signals.
 * Returns a score between 0.0 and 1.0.
 */
export function computeDefaultRelevance(document: IngestionDocument): number {
  const notebookConfig = NOTEBOOK_SCOPE_MAP[document.notebook_id];
  if (!notebookConfig) return 0;

  const content = document.content.toLowerCase();
  const title = document.title.toLowerCase();
  const reasonForFit = document.reason_for_fit.toLowerCase();
  const combinedText = `${title} ${content} ${reasonForFit}`;

  // Base score from content length (penalize very short documents)
  const contentLength = document.content.trim().length;
  let score = 0;

  if (contentLength < 100) {
    score = 0.2;
  } else if (contentLength < 500) {
    score = 0.5;
  } else {
    score = 0.7;
  }

  // Boost for territorial intelligence signals
  const territorialSignals = [
    "mallorca",
    "baleares",
    "palma",
    "illes",
    "balear",
    "mercado inmobiliario",
    "valoracion",
    "valoración",
    "tendencia",
    "zona",
    "precio",
    "oferta",
    "demanda",
    "observatorio",
    "catastro",
    "cadastral",
  ];

  const signalHits = territorialSignals.filter((signal) =>
    combinedText.includes(signal),
  ).length;

  score += Math.min(signalHits * 0.05, 0.2);

  // Boost for reason_for_fit quality
  if (document.reason_for_fit.trim().length > 50) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

// ----------------------------------------------------------------
// Ingestion pipeline
// ----------------------------------------------------------------

/**
 * Processes a single territorial intelligence document through the ingestion pipeline.
 *
 * 1. Validates scope governance (notebook_id, domain, reason_for_fit)
 * 2. Computes relevance score
 * 3. Rejects if relevance < threshold (default 0.7)
 * 4. Persists to RAG knowledge base if all checks pass
 */
export async function ingestTerritorialDocument(
  document: IngestionDocument,
  options: IngestionPipelineOptions = {},
): Promise<IngestionResult> {
  const {
    relevanceThreshold = 0.7,
    computeRelevance,
    persistDocument,
  } = options;

  // Step 1: Validate scope governance
  const scopeCheck = validateScopeGovernance(document);
  if (!scopeCheck.valid) {
    return {
      document_id: document.document_id,
      notebook_id: document.notebook_id,
      domain: document.domain,
      reason_for_fit: document.reason_for_fit,
      status: "rejected",
      rejection_reason: scopeCheck.reason,
    };
  }

  // Step 2: Compute relevance score
  const relevanceScore = computeRelevance
    ? await computeRelevance(document)
    : computeDefaultRelevance(document);

  if (relevanceScore < relevanceThreshold) {
    return {
      document_id: document.document_id,
      notebook_id: document.notebook_id,
      domain: document.domain,
      reason_for_fit: document.reason_for_fit,
      status: "rejected",
      rejection_reason: "LOW_RELEVANCE",
    };
  }

  // Step 3: Persist document to RAG knowledge base
  if (persistDocument) {
    await persistDocument(document);
  }

  return {
    document_id: document.document_id,
    notebook_id: document.notebook_id,
    domain: document.domain,
    reason_for_fit: document.reason_for_fit,
    status: "ingested",
  };
}

/**
 * Processes a batch of territorial intelligence documents.
 * Each document is independently validated and ingested.
 * A single document failure does not block the batch.
 */
export async function ingestTerritorialBatch(
  documents: IngestionDocument[],
  options: IngestionPipelineOptions = {},
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const document of documents) {
    const result = await ingestTerritorialDocument(document, options);
    results.push(result);
  }

  return results;
}

/**
 * Watches a list of pending documents in the ingestion folder
 * and processes them through the pipeline.
 * This is the top-level entry point for the ingestion cron/watcher.
 */
export async function processIngestionFolder(
  pendingDocuments: IngestionDocument[],
  options: IngestionPipelineOptions = {},
): Promise<{
  results: IngestionResult[];
  summary: {
    total: number;
    ingested: number;
    rejected: number;
    rejectedByScopeMismatch: number;
    rejectedByLowRelevance: number;
  };
}> {
  const results = await ingestTerritorialBatch(pendingDocuments, options);

  const ingested = results.filter((r) => r.status === "ingested").length;
  const rejectedByScopeMismatch = results.filter(
    (r) =>
      r.status === "rejected" && r.rejection_reason === "SOURCE_SCOPE_MISMATCH",
  ).length;
  const rejectedByLowRelevance = results.filter(
    (r) => r.status === "rejected" && r.rejection_reason === "LOW_RELEVANCE",
  ).length;

  return {
    results,
    summary: {
      total: results.length,
      ingested,
      rejected: rejectedByScopeMismatch + rejectedByLowRelevance,
      rejectedByScopeMismatch,
      rejectedByLowRelevance,
    },
  };
}
