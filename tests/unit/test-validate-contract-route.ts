/**
 * Route-level tests for POST /api/validate-contract.
 * Run: npx tsx tests/unit/test-validate-contract-route.ts
 */

import { createValidateContractPost } from "../../src/lib/contracts/contract-route-handlers";
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
  contractText: "Contrato de compraventa inmobiliaria con precio, arras, cargas, notaria y condiciones de firma.",
  operationType: "compraventa",
  jurisdiction: "ES",
  language: "es",
  metadata: { source: "test" },
};

const chunk: RAGChunk = {
  id: "chunk-1",
  document_id: "doc-1",
  content: "La informacion registral y las cargas deben verificarse antes de la firma.",
  metadata: {
    title: "Checklist compraventa",
    category: "inmobiliario",
    source_url: "https://example.test/compraventa",
  },
  similarity: 0.82,
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/validate-contract", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": "test-route" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body?: BodyInit): Request {
  return new Request("http://localhost/api/validate-contract", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": "test-route" },
    body,
  });
}

function handler(modelText: string, chunks: RAGChunk[] = [chunk]) {
  return createValidateContractPost({
    retrieve: async () => ({ chunks, cacheHit: false }),
    generate: async () => modelText,
    now: () => new Date("2026-06-12T00:00:00.000Z"),
  });
}

async function readJson(response: Response): Promise<any> {
  return response.json();
}

async function main(): Promise<void> {
  console.log("\nTest 1: POST without valid JSON body -> 400");
  {
  const response = await handler("{}")(rawRequest("{"));
  const body = await readJson(response);
  assert(response.status === 400, "invalid JSON returns 400");
  assert(body.error === "Invalid JSON body", "invalid JSON error is stable");
  }

  console.log("\nTest 2: POST without contract text -> 400");
  {
  const response = await handler("{}")(jsonRequest({ operationType: "compraventa" }));
  const body = await readJson(response);
  assert(response.status === 400, "missing text returns 400");
  assert(typeof body.error === "string", "missing text has error message");
  }

  console.log("\nTest 3: valid POST with correct model JSON -> 200");
  {
  const response = await handler(JSON.stringify({
    status: "ok",
    confidence: 0.87,
    summary: "Contrato sin bloqueos automaticos.",
    findings: [],
    required_actions: [],
  }))(jsonRequest(validBody));
  const body = await readJson(response);
  assert(response.status === 200, "valid request returns 200");
  assert(body.status === "ok", "status ok");
  assert(body.block_signing === false, "does not block signing");
  assert(body.legal_disclaimer.includes("notario"), "legal disclaimer included");
  assert(Array.isArray(body.sources) && body.sources.length === 1, "sources included");
  }

  console.log("\nTest 4: finding block_signing true propagates globally");
  {
  const response = await handler(JSON.stringify({
    status: "ok",
    confidence: 0.8,
    summary: "Hay bloqueo.",
    findings: [{
      severity: "high",
      category: "cargas",
      title: "Carga sin resolver",
      description: "Existe una carga sin aclarar.",
      recommendation: "Resolver la carga antes de firmar.",
      block_signing: true,
    }],
    required_actions: [],
  }))(jsonRequest(validBody));
  const body = await readJson(response);
  assert(response.status === 200, "blocking finding returns 200");
  assert(body.block_signing === true, "global block_signing true");
  assert(body.status === "review_required", "blocking finding requires review");
  }

  console.log("\nTest 5: critical severity blocks globally");
  {
  const response = await handler(JSON.stringify({
    status: "ok",
    confidence: 0.8,
    summary: "Critico.",
    findings: [{
      severity: "critical",
      category: "firma",
      title: "Falta autorizacion",
      description: "Falta autorizacion necesaria.",
      recommendation: "Aportar autorizacion antes de firmar.",
      block_signing: false,
    }],
    required_actions: [],
  }))(jsonRequest(validBody));
  const body = await readJson(response);
  assert(body.block_signing === true, "critical severity blocks signing");
  assert(body.findings[0].block_signing === true, "critical finding normalized to blocking");
  }

  console.log("\nTest 6: unparseable LLM JSON -> safe 200 fallback");
  {
  const response = await handler("not parseable")(jsonRequest(validBody));
  const body = await readJson(response);
  assert(response.status === 200, "unparseable model output returns 200");
  assert(body.status === "review_required", "unparseable model output requires review");
  assert(body.block_signing === true, "unparseable model output blocks signing");
  }

  console.log("\nTest 7: no RAG context -> 200 with safe warning");
  {
  const response = await handler(JSON.stringify({
    status: "ok",
    confidence: 0.7,
    summary: "Sin hallazgos del modelo.",
    findings: [],
    required_actions: [],
  }), [])(jsonRequest(validBody));
  const body = await readJson(response);
  assert(response.status === 200, "no RAG context returns 200");
  assert(body.status === "review_required", "no RAG context requires review");
  assert(body.findings.some((finding: any) => finding.category === "rag_context"), "RAG warning included");
  }

  console.log("\nTest 8: response always includes legal disclaimer");
  {
  const response = await handler(JSON.stringify({
    status: "ok",
    confidence: 0.9,
    summary: "OK",
    findings: [],
    required_actions: [],
  }))(jsonRequest(validBody));
  const body = await readJson(response);
  assert(typeof body.legal_disclaimer === "string", "legal disclaimer string present");
  assert(body.legal_disclaimer.includes("asesor cualificado"), "legal disclaimer content present");
  }

  console.log(`\n${passed + failed} tests - ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
