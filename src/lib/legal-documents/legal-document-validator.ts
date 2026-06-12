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
import type {
  LegalDocumentAuditPayload,
  LegalDocumentSource,
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
    documentText,
    canonicalTemplate:
      (typeof body.canonicalTemplate === "string" ? body.canonicalTemplate : undefined) ??
      (typeof body.canonical_template === "string" ? body.canonical_template : undefined),
    documentType:
      (typeof body.documentType === "string" ? body.documentType : undefined) ??
      (typeof body.document_type === "string" ? body.document_type : undefined) ??
      "generico",
    jurisdiction:
      typeof body.jurisdiction === "string" ? body.jurisdiction : "España",
    language: typeof body.language === "string" ? body.language : "es",
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
  // Step 1: Normalize and validate input
  const normalized = normalizeLegalDocumentRequest(rawBody);
  if ("error" in normalized) {
    return { statusCode: 400, body: { error: normalized.error } };
  }

  // Step 2: Run deterministic rules (no LLM)
  const deterministicResult = runDeterministicRules(
    normalized.documentText,
    normalized.documentType,
    normalized.canonicalTemplate,
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
    modelOutput = await deps.generate(
      modelName,
      systemPrompt,
      userPrompt,
      {
        maxTokens: readPositiveInt("ADVISOR_LEGAL_DOCUMENT_VALIDATOR_MAX_TOKENS", 1500),
        temperature: readNumber("ADVISOR_LEGAL_DOCUMENT_VALIDATOR_TEMPERATURE", 0),
      },
    );
  } catch (err) {
    log("error", "LLM call failed — returning fallback response", requestId, {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackResult(
      normalized,
      deterministicResult.differences,
      requestId,
      modelName,
      ragSourcesUsed,
      deps.now(),
    );
  }

  // Step 7: Parse LLM response
  let parsed: ParsedModelResponse;
  const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log("warn", "LLM response contains no JSON — returning fallback", requestId);
    return buildFallbackResult(
      normalized,
      deterministicResult.differences,
      requestId,
      modelName,
      ragSourcesUsed,
      deps.now(),
    );
  }
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    log("warn", "LLM response parse failed — returning fallback", requestId);
    return buildFallbackResult(
      normalized,
      deterministicResult.differences,
      requestId,
      modelName,
      ragSourcesUsed,
      deps.now(),
    );
  }

  // Step 8: Merge deterministic differences with LLM findings and finalize
  const llmFindings = normalizeLegalFindings(parsed.findings);
  const allDifferences = deterministicResult.differences;

  const deterministicRiskLevel = computeRiskLevel(allDifferences);
  const llmStatus = normalizeStatus(parsed.status);
  const llmConfidence = clampConfidence(parsed.confidence);

  const finalStatus: LegalValidationStatus =
    llmStatus === "error" || deterministicResult.placeholdersFound > 0
      ? "review_required"
      : llmStatus;

  const finalRiskLevel = mergeRiskLevel(deterministicRiskLevel, llmFindings);
  const blockSigning =
    finalRiskLevel === "critical" ||
    finalRiskLevel === "high" ||
    deterministicResult.placeholdersFound > 0 ||
    llmFindings.some((f) => f.block_signing);

  const reviewRequirement = deriveReviewRequirement(finalRiskLevel, blockSigning);

  const sources = ragChunks.map((c): LegalDocumentSource => ({
    title: String(c.metadata?.title ?? ""),
    source: String(c.metadata?.source_url ?? ""),
    excerpt: c.content.slice(0, 200),
  }));

  const response: LegalDocumentValidationResponse = {
    status: finalStatus,
    block_signing: blockSigning,
    risk_level: finalRiskLevel,
    review_requirement: reviewRequirement,
    confidence: llmConfidence,
    summary: typeof parsed.summary === "string" ? parsed.summary : buildDefaultSummary(llmFindings, allDifferences, finalRiskLevel),
    findings: llmFindings,
    differences: allDifferences,
    required_actions: Array.isArray(parsed.required_actions)
      ? parsed.required_actions.filter((a): a is string => typeof a === "string")
      : [],
    missing_clauses: deterministicResult.missingClauses,
    legal_disclaimer: LEGAL_DISCLAIMER,
    sources,
    document_id: normalized.documentId,
    validation_timestamp: deps.now().toISOString(),
    rag_sources_used: ragSourcesUsed,
  };

  // Step 9: Build audit payload (privacy-safe)
  const auditPayload = buildAuditPayload(normalized, response, requestId, modelName);

  log("info", "Legal document validation complete", requestId, {
    risk_level: finalRiskLevel,
    block_signing: blockSigning,
    findings_count: llmFindings.length,
    differences_count: allDifferences.length,
    rag_sources_used: ragSourcesUsed,
  });

  return { statusCode: 200, body: response, auditPayload };
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function buildFallbackResult(
  req: NormalizedLegalDocumentValidationRequest,
  deterministicDiffs: LegalDifference[],
  requestId: string,
  modelName: string,
  ragSourcesUsed: number,
  now: Date,
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
    missing_clauses: [],
    legal_disclaimer: LEGAL_DISCLAIMER,
    document_id: req.documentId,
    validation_timestamp: now.toISOString(),
    rag_sources_used: ragSourcesUsed,
  };

  const auditPayload = buildAuditPayload(req, response, requestId, modelName);
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
  if (raw === "ok" || raw === "review_required" || raw === "error") return raw;
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
  if (riskLevel === "critical" || blockSigning) return "urgent";
  if (riskLevel === "high") return "required";
  if (riskLevel === "medium") return "recommended";
  return "none";
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
): LegalDocumentAuditPayload {
  return {
    request_id: requestId,
    document_id: req.documentId,
    document_type: req.documentType,
    jurisdiction: req.jurisdiction,
    model_used: modelName,
    risk_level: response.risk_level,
    block_signing: response.block_signing,
    status: response.status,
    rag_sources_used: response.rag_sources_used ?? 0,
    document_text_hash: sha256(req.documentText),
    canonical_template_hash: req.canonicalTemplate
      ? sha256(req.canonicalTemplate)
      : undefined,
    findings_count: response.findings.length,
    differences_count: response.differences.length,
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
  const parts = [`${req.documentType} ${req.jurisdiction}`];
  if (missingClauses.length > 0) {
    parts.push(`cláusulas: ${missingClauses.slice(0, 3).join(", ")}`);
  }
  return parts.join(" ");
}
