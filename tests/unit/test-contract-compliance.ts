/**
 * Unit tests for contract compliance validator logic.
 * Run: npx tsx tests/unit/test-contract-compliance.ts
 */

import {
  buildComplianceSystemPrompt,
  buildComplianceUserPrompt,
} from "../../src/lib/rag/contract-compliance-prompt";
import type { ValidateContractRequest, ContractFinding, ContractComplianceResponse } from "../../src/types/contract-compliance";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  FAIL: ${label}`);
    failed++;
  } else {
    console.log(`  PASS: ${label}`);
    passed++;
  }
}

// ─── Helpers that replicate route logic without HTTP ─────────────────────────

function parseModelResponse(raw: string): { findings: ContractFinding[]; warnings: ContractFinding[] } {
  const fallback = { findings: [] as ContractFinding[], warnings: [] as ContractFinding[] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  } catch {
    return fallback;
  }
}

function buildResponse(
  body: ValidateContractRequest,
  parsed: { findings: ContractFinding[]; warnings: ContractFinding[] },
  ragSourcesUsed: number
): ContractComplianceResponse {
  return {
    contract_id: body.contract_id,
    compliance_check_passed: parsed.findings.length === 0,
    block_signing: parsed.findings.some((f) => f.block_signing),
    verification_timestamp: new Date().toISOString(),
    findings: parsed.findings,
    warnings: parsed.warnings,
    rag_sources_used: ragSourcesUsed,
  };
}

// ─── Test 1: Missing required fields detected ─────────────────────────────────
console.log("\nTest 1: required field validation");
const missingFields = [
  { contract_text: "text", operation_type: "compraventa", org_id: "org" } as Partial<ValidateContractRequest>,
  { contract_id: "id", operation_type: "compraventa", org_id: "org" } as Partial<ValidateContractRequest>,
  { contract_id: "id", contract_text: "text", org_id: "org" } as Partial<ValidateContractRequest>,
  { contract_id: "id", contract_text: "text", operation_type: "compraventa" } as Partial<ValidateContractRequest>,
];
for (const body of missingFields) {
  const isMissing = !body.contract_id || !body.contract_text || !body.operation_type || !body.org_id;
  assert(isMissing, `missing field detected: ${JSON.stringify(Object.keys(body))}`);
}

// ─── Test 2: Valid body builds correct response shape ─────────────────────────
console.log("\nTest 2: valid body → response shape");
const validBody: ValidateContractRequest = {
  contract_id: "test-001",
  contract_text: "Contrato de arrendamiento de temporada...",
  operation_type: "alquiler_temporada",
  org_id: "org-abc",
};
const emptyParsed = { findings: [], warnings: [] };
const response = buildResponse(validBody, emptyParsed, 3);
assert(response.contract_id === "test-001", "contract_id reflected");
assert(response.compliance_check_passed === true, "compliance_check_passed true when no findings");
assert(response.block_signing === false, "block_signing false when no findings");
assert(response.rag_sources_used === 3, "rag_sources_used set correctly");
assert(typeof response.verification_timestamp === "string", "verification_timestamp is string");
assert(Array.isArray(response.findings), "findings is array");
assert(Array.isArray(response.warnings), "warnings is array");

// ─── Test 3: block_signing propagates from findings ──────────────────────────
console.log("\nTest 3: block_signing propagation");
const blockingFinding: ContractFinding = {
  clause_ref: "§3",
  rule: "Art. 6 LAU",
  severity: "block",
  description: "Renuncia a prórroga forzosa",
  suggested_fix: "Eliminar la cláusula",
  block_signing: true,
};
const parsedWithBlock = { findings: [blockingFinding], warnings: [] };
const blockResponse = buildResponse(validBody, parsedWithBlock, 0);
assert(blockResponse.block_signing === true, "block_signing true when a finding has block_signing: true");
assert(blockResponse.compliance_check_passed === false, "compliance_check_passed false when findings exist");

// ─── Test 4: Unparseable model output → empty findings, no crash ─────────────
console.log("\nTest 4: unparseable model output");
const badJsons = ["not json at all", "```json\n{}```", "", "null", "undefined"];
for (const bad of badJsons) {
  const result = parseModelResponse(bad);
  assert(Array.isArray(result.findings), `findings is array for input: "${bad.slice(0, 20)}"`);
  assert(Array.isArray(result.warnings), `warnings is array for input: "${bad.slice(0, 20)}"`);
}

// ─── Test 5: Prompt builders return non-empty strings ────────────────────────
console.log("\nTest 5: prompt builders");
const systemPrompt = buildComplianceSystemPrompt();
assert(systemPrompt.length > 100, "system prompt non-trivial");
assert(systemPrompt.includes("LAU"), "system prompt mentions LAU");
assert(systemPrompt.includes("JSON"), "system prompt requests JSON");

const userPrompt = buildComplianceUserPrompt(validBody, "Art. 6 LAU...");
assert(userPrompt.includes(validBody.operation_type), "user prompt includes operation_type");
assert(userPrompt.includes(validBody.contract_text), "user prompt includes contract_text");
assert(userPrompt.includes("Art. 6 LAU"), "user prompt includes RAG context");

const userPromptNoRag = buildComplianceUserPrompt(validBody, "");
assert(userPromptNoRag.includes("sin fragmentos recuperados"), "empty rag context handled gracefully");

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
