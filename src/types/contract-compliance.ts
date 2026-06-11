export interface ContractFinding {
  clause_ref: string;
  rule: string;
  severity: "block" | "warning" | "info";
  description: string;
  suggested_fix: string;
  block_signing: boolean;
}

export interface ContractComplianceResponse {
  contract_id: string;
  compliance_check_passed: boolean;
  block_signing: boolean;
  verification_timestamp: string;
  findings: ContractFinding[];
  warnings: ContractFinding[];
  rag_sources_used: number;
}

export interface ValidateContractRequest {
  contract_id: string;
  contract_text: string;
  operation_type: "compraventa" | "alquiler_temporada" | "alquiler_turistico";
  org_id: string;
}
