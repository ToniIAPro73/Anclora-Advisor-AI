/**
 * Unit tests for the legal document validator (DI mocks — no LLM, no RAG, no Supabase).
 * Run: npx tsx tests/unit/test-legal-document-validator.ts
 */

import {
  normalizeLegalDocumentRequest,
  validateLegalDocument,
} from "../../src/lib/legal-documents/legal-document-validator";
import type { LegalDocumentValidatorDependencies } from "../../src/lib/legal-documents/legal-document-validator";
import type { RetrievalResult } from "../../src/lib/rag/retrieval";

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

const emptyRetrieval: RetrievalResult = { chunks: [], query: "test", cached: false };
const fixedNow = new Date("2026-01-15T10:00:00Z");
const currentLegalRetrieval: RetrievalResult = {
  chunks: [
    {
      id: "chunk-legal-1",
      document_id: "legal-source-1",
      content: "La LAU exige causa de temporalidad y pactos claros de renta, duración y fianza.",
      metadata: {
        title: "LAU rental source",
        source_url: "https://example.test/lau",
        jurisdiction: "España",
        status: "current",
        reviewed_at: "2026-01-01",
        authority: "BOE",
        source_type: "law",
        confidence: 0.9,
      },
      similarity: 0.9,
    },
  ],
  query: "test",
  cached: false,
};

function makeDeps(overrides: Partial<LegalDocumentValidatorDependencies> = {}): LegalDocumentValidatorDependencies {
  return {
    retrieve: async () => currentLegalRetrieval,
    generate: async () =>
      JSON.stringify({
        status: "approved",
        confidence: 0.85,
        summary: "Sin infracciones detectadas.",
        findings: [],
        required_actions: [],
        missing_clauses: [],
      }),
    now: () => fixedNow,
    ...overrides,
  };
}

const minimalValidBody = {
  documentText:
    "Contrato de arrendamiento de temporada. DNI de arrendador y NIE de arrendatario identificados. Causa de temporalidad: estancia de trabajo. Renta: 1.200 EUR. Duración: 2 meses. Fianza: 2.400 EUR. Inventario adjunto. Suministros incluidos. Rescisión según LAU.",
  documentType: "alquiler_temporada",
  jurisdiction: "España",
  language: "es",
};

// ── Test 1: request normalization — camelCase ─────────────────────────────────
console.log("\nTest 1: normalization accepts camelCase");
{
  const result = normalizeLegalDocumentRequest(minimalValidBody);
  assert(!("error" in result), "valid camelCase body is accepted");
  if (!("error" in result)) {
    assert(result.documentType === "alquiler_temporada", "documentType normalized");
    assert(result.jurisdiction === "España", "jurisdiction normalized");
  }
}

// ── Test 2: request normalization — snake_case ────────────────────────────────
console.log("\nTest 2: normalization accepts snake_case");
{
  const body = {
    document_text: minimalValidBody.documentText,
    document_type: "compraventa",
    jurisdiction: "España",
    language: "es",
  };
  const result = normalizeLegalDocumentRequest(body);
  assert(!("error" in result), "valid snake_case body is accepted");
}

// ── Test 3: empty documentText rejected ───────────────────────────────────────
console.log("\nTest 3: empty documentText is rejected");
{
  const result = normalizeLegalDocumentRequest({ documentText: "hi", documentType: "generico" });
  assert("error" in result, "short documentText returns error");
}

// ── Test 4: happy path — ok response ─────────────────────────────────────────
console.log("\nTest 4: happy path returns ok status with correct shape");
async function test4() {
  const result = await validateLegalDocument(minimalValidBody, "req-test-4", makeDeps());
  assert(result.statusCode === 200, "statusCode 200");
  const body = result.body as Record<string, unknown>;
  assert("status" in body, "body has status");
  assert("block_signing" in body, "body has block_signing");
  assert("risk_level" in body, "body has risk_level");
  assert("differences" in body, "body has differences array");
  assert("findings" in body, "body has findings array");
  assert("legal_disclaimer" in body, "body has legal_disclaimer");
  assert("request_id" in body, "body has request_id");
  assert("engine_version" in body, "body has engine_version");
  assert("prompt_version" in body, "body has prompt_version");
  assert(body.validation_timestamp === fixedNow.toISOString(), "validation_timestamp uses injected now()");
}

// ── Test 5: LLM failure → fallback with block_signing:true ──────────────────
console.log("\nTest 5: LLM failure triggers fallback with block_signing:true");
async function test5() {
  const deps = makeDeps({
    generate: async () => { throw new Error("LLM unavailable"); },
  });
  const result = await validateLegalDocument(minimalValidBody, "req-test-5", deps);
  assert(result.statusCode === 200, "statusCode 200 even on LLM failure");
  const body = result.body as Record<string, unknown>;
  assert(body.status === "review_required", "status is review_required on LLM failure");
  assert(body.block_signing === true, "block_signing true on LLM failure");
}

// ── Test 6: malformed LLM JSON → fallback ────────────────────────────────────
console.log("\nTest 6: malformed LLM JSON triggers fallback");
async function test6() {
  const deps = makeDeps({ generate: async () => "not valid json at all" });
  const result = await validateLegalDocument(minimalValidBody, "req-test-6", deps);
  const body = result.body as Record<string, unknown>;
  assert(body.status === "review_required", "status is review_required on parse failure");
  assert(body.block_signing === true, "block_signing true on parse failure");
}

// ── Test 7: placeholder in document → critical risk regardless of LLM ────────
console.log("\nTest 7: placeholder text forces critical risk");
async function test7() {
  const body = {
    ...minimalValidBody,
    documentText: "Contrato de arrendamiento. Arrendatario: [NOMBRE COMPLETO]. DNI pendiente. Causa de temporalidad: trabajo. Renta: 1.200 EUR. Duración: 2 meses. Fianza: 2.400 EUR. Inventario adjunto. Suministros incluidos. Rescisión según LAU.",
  };
  const result = await validateLegalDocument(body, "req-test-7", makeDeps());
  const resp = result.body as Record<string, unknown>;
  assert(resp.block_signing === true, "block_signing true when placeholder detected");
  assert(
    resp.risk_level === "critical" || resp.risk_level === "high",
    "risk_level elevated for placeholder",
  );
}

// ── Test 9: missing RAG sources prevents approval ────────────────────────────
console.log("\nTest 9: missing RAG sources forces review");
async function test9() {
  const result = await validateLegalDocument(minimalValidBody, "req-test-9", makeDeps({
    retrieve: async () => emptyRetrieval,
  }));
  const body = result.body as Record<string, unknown>;
  assert(body.status === "review_required", "status is review_required without sources");
  assert(body.block_signing === true, "block_signing true without sources");
}

// ── Test 8: audit payload is privacy-safe (no raw text) ──────────────────────
console.log("\nTest 8: audit payload contains hash not raw text");
async function test8() {
  const result = await validateLegalDocument(minimalValidBody, "req-test-8", makeDeps());
  assert(result.auditPayload !== undefined, "auditPayload is present");
  if (result.auditPayload) {
    assert(
      typeof result.auditPayload.document_text_hash === "string" &&
        result.auditPayload.document_text_hash.length === 64,
      "document_text_hash is sha256 hex string",
    );
    assert(
      !JSON.stringify(result.auditPayload).includes(minimalValidBody.documentText.slice(0, 20)),
      "raw document text not present in audit payload",
    );
  }
}

// ── Run async tests ───────────────────────────────────────────────────────────
async function runAll() {
  await test4();
  await test5();
  await test6();
  await test7();
  await test8();
  await test9();

  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error("Unexpected error in test runner:", err);
  process.exit(1);
});
