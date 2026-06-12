export type LegalRiskLevel = "low" | "medium" | "high" | "critical";

export type LegalReviewRequirement =
  | "none"
  | "recommended"
  | "required"
  | "urgent";

export type LegalDocumentType =
  | "compraventa"
  | "alquiler_temporada"
  | "alquiler_turistico"
  | "arras"
  | "poder_notarial"
  | "contrato_servicios"
  | string;

export type LegalDocumentLanguage = "es" | "en" | "de" | string;

export type LegalValidationStatus = "ok" | "review_required" | "error";

// ── Diff ──────────────────────────────────────────────────────────────────────

export type LegalDifferenceType =
  | "missing_clause"
  | "modified_clause"
  | "added_clause"
  | "placeholder_detected"
  | "field_inconsistency"
  | "date_anomaly"
  | "amount_anomaly";

export interface LegalDifference {
  type: LegalDifferenceType;
  field?: string;
  canonical_value?: string;
  submitted_value?: string;
  description: string;
  severity: LegalRiskLevel;
}

// ── Findings ──────────────────────────────────────────────────────────────────

export interface LegalFinding {
  severity: LegalRiskLevel;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  block_signing: boolean;
  evidence?: string;
  source_reference?: string;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export interface LegalDocumentValidationRequest {
  // camelCase variants (frontend)
  documentText?: string;
  canonicalTemplate?: string;
  documentType?: LegalDocumentType;
  jurisdiction?: string;
  language?: LegalDocumentLanguage;
  documentId?: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
  // snake_case variants (backend / integrations)
  document_text?: string;
  canonical_template?: string;
  document_type?: LegalDocumentType;
  document_id?: string;
  org_id?: string;
}

export interface NormalizedLegalDocumentValidationRequest {
  documentId?: string;
  documentText: string;
  canonicalTemplate?: string;
  documentType: LegalDocumentType;
  jurisdiction: string;
  language: LegalDocumentLanguage;
  orgId?: string;
  metadata: Record<string, unknown>;
}

// ── Compare request ───────────────────────────────────────────────────────────

export interface LegalDocumentCompareRequest {
  submittedText: string;
  canonicalText: string;
  documentType?: LegalDocumentType;
  language?: LegalDocumentLanguage;
  // snake_case
  submitted_text?: string;
  canonical_text?: string;
  document_type?: LegalDocumentType;
}

export interface NormalizedLegalDocumentCompareRequest {
  submittedText: string;
  canonicalText: string;
  documentType: LegalDocumentType;
  language: LegalDocumentLanguage;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface LegalDocumentCompareResponse {
  differences: LegalDifference[];
  risk_level: LegalRiskLevel;
  review_requirement: LegalReviewRequirement;
  summary: string;
  block_signing: boolean;
  legal_disclaimer: string;
}

export interface LegalDocumentValidationResponse {
  status: LegalValidationStatus;
  block_signing: boolean;
  risk_level: LegalRiskLevel;
  review_requirement: LegalReviewRequirement;
  confidence: number;
  summary: string;
  findings: LegalFinding[];
  differences: LegalDifference[];
  required_actions: string[];
  missing_clauses?: string[];
  legal_disclaimer: string;
  sources?: LegalDocumentSource[];
  document_id?: string;
  validation_timestamp: string;
  rag_sources_used?: number;
}

export interface LegalDocumentSource {
  title?: string;
  source?: string;
  excerpt?: string;
}

// ── Audit payload (privacy-safe) ──────────────────────────────────────────────

export interface LegalDocumentAuditPayload {
  request_id: string;
  document_id?: string;
  document_type: string;
  jurisdiction: string;
  model_used: string;
  risk_level: LegalRiskLevel;
  block_signing: boolean;
  status: LegalValidationStatus;
  rag_sources_used: number;
  document_text_hash: string;
  canonical_template_hash?: string;
  findings_count: number;
  differences_count: number;
  org_id?: string;
}
