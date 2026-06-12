import { generateChatText } from "@/lib/ai/runtime";
import { log } from "@/lib/observability/logger";
import {
  buildComplianceSystemPrompt,
  buildComplianceUserPrompt,
} from "@/lib/rag/contract-compliance-prompt";
import { retrieveContext } from "@/lib/rag/retrieval";
import type { RAGChunk } from "@/lib/rag/retrieval";
import type {
  ContractComplianceResponse,
  ContractComplianceSource,
  ContractFinding,
  ContractFindingSeverity,
  NormalizedValidateContractRequest,
  ValidateContractRequest,
} from "@/types/contract-compliance";

const MIN_CONTRACT_TEXT_LENGTH = 25;
const LEGAL_DISCLAIMER =
  "Este sistema ayuda a identificar riesgos y carencias documentales, pero no sustituye la revision de un abogado, notario o asesor cualificado.";

export interface ContractValidatorDependencies {
  retrieve: typeof retrieveContext;
  generate: typeof generateChatText;
  now: () => Date;
}

export interface ContractValidatorResult {
  statusCode: number;
  body: ContractComplianceResponse | { error: string };
}

interface ParsedModelResponse {
  status?: unknown;
  confidence?: unknown;
  summary?: unknown;
  findings?: unknown;
  required_actions?: unknown;
  missing_documents?: unknown;
  warnings?: unknown;
}

export const defaultContractValidatorDependencies: ContractValidatorDependencies = {
  retrieve: retrieveContext,
  generate: generateChatText,
  now: () => new Date(),
};

export function normalizeContractRequest(raw: unknown): NormalizedValidateContractRequest | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid JSON body" };
  }

  const body = raw as ValidateContractRequest;
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};
  const contractText = readString(body.contractText) ?? readString(body.contract_text);

  if (!contractText) {
    return { error: "Missing contract text" };
  }
  if (contractText.trim().length < MIN_CONTRACT_TEXT_LENGTH) {
    return { error: "Contract text is empty or too short" };
  }

  const operationType = readString(body.operationType) ?? readString(body.operation_type) ?? "compraventa";

  return {
    contractId: readString(body.contract_id) ?? readString(metadata.contract_id),
    contractText: contractText.trim(),
    contractType: readString(body.contractType) ?? readString(body.contract_type),
    operationType,
    jurisdiction: readString(body.jurisdiction) ?? "ES",
    language: readString(body.language) ?? "es",
    metadata,
    orgId: readString(body.org_id) ?? readString(metadata.org_id),
  };
}

export async function validateContractCompliance(
  rawBody: unknown,
  requestId: string,
  deps: ContractValidatorDependencies = defaultContractValidatorDependencies
): Promise<ContractValidatorResult> {
  const normalized = normalizeContractRequest(rawBody);
  if ("error" in normalized) {
    return { statusCode: 400, body: { error: normalized.error } };
  }

  let chunks: RAGChunk[] = [];
  let retrievalWarning: ContractFinding | null = null;

  try {
    const result = await deps.retrieve(normalized.contractText.slice(0, 500), {
      category: "inmobiliario",
      limit: 8,
      threshold: 0.3,
    });
    chunks = result.chunks;
  } catch (error) {
    retrievalWarning = buildSafeFinding(
      "high",
      "rag_retrieval",
      "No se pudo recuperar contexto normativo",
      "La validacion no pudo consultar la base RAG inmobiliaria.",
      "Revisar manualmente el contrato con normativa aplicable antes de firmar.",
      true
    );
    log("warn", "contract_compliance_rag_failed", requestId, {
      error: error instanceof Error ? error.message : "unknown",
      contract_id: normalized.contractId ?? null,
    });
  }

  const sources = chunks.map(toSource);
  if (!retrievalWarning && chunks.length === 0) {
    retrievalWarning = buildSafeFinding(
      "medium",
      "rag_context",
      "Contexto normativo insuficiente",
      "No se recuperaron fragmentos RAG relevantes para validar el contrato con trazabilidad suficiente.",
      "Completar la revision con fuentes normativas verificadas antes de tomar una decision de firma.",
      false
    );
  }

  const ragContext = chunks.map((chunk) => chunk.content).join("\n\n---\n\n");

  log("info", "contract_compliance_rag_retrieved", requestId, {
    chunks_count: chunks.length,
    contract_id: normalized.contractId ?? null,
    operation_type: normalized.operationType,
  });

  let modelResponse: ContractComplianceResponse;
  try {
    const rawText = await deps.generate(
      resolveValidatorModel(),
      buildComplianceSystemPrompt(),
      buildComplianceUserPrompt(normalized, ragContext),
      {
        maxTokens: readPositiveInt("ADVISOR_CONTRACT_VALIDATOR_MAX_TOKENS", 1500),
        temperature: readNumber("ADVISOR_CONTRACT_VALIDATOR_TEMPERATURE", 0),
      }
    );
    modelResponse = parseModelResponse(rawText, normalized, chunks, deps.now());
  } catch (error) {
    log("warn", "contract_compliance_llm_failed", requestId, {
      error: error instanceof Error ? error.message : "unknown",
      contract_id: normalized.contractId ?? null,
    });
    modelResponse = buildFallbackResponse(
      normalized,
      chunks,
      deps.now(),
      "No se pudo completar la validacion automatica del modelo.",
      buildSafeFinding(
        "high",
        "llm_runtime",
        "Validacion automatica no disponible",
        "El runtime local/open-source no devolvio una respuesta valida para la validacion.",
        "Bloquear la firma hasta completar revision manual cualificada.",
        true
      )
    );
  }

  const findings = retrievalWarning
    ? normalizeFindings([...modelResponse.findings, retrievalWarning])
    : normalizeFindings(modelResponse.findings);

  const response = finalizeResponse(
    {
      ...modelResponse,
      findings,
      sources,
      contract_id: normalized.contractId,
      verification_timestamp: modelResponse.verification_timestamp ?? deps.now().toISOString(),
      rag_sources_used: chunks.length,
      warnings: findings.filter((finding) => !finding.block_signing),
    },
    normalized
  );

  return { statusCode: 200, body: response };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveValidatorModel(): string {
  return (
    process.env.ADVISOR_CONTRACT_VALIDATOR_MODEL?.trim() ||
    process.env.OLLAMA_MODEL_PRIMARY?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    "qwen2.5:14b"
  );
}

function parseModelResponse(
  rawText: string,
  req: NormalizedValidateContractRequest,
  chunks: RAGChunk[],
  now: Date
): ContractComplianceResponse {
  const parsed = parseJsonObject(rawText);
  if (!parsed) {
    return buildFallbackResponse(
      req,
      chunks,
      now,
      "El modelo no devolvio JSON parseable; se requiere revision manual.",
      buildSafeFinding(
        "high",
        "llm_output",
        "Respuesta del modelo no parseable",
        "La salida del modelo local/open-source no pudo convertirse a JSON estable.",
        "Bloquear la firma hasta revisar el contrato manualmente.",
        true
      )
    );
  }

  const body = parsed as ParsedModelResponse;
  const findings = normalizeFindings([
    ...readFindingArray(body.findings),
    ...readFindingArray(body.warnings),
  ]);

  return finalizeResponse(
    {
      status: body.status === "ok" || body.status === "review_required" || body.status === "error"
        ? body.status
        : findings.length > 0
          ? "review_required"
          : "ok",
      block_signing: false,
      confidence: clampConfidence(body.confidence),
      summary: readString(body.summary) ?? defaultSummary(findings),
      findings,
      required_actions: readStringArray(body.required_actions),
      missing_documents: readStringArray(body.missing_documents),
      legal_disclaimer: LEGAL_DISCLAIMER,
      sources: chunks.map(toSource),
      contract_id: req.contractId,
      verification_timestamp: now.toISOString(),
      rag_sources_used: chunks.length,
      warnings: findings.filter((finding) => !finding.block_signing),
    },
    req
  );
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function readFindingArray(value: unknown): ContractFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeFinding(item))
    .filter((item): item is ContractFinding => Boolean(item));
}

function normalizeFindings(findings: ContractFinding[]): ContractFinding[] {
  return findings.map((finding) => ({
    ...finding,
    block_signing: finding.block_signing || finding.severity === "critical",
  }));
}

function normalizeFinding(value: unknown): ContractFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const severity = normalizeSeverity(item.severity);
  const blockSigning = item.block_signing === true || severity === "critical";
  const legacyRule = readString(item.rule);
  const legacyClause = readString(item.clause_ref);

  return {
    severity,
    category: readString(item.category) ?? legacyRule ?? "contract_compliance",
    title: readString(item.title) ?? legacyClause ?? "Hallazgo de cumplimiento",
    description: readString(item.description) ?? "Se requiere revision del contrato.",
    recommendation: readString(item.recommendation) ?? readString(item.suggested_fix) ?? "Revisar y corregir antes de firmar.",
    block_signing: blockSigning,
    evidence: readString(item.evidence) ?? legacyClause,
  };
}

function normalizeSeverity(value: unknown): ContractFindingSeverity {
  if (value === "critical" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  if (value === "block") return "critical";
  if (value === "warning") return "medium";
  if (value === "info") return "low";
  return "medium";
}

function clampConfidence(value: unknown): number {
  const raw = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(readString).filter((item): item is string => Boolean(item));
}

function buildFallbackResponse(
  req: NormalizedValidateContractRequest,
  chunks: RAGChunk[],
  now: Date,
  summary: string,
  finding: ContractFinding
): ContractComplianceResponse {
  return finalizeResponse(
    {
      status: "review_required",
      block_signing: true,
      confidence: 0.2,
      summary,
      findings: [finding],
      required_actions: [finding.recommendation],
      missing_documents: [],
      legal_disclaimer: LEGAL_DISCLAIMER,
      sources: chunks.map(toSource),
      contract_id: req.contractId,
      verification_timestamp: now.toISOString(),
      rag_sources_used: chunks.length,
      warnings: [],
    },
    req
  );
}

function finalizeResponse(
  response: ContractComplianceResponse,
  req: NormalizedValidateContractRequest
): ContractComplianceResponse {
  const findings = normalizeFindings(response.findings);
  const blockSigning = findings.some((finding) => finding.block_signing || finding.severity === "critical");
  const status = response.status === "error"
    ? "error"
    : blockSigning || findings.length > 0
      ? "review_required"
      : response.status;

  return {
    status,
    block_signing: blockSigning,
    confidence: clampConfidence(response.confidence),
    summary: response.summary || defaultSummary(findings),
    findings,
    required_actions: response.required_actions?.length
      ? response.required_actions
      : findings.filter((finding) => finding.block_signing).map((finding) => finding.recommendation),
    missing_documents: response.missing_documents ?? [],
    legal_disclaimer: LEGAL_DISCLAIMER,
    sources: response.sources ?? [],
    contract_id: req.contractId,
    compliance_check_passed: !blockSigning && findings.length === 0,
    verification_timestamp: response.verification_timestamp,
    rag_sources_used: response.rag_sources_used,
    warnings: findings.filter((finding) => !finding.block_signing),
  };
}

function buildSafeFinding(
  severity: ContractFindingSeverity,
  category: string,
  title: string,
  description: string,
  recommendation: string,
  blockSigning: boolean
): ContractFinding {
  return {
    severity,
    category,
    title,
    description,
    recommendation,
    block_signing: blockSigning || severity === "critical",
  };
}

function defaultSummary(findings: ContractFinding[]): string {
  if (findings.length === 0) {
    return "No se han detectado bloqueos automaticos con la informacion disponible.";
  }
  return "La validacion requiere revision antes de continuar con la firma.";
}

function toSource(chunk: RAGChunk): ContractComplianceSource {
  return {
    title: chunk.metadata.title,
    source: chunk.metadata.source_url,
    excerpt: chunk.content.slice(0, 500),
  };
}
