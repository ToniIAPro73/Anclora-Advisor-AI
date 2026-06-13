import crypto from "node:crypto";
import { generateChatText } from "@/lib/ai/runtime";
import { log } from "@/lib/observability/logger";
import {
  buildLegalDocumentSystemPrompt,
  buildLegalDocumentUserPrompt,
} from "@/lib/rag/legal-document-validation-prompt";
import { retrieveContext } from "@/lib/rag/retrieval";
import type { RAGChunk, RetrievalResult } from "@/lib/rag/retrieval";
import { runDeterministicRules, computeRiskLevel } from "./deterministic-rules";
import { evaluateLegalSources } from "./source-quality";
import {
  buildIdempotencyKey,
  getCachedIdempotentResult,
  runWithLegalValidationResilience,
  setCachedIdempotentResult,
} from "./resilience";
import type {
  LegalDocumentAuditPayload,
  LegalSource,
  LegalDocumentValidationResponse,
  LegalDifference,
  LegalFinding,
  LegalRiskLevel,
  LegalReviewRequirement,
  LegalValidationStatus,
  NormalizedLegalDocumentValidationRequest,
  LegalDocumentValidationRequest,
} from "@/types/legal-document-validation";

const LEGAL_DISCLAIMER =
  "Este análisis es orientativo y no sustituye el asesoramiento de un abogado, notario o asesor cualificado. " +
  "Consulte con un profesional antes de firmar cualquier documento.";

const MIN_DOCUMENT_TEXT_LENGTH = 25;
const DEFAULT_ENGINE_VERSION = "legal-validation-v1";
const DEFAULT_PROMPT_VERSION = "legal-document-validation-prompt-v1";

// ── Dependencies (DI for testing) ─────────────────────────────────────────────

export interface LegalDocumentValidatorDependencies {
  retrieve: (_query: string, _options?: import("@/lib/rag/retrieval").RetrievalOptions) => Promise<RetrievalResult>;
  generate: typeof generateChatText;
  now: () => Date;
}

export const defaultLegalDocumentValidatorDependencies: LegalDocumentValidatorDependencies = {
  retrieve: retrieveContext,
  generate: generateChatText,
  now: () => new Date(),
};

export interface LegalDocumentValidatorResult {
  statusCode: number;
  body: LegalDocumentValidationResponse | { error: string };
  auditPayload?: LegalDocumentAuditPayload;
}

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeLegalDocumentRequest(
  raw: unknown,
): NormalizedLegalDocumentValidationRequest | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid JSON body" };
  }

  const body = raw as LegalDocumentValidationRequest;
  const documentText =
    (typeof body.currentText === "string" ? body.currentText : undefined) ??
    (typeof body.current_text === "string" ? body.current_text : undefined) ??
    (typeof body.documentText === "string" ? body.documentText : undefined) ??
    (typeof body.document_text === "string" ? body.document_text : undefined) ??
    "";

  if (documentText.trim().length < MIN_DOCUMENT_TEXT_LENGTH) {
    return { error: "documentText is too short or missing" };
  }

  return {
    documentId:
      (typeof body.documentId === "string" ? body.documentId : undefined) ??
      (typeof body.document_id === "string" ? body.document_id : undefined),
    templateId:
      (typeof body.templateId === "string" ? body.templateId : undefined) ??
      (typeof body.template_id === "string" ? body.template_id : undefined),
    templateVersionId:
      (typeof body.templateVersionId === "string" ? body.templateVersionId : undefined) ??
      (typeof body.template_version_id === "string" ? body.template_version_id : undefined),
    documentText,
    canonicalTemplate:
      (typeof body.canonicalText === "string" ? body.canonicalText : undefined) ??
      (typeof body.canonical_text === "string" ? body.canonical_text : undefined) ??
      (typeof body.canonicalTemplate === "string" ? body.canonicalTemplate : undefined) ??
      (typeof body.canonical_template === "string" ? body.canonical_template : undefined),
    documentType:
      (typeof body.documentType === "string" ? body.documentType : undefined) ??
      (typeof body.document_type === "string" ? body.document_type : undefined) ??
      "generico",
    operationType:
      (typeof body.operationType === "string" ? body.operationType : undefined) ??
      (typeof body.operation_type === "string" ? body.operation_type : undefined) ??
      "unknown",
    jurisdiction:
      typeof body.jurisdiction === "string" ? body.jurisdiction : "España",
    language: typeof body.language === "string" ? body.language : "es",
    variableSnapshot:
      body.variableSnapshot && typeof body.variableSnapshot === "object" && !Array.isArray(body.variableSnapshot)
        ? body.variableSnapshot
        : body.variable_snapshot && typeof body.variable_snapshot === "object" && !Array.isArray(body.variable_snapshot)
          ? body.variable_snapshot
          : {},
    sourceHints:
      Array.isArray(body.sourceHints)
        ? body.sourceHints.filter((hint): hint is string => typeof hint === "string")
        : Array.isArray(body.source_hints)
          ? body.source_hints.filter((hint): hint is string => typeof hint === "string")
          : [],
    requestId:
      (typeof body.requestId === "string" ? body.requestId : undefined) ??
      (typeof body.request_id === "string" ? body.request_id : undefined),
    orgId:
      (typeof body.orgId === "string" ? body.orgId : undefined) ??
      (typeof body.org_id === "string" ? body.org_id : undefined),
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
  };
}

// ── Main validator ────────────────────────────────────────────────────────────

export async function validateLegalDocument(
  rawBody: unknown,
  requestId: string,
  deps: LegalDocumentValidatorDependencies = defaultLegalDocumentValidatorDependencies,
): Promise<LegalDocumentValidatorResult> {
  const startedAt = Date.now();
  // Step 1: Normalize and validate input
  const normalized = normalizeLegalDocumentRequest(rawBody);
  if ("error" in normalized) {
    return { statusCode: 400, body: { error: normalized.error } };
  }
  const effectiveRequestId = normalized.requestId ?? requestId;
  const idempotencyKey = buildIdempotencyKey(rawBody, effectiveRequestId);
  const cached = getCachedIdempotentResult<LegalDocumentValidatorResult>(idempotencyKey);
  if (cached) return cached;

  // Step 2: Run deterministic rules (no LLM)
  const deterministicResult = runDeterministicRules(
    normalized.documentText,
    normalized.documentType,
    normalized.canonicalTemplate,
    normalized.variableSnapshot,
  );

  // Step 3: Build RAG query
  const ragQuery = buildRagQuery(normalized, deterministicResult.missingClauses);

  // Step 4: Retrieve legal context
  let ragChunks: RAGChunk[] = [];
  let ragSourcesUsed = 0;
  try {
    const ragResult: RetrievalResult = await deps.retrieve(ragQuery, { category: "legal", limit: 5, threshold: 0.65 });
    ragChunks = ragResult.chunks;
    ragSourcesUsed = ragChunks.length;
  } catch (err) {
    log("warn", "RAG retrieval failed — proceeding with empty context", requestId, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const sourceQuality = evaluateLegalSources(ragChunks, normalized.jurisdiction, deps.now());

  const ragContext = ragChunks
    .map((c) => `[${c.metadata?.title ?? "source"}]\n${c.content}`)
    .join("\n\n");

  // Step 5: Build prompts
  const systemPrompt = buildLegalDocumentSystemPrompt();
  const userPrompt = buildLegalDocumentUserPrompt(
    normalized,
    ragContext,
    deterministicResult.differences,
  );

  // Step 6: Call LLM with fallback
  let modelOutput = "";
  const modelName =
    process.env.ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MODEL?.trim() ||
    process.env.ADVISOR_CONTRACT_VALIDATOR_MODEL?.trim() ||
    process.env.OLLAMA_MODEL_PRIMARY?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    "llama3";

  try {
    modelOutput = await runWithLegalValidationResilience(
      () => deps.generate(
        modelName,
        systemPrompt,
        userPrompt,
        {
          maxTokens: readPositiveInt("ADVISOR_LEGAL_VALIDATION_MAX_TOKENS", readPositiveInt("ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MAX_TOKENS", 1500)),
          temperature: readNumber("ADVISOR_LEGAL_VALIDATION_TEMPERATURE", readNumber("ADVISOR_LEGAL_DOCUMENT_VALIDATOR_TEMPERATURE", 0)),
        },
      ),
    );
  } catch (err) {
    log("error", "LLM call failed — returning fallback response", requestId, {
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = buildFallbackResult(
      normalized,
      deterministicResult.differences,
      effectiveRequestId,
      modelName,
      sourceQuality.sources,
      deps.now(),
      Date.now() - startedAt,
      idempotencyKey,
    );
    setCachedIdempotentResult(idempotencyKey, fallback);
    return fallback;
  }

  // Step 7: Parse LLM response
  let parsed: ParsedModelResponse;
  const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log("warn", "LLM response contains no JSON — returning fallback", requestId);
    const fallback = buildFallbackResult(
      normalized,
      deterministicResult.differences,
      effectiveRequestId,
      modelName,
      sourceQuality.sources,
      deps.now(),
      Date.now() - startedAt,
      idempotencyKey,
    );
    setCachedIdempotentResult(idempotencyKey, fallback);
    return fallback;
  }
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    log("warn", "LLM response parse failed — returning fallback", requestId);
    const fallback = buildFallbackResult(
      normalized,
      deterministicResult.differences,
      effectiveRequestId,
      modelName,
      sourceQuality.sources,
      deps.now(),
      Date.now() - startedAt,
      idempotencyKey,
    );
    setCachedIdempotentResult(idempotencyKey, fallback);
    return fallback;
  }

  // Step 8: Merge deterministic differences with LLM findings and finalize
  const llmFindings = normalizeLegalFindings(parsed.findings);
  const sourceFindings = sourceQuality.findings;
  const unresolvedPlaceholders = allPlaceholderValues(deterministicResult.differences);
  const allDifferences = deterministicResult.differences;

  const deterministicRiskLevel = computeRiskLevel(allDifferences);
  const llmStatus = normalizeStatus(parsed.status);
  const llmConfidence = Math.max(0, clampConfidence(parsed.confidence) - sourceQuality.confidencePenalty);

  let finalStatus: LegalValidationStatus =
    llmStatus === "error" ||
    deterministicResult.placeholdersFound > 0 ||
    !sourceQuality.canApprove
      ? "review_required"
      : canonicalizeApprovedStatus(llmStatus, llmFindings, allDifferences);

  const allFindings = [...sourceFindings, ...llmFindings];
  const finalRiskLevel = mergeRiskLevel(deterministicRiskLevel, allFindings);
  const blockSigning =
    finalRiskLevel === "critical" ||
    finalRiskLevel === "high" ||
    deterministicResult.placeholdersFound > 0 ||
    !sourceQuality.canApprove ||
    allFindings.some((f) => f.block_signing);
  if (blockSigning && finalStatus === "approved") {
    finalStatus = "review_required";
  }

  const reviewRequirement = deriveReviewRequirement(finalRiskLevel, blockSigning);

  const response: LegalDocumentValidationResponse = {
    status: finalStatus,
    block_signing: blockSigning,
    risk_level: finalRiskLevel,
    review_requirement: reviewRequirement,
    confidence: llmConfidence,
    summary: typeof parsed.summary === "string" ? parsed.summary : buildDefaultSummary(llmFindings, allDifferences, finalRiskLevel),
    findings: allFindings,
    differences: allDifferences,
    required_actions: Array.isArray(parsed.required_actions)
      ? parsed.required_actions.filter((a): a is string => typeof a === "string")
      : [],
    unresolved_placeholders: unresolvedPlaceholders,
    missing_clauses: deterministicResult.missingClauses,
    legal_disclaimer: LEGAL_DISCLAIMER,
    sources: sourceQuality.sources,
    document_id: normalized.documentId,
    template_id: normalized.templateId,
    template_version_id: normalized.templateVersionId,
    validation_timestamp: deps.now().toISOString(),
    rag_sources_used: ragSourcesUsed,
    request_id: effectiveRequestId,
    engine_version: engineVersion(),
    prompt_version: promptVersion(),
    idempotency_key: idempotencyKey,
    fallback_used: false,
  };
  if (blockSigning && response.required_actions.length === 0) {
    response.required_actions = ["Route the document to legal review before signature."];
  }

  // Step 9: Build audit payload (privacy-safe)
  const auditPayload = buildAuditPayload(normalized, response, effectiveRequestId, modelName, Date.now() - startedAt);

  log("info", "Legal document validation complete", requestId, {
    risk_level: finalRiskLevel,
    block_signing: blockSigning,
    findings_count: llmFindings.length,
    differences_count: allDifferences.length,
    rag_sources_used: ragSourcesUsed,
  });

  const result = { statusCode: 200, body: response, auditPayload };
  setCachedIdempotentResult(idempotencyKey, result);
  return result;
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function buildFallbackResult(
  req: NormalizedLegalDocumentValidationRequest,
  deterministicDiffs: LegalDifference[],
  requestId: string,
  modelName: string,
  sources: LegalSource[],
  now: Date,
  durationMs: number,
  idempotencyKey: string,
): LegalDocumentValidatorResult {
  const deterministicRiskLevel = computeRiskLevel(deterministicDiffs);

  const response: LegalDocumentValidationResponse = {
    status: "review_required",
    block_signing: true,
    risk_level: deterministicRiskLevel,
    review_requirement: "required",
    confidence: 0,
    summary:
      "No fue posible completar el análisis automático. El documento requiere revisión manual por un profesional.",
    findings: [],
    differences: deterministicDiffs,
    required_actions: [
      "Revisar el documento con un abogado o asesor jurídico antes de proceder.",
    ],
    unresolved_placeholders: allPlaceholderValues(deterministicDiffs),
    missing_clauses: [],
    legal_disclaimer: LEGAL_DISCLAIMER,
    sources,
    document_id: req.documentId,
    template_id: req.templateId,
    template_version_id: req.templateVersionId,
    validation_timestamp: now.toISOString(),
    rag_sources_used: sources.length,
    request_id: requestId,
    engine_version: engineVersion(),
    prompt_version: promptVersion(),
    idempotency_key: idempotencyKey,
    fallback_used: true,
  };

  const auditPayload = buildAuditPayload(req, response, requestId, modelName, durationMs);
  return { statusCode: 200, body: response, auditPayload };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ParsedModelResponse {
  status?: unknown;
  confidence?: unknown;
  summary?: unknown;
  findings?: unknown;
  required_actions?: unknown;
  missing_clauses?: unknown;
}

function normalizeLegalFindings(raw: unknown): LegalFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      severity: normalizeRiskLevel(f.severity),
      category: typeof f.category === "string" ? f.category : "general",
      title: typeof f.title === "string" ? f.title : "Hallazgo sin título",
      description: typeof f.description === "string" ? f.description : "",
      recommendation: typeof f.recommendation === "string" ? f.recommendation : "",
      block_signing:
        normalizeRiskLevel(f.severity) === "critical" || f.block_signing === true,
      evidence: typeof f.evidence === "string" ? f.evidence : undefined,
      source_reference:
        typeof f.source_reference === "string" ? f.source_reference : undefined,
    }));
}

function normalizeRiskLevel(raw: unknown): LegalRiskLevel {
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") return raw;
  return "medium";
}

function normalizeStatus(raw: unknown): LegalValidationStatus {
  if (
    raw === "approved" ||
    raw === "approved_with_warnings" ||
    raw === "review_required" ||
    raw === "rejected" ||
    raw === "ok" ||
    raw === "error"
  ) return raw;
  return "review_required";
}

function clampConfidence(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function mergeRiskLevel(
  deterministicLevel: LegalRiskLevel,
  findings: LegalFinding[],
): LegalRiskLevel {
  const llmLevel = computeRiskLevel(
    findings.map((f) => ({ severity: f.severity } as LegalDifference)),
  );
  const order: LegalRiskLevel[] = ["low", "medium", "high", "critical"];
  return order[Math.max(order.indexOf(deterministicLevel), order.indexOf(llmLevel))];
}

function deriveReviewRequirement(
  riskLevel: LegalRiskLevel,
  blockSigning: boolean,
): LegalReviewRequirement {
  if (riskLevel === "critical" || blockSigning) return "legal_review";
  if (riskLevel === "high") return "legal_review";
  if (riskLevel === "medium") return "internal_review";
  return "none";
}

function canonicalizeApprovedStatus(
  status: LegalValidationStatus,
  findings: LegalFinding[],
  differences: LegalDifference[],
): LegalValidationStatus {
  if (status === "approved" || status === "approved_with_warnings" || status === "rejected") {
    return status;
  }
  if (status === "ok") {
    return findings.length > 0 || differences.length > 0 ? "approved_with_warnings" : "approved";
  }
  return "review_required";
}

function allPlaceholderValues(differences: LegalDifference[]): string[] {
  return differences
    .filter((difference) => difference.type === "placeholder_detected")
    .map((difference) => difference.submitted_value ?? difference.field ?? "placeholder")
    .filter((value, index, values) => values.indexOf(value) === index);
}

function buildDefaultSummary(
  findings: LegalFinding[],
  differences: LegalDifference[],
  riskLevel: LegalRiskLevel,
): string {
  const total = findings.length + differences.length;
  if (total === 0) return "Análisis completado. No se detectaron problemas significativos.";
  return `Análisis completado. Se detectaron ${findings.length} hallazgo${findings.length !== 1 ? "s" : ""} y ${differences.length} diferencia${differences.length !== 1 ? "s" : ""}. Nivel de riesgo: ${riskLevel}.`;
}

function buildAuditPayload(
  req: NormalizedLegalDocumentValidationRequest,
  response: LegalDocumentValidationResponse,
  requestId: string,
  modelName: string,
  durationMs: number,
): LegalDocumentAuditPayload {
  return {
    request_id: requestId,
    document_id: req.documentId,
    template_version_id: req.templateVersionId,
    caller: typeof req.metadata.caller === "string" ? req.metadata.caller : undefined,
    document_type: req.documentType,
    jurisdiction: req.jurisdiction,
    model_used: modelName,
    prompt_version: response.prompt_version,
    engine_version: response.engine_version,
    risk_level: response.risk_level,
    block_signing: response.block_signing,
    status: response.status,
    rag_sources_used: response.rag_sources_used ?? 0,
    source_count: response.sources.length,
    source_statuses: response.sources.map((source) => source.status),
    document_text_hash: sha256(req.documentText),
    canonical_template_hash: req.canonicalTemplate
      ? sha256(req.canonicalTemplate)
      : undefined,
    variable_snapshot_hash: Object.keys(req.variableSnapshot).length > 0
      ? sha256(JSON.stringify(req.variableSnapshot))
      : undefined,
    findings_count: response.findings.length,
    differences_count: response.differences.length,
    duration_ms: durationMs,
    fallback_used: response.fallback_used,
    org_id: req.orgId,
  };
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return isFinite(n) && n > 0 ? n : fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return isFinite(n) ? n : fallback;
}

function buildRagQuery(
  req: NormalizedLegalDocumentValidationRequest,
  missingClauses: string[],
): string {
  const parts = [`${req.documentType} ${req.operationType} ${req.jurisdiction}`];
  if (missingClauses.length > 0) {
    parts.push(`cláusulas: ${missingClauses.slice(0, 3).join(", ")}`);
  }
  if (req.sourceHints.length > 0) {
    parts.push(`fuentes: ${req.sourceHints.slice(0, 3).join(", ")}`);
  }
  return parts.join(" ");
}

function engineVersion(): string {
  return process.env.ADVISOR_LEGAL_VALIDATION_ENGINE_VERSION?.trim() || DEFAULT_ENGINE_VERSION;
}

function promptVersion(): string {
  return process.env.ADVISOR_LEGAL_VALIDATION_PROMPT_VERSION?.trim() || DEFAULT_PROMPT_VERSION;
}
