/**
 * Nexus integration contract tests for legal document validation.
 * Run: npx tsx tests/integration/test-legal-document-validation-nexus.ts
 */

process.env.ADVISOR_INTERNAL_API_KEY = "test-internal-key";
process.env.ADVISOR_LEGAL_VALIDATION_TIMEOUT_MS = "50";
process.env.ADVISOR_LEGAL_VALIDATION_RETRIES = "0";

import {
  createLegalDocumentComparePost,
  createLegalDocumentValidatePost,
} from "../../src/lib/legal-documents/legal-document-route-handlers";
import { createValidateContractPost } from "../../src/lib/contracts/contract-route-handlers";
import type { LegalDocumentValidatorDependencies } from "../../src/lib/legal-documents/legal-document-validator";
import type { RAGChunk, RetrievalResult } from "../../src/lib/rag/retrieval";

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

const now = new Date("2026-06-13T00:00:00.000Z");

const source: RAGChunk = {
  id: "source-1",
  document_id: "law-1",
  content: "Fuente vigente para compraventa, arras, alquiler y mandato. Requiere identidad, precio, objeto, fechas y jurisdicción.",
  metadata: {
    title: "Real estate legal checklist",
    source_url: "https://example.test/legal-checklist",
    jurisdiction: "España",
    status: "current",
    reviewed_at: "2026-06-01",
    authority: "BOE",
    source_type: "law",
    confidence: 0.95,
  },
  similarity: 0.95,
};

const expiredSource: RAGChunk = {
  ...source,
  id: "source-expired",
  metadata: {
    ...source.metadata,
    title: "Expired source",
    status: "expired",
  },
};

const validText = [
  "Contrato de compraventa inmobiliaria.",
  "Partes identificadas con DNI y NIE.",
  "Objeto: vivienda situada en España.",
  "Precio: 250.000 EUR.",
  "Forma de pago por transferencia.",
  "Descripción del inmueble y cargas y gravámenes verificados con nota simple.",
  "Notaría designada, impuestos detallados, fecha de entrega y arras pactadas.",
].join(" ");

const validRequest = {
  documentId: "doc-1",
  templateId: "tpl-sale",
  templateVersionId: "tpl-sale-v1",
  documentType: "compraventa",
  operationType: "sale",
  jurisdiction: "España",
  language: "es",
  canonicalText: validText,
  currentText: validText,
  variableSnapshot: { price: "250.000 EUR", jurisdiction: "España" },
  requestId: "nexus-request-1",
};

function deps(overrides: Partial<LegalDocumentValidatorDependencies> = {}): LegalDocumentValidatorDependencies {
  return {
    retrieve: async (): Promise<RetrievalResult> => ({ chunks: [source], query: "legal", cached: false }),
    generate: async () => JSON.stringify({
      status: "approved",
      confidence: 0.91,
      summary: "Document is compatible with the canonical template.",
      findings: [],
      required_actions: [],
    }),
    now: () => now,
    ...overrides,
  };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/legal-documents/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "route-request",
      "x-advisor-internal-api-key": "test-internal-key",
      "x-advisor-caller": "nexus",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, any>> {
  return response.json();
}

async function main(): Promise<void> {
  console.log("\nTest 1: canonical template unchanged approves");
  {
    const response = await createLegalDocumentValidatePost(deps())(request(validRequest));
    const body = await json(response);
    assert(response.status === 200, "returns 200");
    assert(body.status === "approved", "status approved");
    assert(body.block_signing === false, "does not block signing");
    assert(body.request_id === "nexus-request-1", "uses Nexus requestId");
  }

  console.log("\nTest 2: minor model warning returns approved_with_warnings");
  {
    const response = await createLegalDocumentValidatePost(deps({
      generate: async () => JSON.stringify({
        status: "approved_with_warnings",
        confidence: 0.8,
        summary: "Minor warning.",
        findings: [{ severity: "low", category: "style", title: "Minor wording", description: "Non-critical wording.", recommendation: "Review wording.", block_signing: false }],
        required_actions: ["Optional wording review"],
      }),
    }))(request({ ...validRequest, requestId: "nexus-request-2" }));
    const body = await json(response);
    assert(body.status === "approved_with_warnings", "warning status stable");
    assert(body.block_signing === false, "minor warning does not block");
  }

  console.log("\nTest 3: critical price change blocks signing");
  {
    const response = await createLegalDocumentValidatePost(deps())(request({
      ...validRequest,
      requestId: "nexus-request-3",
      currentText: validText.replace("250.000 EUR", "180.000 EUR"),
    }));
    const body = await json(response);
    assert(body.block_signing === true, "critical amount mismatch blocks");
    assert(body.status === "review_required", "critical mismatch requires review");
  }

  console.log("\nTest 4: placeholder blocks signing");
  {
    const response = await createLegalDocumentValidatePost(deps())(request({
      ...validRequest,
      requestId: "nexus-request-4",
      currentText: validText.replace("DNI", "[DNI]"),
    }));
    const body = await json(response);
    assert(body.unresolved_placeholders.length > 0, "placeholder listed");
    assert(body.block_signing === true, "placeholder blocks");
  }

  console.log("\nTest 5: absent source forces review");
  {
    const response = await createLegalDocumentValidatePost(deps({
      retrieve: async () => ({ chunks: [], query: "legal", cached: false }),
    }))(request({ ...validRequest, requestId: "nexus-request-5" }));
    const body = await json(response);
    assert(body.status === "review_required", "missing source requires review");
    assert(body.block_signing === true, "missing source blocks");
  }

  console.log("\nTest 6: expired source reduces confidence and requires review");
  {
    const response = await createLegalDocumentValidatePost(deps({
      retrieve: async () => ({ chunks: [expiredSource], query: "legal", cached: false }),
    }))(request({ ...validRequest, requestId: "nexus-request-6" }));
    const body = await json(response);
    assert(body.status !== "approved", "expired source does not approve");
    assert(body.confidence < 0.91, "confidence reduced");
  }

  console.log("\nTest 7: invalid LLM JSON degrades safely");
  {
    const response = await createLegalDocumentValidatePost(deps({
      generate: async () => "not-json",
    }))(request({ ...validRequest, requestId: "nexus-request-7" }));
    const body = await json(response);
    assert(body.status === "review_required", "invalid JSON requires review");
    assert(body.block_signing === true, "invalid JSON blocks");
  }

  console.log("\nTest 8: timeout degrades safely");
  {
    const response = await createLegalDocumentValidatePost(deps({
      generate: async () => new Promise((resolve) => setTimeout(() => resolve("{}"), 100)),
    }))(request({ ...validRequest, requestId: "nexus-request-8" }));
    const body = await json(response);
    assert(body.status === "review_required", "timeout requires review");
    assert(body.fallback_used === true, "timeout marks fallback");
  }

  console.log("\nTest 9: invalid auth rejected");
  {
    const response = await createLegalDocumentValidatePost(deps())(request(validRequest, {
      "x-advisor-internal-api-key": "wrong",
    }));
    assert(response.status === 403, "wrong API key returns 403");
  }

  console.log("\nTest 10: repeated request is idempotent");
  {
    let calls = 0;
    const handler = createLegalDocumentValidatePost(deps({
      generate: async () => {
        calls += 1;
        return JSON.stringify({ status: "approved", confidence: 0.91, summary: "OK", findings: [], required_actions: [] });
      },
    }));
    const repeated = { ...validRequest, requestId: "nexus-request-10" };
    await handler(request(repeated));
    await handler(request(repeated));
    assert(calls === 1, "second identical request uses idempotent cache");
  }

  console.log("\nTest 11: legacy /api/validate-contract remains compatible");
  {
    const legacy = createValidateContractPost({
      retrieve: async () => ({ chunks: [source], cacheHit: false }),
      generate: async () => JSON.stringify({ status: "ok", confidence: 0.8, summary: "OK", findings: [], required_actions: [] }),
      now: () => now,
    });
    const response = await legacy(new Request("http://localhost/api/validate-contract", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": "legacy" },
      body: JSON.stringify({ contractText: validText, operationType: "compraventa", jurisdiction: "ES", language: "es" }),
    }));
    const body = await json(response);
    assert(response.status === 200, "legacy route returns 200");
    assert("block_signing" in body, "legacy response still includes block_signing");
  }

  console.log("\nTest 12: compare endpoint requires auth");
  {
    const response = await createLegalDocumentComparePost()(new Request("http://localhost/api/legal-documents/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submittedText: validText, canonicalText: validText }),
    }));
    assert(response.status === 401, "compare without key returns 401");
  }

  console.log(`\n${passed + failed} tests - ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
