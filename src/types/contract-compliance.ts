export type ContractOperationType = "compraventa" | "alquiler_temporada" | "alquiler_turistico" | string;
export type ContractLanguage = "es" | "en" | "de" | string;
export type ContractFindingSeverity = "low" | "medium" | "high" | "critical";
export type ContractValidationStatus = "ok" | "review_required" | "error";

export interface ContractFinding {
  severity: ContractFindingSeverity;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  block_signing: boolean;
  evidence?: string;
}

export interface ContractComplianceResponse {
  status: ContractValidationStatus;
  block_signing: boolean;
  confidence: number;
  summary: string;
  findings: ContractFinding[];
  required_actions: string[];
  missing_documents?: string[];
  legal_disclaimer: string;
  sources?: ContractComplianceSource[];
  contract_id?: string;
  compliance_check_passed?: boolean;
  verification_timestamp?: string;
  rag_sources_used?: number;
  warnings?: ContractFinding[];
}

export interface ContractComplianceSource {
  title?: string;
  source?: string;
  excerpt?: string;
}

export interface ValidateContractRequest {
  contractText?: string;
  contractType?: string;
  operationType?: ContractOperationType;
  jurisdiction?: string;
  language?: ContractLanguage;
  metadata?: Record<string, unknown>;
  contract_id?: string;
  contract_text?: string;
  contract_type?: string;
  operation_type?: ContractOperationType;
  org_id?: string;
}

export interface NormalizedValidateContractRequest {
  contractId?: string;
  contractText: string;
  contractType?: string;
  operationType: ContractOperationType;
  jurisdiction: string;
  language: ContractLanguage;
  metadata: Record<string, unknown>;
  orgId?: string;
}
