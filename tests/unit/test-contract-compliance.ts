/**
 * Unit tests for contract compliance validator helpers.
 * Run: npx tsx tests/unit/test-contract-compliance.ts
 */

import {
  normalizeContractRequest,
  validateContractCompliance,
} from "../../src/lib/contracts/contract-compliance-validator";
import {
  buildComplianceSystemPrompt,
  buildComplianceUserPrompt,
} from "../../src/lib/rag/contract-compliance-prompt";
import type { RAGChunk } from "../../src/lib/rag/retrieval";

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

const validBody = {
  contractText: "Contrato de arrendamiento de temporada con renta, fianza y clausulas de uso de vivienda.",
  operationType: "alquiler_temporada",
  jurisdiction: "ES-IB",
  language: "es",
};

const chunk: RAGChunk = {
  id: "chunk-1",
  document_id: "doc-1",
  content: "La fianza y las clausulas de arrendamiento deben ajustarse a LAU.",
  metadata: {
    title: "LAU arrendamientos",
    category: "inmobiliario",
    source_url: "https://example.test/lau",
  },
  similarity: 0.8,
};

console.log("\nTest 1: request normalization accepts new and legacy names");
const normalizedNew = normalizeContractRequest(validBody);
assert(!("error" in normalizedNew), "new body is valid");
if (!("error" in normalizedNew)) {
  assert(normalizedNew.contractText.includes("arrendamiento"), "new contractText normalized");
  assert(normalizedNew.operationType === "alquiler_temporada", "new operationType normalized");
}

const normalizedLegacy = normalizeContractRequest({
  contract_id: "legacy-1",
  contract_text: validBody.contractText,
  operation_type: "compraventa",
  org_id: "org-1",
});
assert(!("error" in normalizedLegacy), "legacy body is valid");
if (!("error" in normalizedLegacy)) {
  assert(normalizedLegacy.contractId === "legacy-1", "legacy contract_id preserved");
  assert(normalizedLegacy.orgId === "org-1", "legacy org_id preserved");
}

console.log("\nTest 2: invalid bodies are rejected");
assert("error" in normalizeContractRequest(null), "null rejected");
assert("error" in normalizeContractRequest({ contractText: "" }), "empty text rejected");
assert("error" in normalizeContractRequest({ contractText: "corto" }), "short text rejected");

console.log("\nTest 3: prompt builders use normalized contract data");
const normalizedPromptBody = normalizeContractRequest(validBody);
assert(!("error" in normalizedPromptBody), "prompt fixture valid");
if (!("error" in normalizedPromptBody)) {
  const systemPrompt = buildComplianceSystemPrompt();
  assert(systemPrompt.includes("JSON"), "system prompt requires JSON");
  assert(systemPrompt.includes("critical"), "system prompt includes critical severity");

  const userPrompt = buildComplianceUserPrompt(normalizedPromptBody, chunk.content);
  assert(userPrompt.includes("alquiler_temporada"), "user prompt includes operation type");
  assert(userPrompt.includes("ES-IB"), "user prompt includes jurisdiction");
  assert(userPrompt.includes(chunk.content), "user prompt includes RAG context");
}

async function main(): Promise<void> {
  console.log("\nTest 4: critical findings always block signing");
  const critical = await validateContractCompliance(validBody, "test-request", {
    retrieve: async () => ({ chunks: [chunk], cacheHit: false }),
    generate: async () => JSON.stringify({
      status: "ok",
      confidence: 0.9,
      summary: "Riesgo critico detectado.",
      findings: [{
        severity: "critical",
        category: "clausula_abusiva",
        title: "Renuncia imperativa",
        description: "El contrato contiene una renuncia potencialmente imperativa.",
        recommendation: "Eliminar o rehacer la clausula.",
        block_signing: false,
      }],
      required_actions: [],
    }),
    now: () => new Date("2026-06-12T00:00:00.000Z"),
  });
  assert(critical.statusCode === 200, "critical response returns 200");
  if ("block_signing" in critical.body) {
    assert(critical.body.block_signing === true, "critical severity blocks signing");
    assert(critical.body.status === "review_required", "critical severity requires review");
  }

  console.log("\nTest 5: invalid model JSON degrades safely");
  const invalidJson = await validateContractCompliance(validBody, "test-request", {
    retrieve: async () => ({ chunks: [chunk], cacheHit: false }),
    generate: async () => "not json",
    now: () => new Date("2026-06-12T00:00:00.000Z"),
  });
  assert(invalidJson.statusCode === 200, "invalid JSON response returns 200");
  if ("block_signing" in invalidJson.body) {
    assert(invalidJson.body.status === "review_required", "invalid JSON requires review");
    assert(invalidJson.body.block_signing === true, "invalid JSON blocks signing");
    assert(invalidJson.body.legal_disclaimer.includes("abogado"), "disclaimer included");
  }

  console.log(`\n${passed + failed} tests - ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
