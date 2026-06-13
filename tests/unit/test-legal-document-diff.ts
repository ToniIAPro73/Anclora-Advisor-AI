/**
 * Unit tests for legal document diff (compare endpoint logic).
 * Run: npx tsx tests/unit/test-legal-document-diff.ts
 */

import {
  normalizeLegalCompareRequest,
  compareDocuments,
} from "../../src/lib/legal-documents/document-diff";

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

const canonicalCompraventa = `
  Partes: vendedor con DNI y comprador con NIE claramente identificados.
  Precio de venta: 250.000 EUR.
  Forma de pago: transferencia bancaria en el acto notarial.
  Descripción del inmueble: vivienda con referencia catastral.
  Cargas y gravámenes: libre de cargas.
  Notaría y gastos: según normativa vigente.
  Impuestos: ITP a cargo del comprador.
  Fecha de entrega: a la firma notarial.
  Arras: 25.000 EUR entregados a la firma del presente contrato.
`;

// ── Test 1: camelCase and snake_case normalization ────────────────────────────
console.log("\nTest 1: request normalization accepts camelCase and snake_case");
{
  const camel = normalizeLegalCompareRequest({
    submittedText: "texto",
    canonicalText: "plantilla",
    documentType: "compraventa",
  });
  assert(camel.submittedText === "texto", "camelCase submittedText");

  const snake = normalizeLegalCompareRequest({
    submitted_text: "texto",
    canonical_text: "plantilla",
    document_type: "compraventa",
  });
  assert(snake.submittedText === "texto", "snake_case submitted_text");
}

// ── Test 2: Identical documents produce no differences ────────────────────────
console.log("\nTest 2: identical documents produce no differences");
{
  const req = normalizeLegalCompareRequest({
    submittedText: canonicalCompraventa,
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const result = compareDocuments(req);
  assert(result.differences.length === 0, "no differences for identical docs");
  assert(result.risk_level === "low", "risk_level is low for identical docs");
  assert(result.block_signing === false, "block_signing false for identical docs");
}

// ── Test 3: Document with placeholder triggers block_signing ─────────────────
console.log("\nTest 3: placeholder in submitted document triggers block_signing");
{
  const req = normalizeLegalCompareRequest({
    submittedText: "Precio de venta: [PRECIO A DETERMINAR]. Partes: vendedor y comprador.",
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const result = compareDocuments(req);
  assert(result.differences.some((d) => d.type === "placeholder_detected"), "placeholder detected");
  assert(result.block_signing === true, "block_signing true when placeholder present");
  assert(result.risk_level === "critical", "risk_level critical for placeholder");
}

// ── Test 4: Missing sections from canonical flagged as differences ─────────────
console.log("\nTest 4: section missing from submitted vs canonical");
{
  const req = normalizeLegalCompareRequest({
    submittedText: "Partes: vendedor y comprador. Precio: pendiente de negociación.",
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const result = compareDocuments(req);
  assert(result.differences.length > 0, "differences detected for incomplete document");
  assert(result.review_requirement !== "none", "review_requirement is not none");
}

// ── Test 5: summary is non-empty ──────────────────────────────────────────────
console.log("\nTest 5: summary always non-empty");
{
  const req = normalizeLegalCompareRequest({
    submittedText: "Documento mínimo.",
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const result = compareDocuments(req);
  assert(typeof result.summary === "string" && result.summary.length > 0, "summary is non-empty string");
  assert(typeof result.legal_disclaimer === "string" && result.legal_disclaimer.length > 0, "legal_disclaimer present");
}

// ── Test 6: deduplication — same diff not repeated ────────────────────────────
console.log("\nTest 6: duplicate differences are deduplicated");
{
  const req = normalizeLegalCompareRequest({
    submittedText: "[PENDIENTE] [PENDIENTE] texto similar.",
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const result = compareDocuments(req);
  const placeholders = result.differences.filter((d) => d.type === "placeholder_detected");
  // There may be 2 (different match strings), but not 10+ duplicates
  assert(placeholders.length <= 5, "duplicates are bounded");
}

// ── Test 7: review_requirement escalates with risk_level ─────────────────────
console.log("\nTest 7: review_requirement maps correctly to risk_level");
{
  const criticalReq = normalizeLegalCompareRequest({
    submittedText: "[NOMBRE] [DNI] ________",
    canonicalText: canonicalCompraventa,
    documentType: "compraventa",
  });
  const critResult = compareDocuments(criticalReq);
  assert(
    critResult.review_requirement === "urgent",
    "review_requirement is urgent for critical risk",
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
