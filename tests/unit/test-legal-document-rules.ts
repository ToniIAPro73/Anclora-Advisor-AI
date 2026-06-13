/**
 * Unit tests for deterministic legal document rules.
 * Run: npx tsx tests/unit/test-legal-document-rules.ts
 */

import { runDeterministicRules, computeRiskLevel } from "../../src/lib/legal-documents/deterministic-rules";

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

// ── Test 1: Placeholder detection ─────────────────────────────────────────────
console.log("\nTest 1: placeholder detection");
{
  const text = "El arrendatario [NOMBRE COMPLETO] con DNI ___________ firma el contrato.";
  const result = runDeterministicRules(text, "alquiler_temporada");
  assert(result.placeholdersFound > 0, "detects bracket placeholder");
  assert(result.differences.some((d) => d.type === "placeholder_detected"), "type is placeholder_detected");
  assert(result.differences.some((d) => d.severity === "critical"), "placeholder severity is critical");
}

// ── Test 2: Missing required clauses ─────────────────────────────────────────
console.log("\nTest 2: missing clause detection for compraventa");
{
  const text = "Contrato de compraventa. Las partes acuerdan la venta del inmueble descrito.";
  const result = runDeterministicRules(text, "compraventa");
  assert(result.missingClauses.length > 0, "detects missing required clauses");
  assert(result.differences.some((d) => d.type === "missing_clause"), "type is missing_clause");
  assert(result.differences.some((d) => d.severity === "high"), "missing clause severity is high");
}

// ── Test 3: Clean document — no differences ───────────────────────────────────
console.log("\nTest 3: clean document with all required clauses");
{
  const text = `
    Contrato de alquiler de temporada.
    Partes: arrendador con DNI y arrendatario con NIE.
    Causa de temporalidad: estancia laboral de dos meses.
    Renta: 1.200 EUR al mes.
    Duración: del 1 de julio al 31 de agosto.
    Fianza: 2.400 EUR depositados a la firma.
    Inventario adjunto al contrato.
    Suministros incluidos.
    Rescisión: según LAU artículo 11.
  `;
  const result = runDeterministicRules(text, "alquiler_temporada");
  assert(result.placeholdersFound === 0, "no placeholders in clean document");
  assert(result.missingClauses.length === 0, "no missing clauses in complete document");
}

// ── Test 4: Date anomaly detection ────────────────────────────────────────────
console.log("\nTest 4: date anomaly detection");
{
  const text = "Contrato firmado el 15/03/2018 con vencimiento 31/12/2018.";
  const result = runDeterministicRules(text, "generico");
  assert(result.differences.some((d) => d.type === "date_anomaly"), "detects past date anomaly");
}

// ── Test 5: Amount anomaly when canonical text provided ───────────────────────
console.log("\nTest 5: amount anomaly vs canonical template");
{
  const canonical = "Precio de venta: 250.000 EUR.";
  const submitted = "Precio de venta: 180.000 EUR.";
  const result = runDeterministicRules(submitted, "compraventa", canonical);
  assert(result.differences.some((d) => d.type === "amount_anomaly"), "detects amount mismatch");
}

// ── Test 6: computeRiskLevel escalation ───────────────────────────────────────
console.log("\nTest 6: computeRiskLevel escalation");
{
  const diffs = [
    { type: "missing_clause" as const, description: "test", severity: "medium" as const },
    { type: "placeholder_detected" as const, description: "test", severity: "critical" as const },
  ];
  assert(computeRiskLevel(diffs) === "critical", "escalates to critical when any diff is critical");
}

// ── Test 7: No canonical — only submitted text analyzed ───────────────────────
console.log("\nTest 7: no canonical template — only submitted analyzed");
{
  const text = "Contrato de arrendamiento turístico con DNI de las partes, causa de temporalidad, número de licencia válido, precio por noche, capacidad máxima, limpieza, cancelación, fianza.";
  const result = runDeterministicRules(text, "alquiler_turistico");
  assert(result.missingClauses.length === 0, "all required clauses present for alquiler_turistico");
  assert(result.placeholdersFound === 0, "no placeholders");
}

// ── Test 8: seasonal rental requires temporal cause ──────────────────────────
console.log("\nTest 8: seasonal rental temporal cause is critical");
{
  const text = "Contrato de alquiler de temporada con DNI de las partes. Renta, duración, fianza, inventario, suministros y rescisión.";
  const result = runDeterministicRules(text, "alquiler_temporada");
  assert(result.differences.some((d) => d.field === "temporal_cause"), "detects missing temporal cause");
  assert(result.differences.some((d) => d.severity === "critical"), "missing temporal cause is critical");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
