export type LegalRiskLevel = "low" | "medium" | "high" | "critical";

export type LegalReviewRequirement =
  | "none"
  | "internal_review"
  | "legal_review"
  | "notarial_review"
  | "recommended"
  | "required"
  | "urgent";

export type LegalDocumentType =
  | "compraventa"
  | "alquiler_temporada"
  | "alquiler_turistico"
  | "arras"
  | "kyc"
  | "mandato"
  | "reserva"
  | "inventario"
  | "entrega_llaves"
  | "poder_notarial"
  | "contrato_servicios"
  | string;

export type LegalDocumentLanguage = "es" | "en" | "de" | string;

export type LegalValidationStatus =
  | "approved"
  | "approved_with_warnings"
  | "review_required"
  | "rejected"
  | "ok"
  | "error";

// ── Diff ──────────────────────────────────────────────────────────────────────

export type LegalDifferenceType =
  | "missing_clause"
  | "modified_clause"
  | "added_clause"
  | "placeholder_detected"
  | "field_inconsistency"
  | "date_anomaly"
  | "amount_anomaly"
  | "source_quality"
  | "technical_fallback";

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

export type LegalSourceValidityStatus =
  | "current"
  | "superseded"
  | "expired"
  | "uncertain";

export interface LegalSource {
  title: string;
  source?: string;
  url?: string;
  identifier?: string;
  type?: string;
  authority?: string;
  jurisdiction?: string;
  effective_date?: string;
  reviewed_at?: string;
  status: LegalSourceValidityStatus;
  confidence: number;
  excerpt?: string;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export interface LegalDocumentValidationRequest {
  documentId?: string;
  templateId?: string;
  templateVersionId?: string;
  documentType?: LegalDocumentType;
  operationType?: string;
  jurisdiction?: string;
  language?: LegalDocumentLanguage;
  canonicalText?: string;
  currentText?: string;
  variableSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceHints?: string[];
  requestId?: string;
  // camelCase variants (frontend)
  documentText?: string;
  canonicalTemplate?: string;
  orgId?: string;
  // Nexus integration contract (document_content)
  documentContent?: string;
  document_content?: string;
  // snake_case variants (backend / integrations)
  document_text?: string;
  canonical_template?: string;
  canonical_text?: string;
  current_text?: string;
  document_type?: LegalDocumentType;
  document_id?: string;
  template_id?: string;
  template_version_id?: string;
  operation_type?: string;
  variable_snapshot?: Record<string, unknown>;
  source_hints?: string[];
  request_id?: string;
  org_id?: string;
}

export interface NormalizedLegalDocumentValidationRequest {
  documentId?: string;
  templateId?: string;
  templateVersionId?: string;
  documentText: string;
  canonicalTemplate?: string;
  documentType: LegalDocumentType;
  operationType: string;
  jurisdiction: string;
  language: LegalDocumentLanguage;
  variableSnapshot: Record<string, unknown>;
  sourceHints: string[];
  requestId?: string;
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

export interface LegalDocumentValidationIssue {
  type: string;
  severity: LegalRiskLevel;
  description: string;
  reference?: string;
}

export interface LegalDocumentValidationResponse {
  status: LegalValidationStatus;
  block_signing: boolean;
  risk_level: LegalRiskLevel;
  review_requirement: LegalReviewRequirement;
  confidence: number;
  summary: string;
  findings: LegalFinding[];
  issues: LegalDocumentValidationIssue[];
  differences: LegalDifference[];
  required_actions: string[];
  unresolved_placeholders: string[];
  missing_clauses?: string[];
  missing_documents?: string[];
  legal_disclaimer: string;
  sources: LegalSource[];
  document_id?: string;
  template_id?: string;
  template_version_id?: string;
  validation_timestamp: string;
  rag_sources_used?: number;
  request_id: string;
  engine_version: string;
  prompt_version: string;
  idempotency_key?: string;
  fallback_used?: boolean;
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
  template_version_id?: string;
  caller?: string;
  document_type: string;
  jurisdiction: string;
  model_used: string;
  prompt_version: string;
  engine_version: string;
  risk_level: LegalRiskLevel;
  block_signing: boolean;
  status: LegalValidationStatus;
  rag_sources_used: number;
  source_count: number;
  source_statuses: LegalSourceValidityStatus[];
  document_text_hash: string;
  canonical_template_hash?: string;
  variable_snapshot_hash?: string;
  findings_count: number;
  differences_count: number;
  duration_ms?: number;
  fallback_used?: boolean;
  org_id?: string;
}
