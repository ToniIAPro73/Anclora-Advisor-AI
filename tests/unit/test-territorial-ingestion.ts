/**
 * Unit tests for the territorial intelligence ingestion pipeline.
 * Validates scope governance, relevance scoring, and ingestion results.
 * Run: npx tsx tests/unit/test-territorial-ingestion.ts
 */

import {
  validateScopeGovernance,
  computeDefaultRelevance,
  ingestTerritorialDocument,
  ingestTerritorialBatch,
  processIngestionFolder,
  type IngestionDocument,
} from "../../lib/rag/territorial-ingestion";

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

// ----------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------

const validFiscalDoc: IngestionDocument = {
  document_id: "doc-001",
  notebook_id: "NOTEBOOK_01",
  domain: "fiscal",
  reason_for_fit:
    "Documento sobre fiscalidad de autónomos en Baleares con detalle de IVA e IRPF para 2026",
  title: "Guía fiscal autónomo Baleares 2026",
  content: `
    Esta guía cubre el régimen fiscal del autónomo en España, con especial atención
    a las deducciones disponibles en Baleares. Se analizan los modelos 303 (IVA) y 130 (IRPF),
    la cuota de RETA, y las deducciones específicas para contribuyentes de Illes Balears.
    Incluye escenarios de facturación intracomunitaria y normativa AEAT actualizada.
  `.repeat(3),
};

const validLaborDoc: IngestionDocument = {
  document_id: "doc-002",
  notebook_id: "NOTEBOOK_02",
  domain: "laboral",
  reason_for_fit:
    "Análisis de riesgos de pluriactividad y compatibilidad contractual para la transición profesional",
  title: "Riesgos de pluriactividad y excedencia 2026",
  content: `
    El presente documento analiza las implicaciones legales de la pluriactividad
    en España, los escenarios de conflicto contractual, la compatibilidad laboral
    con la actividad de autónomo, el riesgo reputacional y el timing de salida.
    Se detallan los procedimientos de excedencia y baja voluntaria.
  `.repeat(3),
};

const validMarketDoc: IngestionDocument = {
  document_id: "doc-003",
  notebook_id: "NOTEBOOK_03",
  domain: "mercado",
  reason_for_fit:
    "Estrategia de posicionamiento premium para marca inmobiliaria con narrativa comercial y conversión",
  title: "Posicionamiento premium PropTech Mallorca",
  content: `
    Análisis de posicionamiento de marca en el sector inmobiliario de Mallorca.
    Se cubren la narrativa estratégica, autoridad comercial, USP diferencial,
    conversión de leads premium y presencia LinkedIn para inmobiliaria de lujo.
    El posicionamiento premium requiere coherencia visual y propuesta de valor clara.
  `.repeat(3),
};

const scopeMismatchDoc: IngestionDocument = {
  document_id: "doc-004",
  notebook_id: "NOTEBOOK_01",
  domain: "laboral", // fiscal notebook but laboral domain
  reason_for_fit:
    "Documento sobre despido y pluriactividad que no encaja en fiscalidad",
  title: "Guía de despido laboral",
  content:
    "El despido improcedente en España y la pluriactividad del trabajador.",
};

const lowRelevanceDoc: IngestionDocument = {
  document_id: "doc-005",
  notebook_id: "NOTEBOOK_03",
  domain: "mercado",
  reason_for_fit:
    "Breve nota sobre tendencias generales de marca y posicionamiento para narrativa comercial",
  title: "Nota breve",
  content: "Texto corto sin detalle.", // very short → low relevance
};

const unknownNotebookDoc: IngestionDocument = {
  document_id: "doc-006",
  notebook_id: "NOTEBOOK_99",
  domain: "fiscal",
  reason_for_fit:
    "Documento para un notebook inexistente que debería ser rechazado",
  title: "Documento huérfano",
  content: "Contenido sin notebook destino válido.",
};

const missingReasonDoc: IngestionDocument = {
  document_id: "doc-007",
  notebook_id: "NOTEBOOK_01",
  domain: "fiscal",
  reason_for_fit: "Corta", // too short (< 24 chars)
  title: "Fiscal sin razón válida",
  content:
    "Contenido fiscal sobre IVA y autónomos en Baleares con deducciones IRPF y RETA y cuota cero.",
};

// ----------------------------------------------------------------
// Test 1: Scope governance validation — valid documents
// ----------------------------------------------------------------

console.log("\nTest 1: Valid documents pass scope governance");

assert(
  validateScopeGovernance(validFiscalDoc).valid === true,
  "Valid fiscal document passes scope governance",
);
assert(
  validateScopeGovernance(validLaborDoc).valid === true,
  "Valid labor document passes scope governance",
);
assert(
  validateScopeGovernance(validMarketDoc).valid === true,
  "Valid market document passes scope governance",
);

// ----------------------------------------------------------------
// Test 2: Scope governance validation — domain mismatch
// ----------------------------------------------------------------

console.log("\nTest 2: Domain mismatch rejects with SOURCE_SCOPE_MISMATCH");

const mismatchResult = validateScopeGovernance(scopeMismatchDoc);
assert(mismatchResult.valid === false, "Domain mismatch document is rejected");
assert(
  mismatchResult.reason === "SOURCE_SCOPE_MISMATCH",
  "Rejection reason is SOURCE_SCOPE_MISMATCH",
);

// ----------------------------------------------------------------
// Test 3: Scope governance validation — unknown notebook
// ----------------------------------------------------------------

console.log("\nTest 3: Unknown notebook_id rejects with SOURCE_SCOPE_MISMATCH");

const unknownResult = validateScopeGovernance(unknownNotebookDoc);
assert(unknownResult.valid === false, "Unknown notebook document is rejected");
assert(
  unknownResult.reason === "SOURCE_SCOPE_MISMATCH",
  "Rejection reason is SOURCE_SCOPE_MISMATCH for unknown notebook",
);

// ----------------------------------------------------------------
// Test 4: Scope governance — missing/short reason_for_fit
// ----------------------------------------------------------------

console.log(
  "\nTest 4: Short reason_for_fit rejects with SOURCE_SCOPE_MISMATCH",
);

const missingReasonResult = validateScopeGovernance(missingReasonDoc);
assert(
  missingReasonResult.valid === false,
  "Missing reason_for_fit document is rejected",
);
assert(
  missingReasonResult.reason === "SOURCE_SCOPE_MISMATCH",
  "Rejection reason is SOURCE_SCOPE_MISMATCH for short reason",
);

// ----------------------------------------------------------------
// Test 5: Default relevance computation
// ----------------------------------------------------------------

console.log("\nTest 5: Default relevance scoring");

const fiscalRelevance = computeDefaultRelevance(validFiscalDoc);
assert(
  fiscalRelevance >= 0.7,
  `Valid fiscal doc relevance (${fiscalRelevance.toFixed(2)}) >= 0.7`,
);

const marketRelevance = computeDefaultRelevance(validMarketDoc);
assert(
  marketRelevance >= 0.7,
  `Valid market doc relevance (${marketRelevance.toFixed(2)}) >= 0.7`,
);

const lowRelevance = computeDefaultRelevance(lowRelevanceDoc);
assert(
  lowRelevance < 0.7,
  `Low relevance doc score (${lowRelevance.toFixed(2)}) < 0.7`,
);

// ----------------------------------------------------------------
// Test 6: Ingestion pipeline — successful ingestion
// ----------------------------------------------------------------

console.log("\nTest 6: Successful document ingestion");

async function testSuccessfulIngestion(): Promise<void> {
  const result = await ingestTerritorialDocument(validFiscalDoc, {
    relevanceThreshold: 0.7,
  });

  assert(result.status === "ingested", "Valid document is ingested");
  assert(result.document_id === "doc-001", "Document ID is preserved");
  assert(result.notebook_id === "NOTEBOOK_01", "Notebook ID is preserved");
  assert(result.domain === "fiscal", "Domain is preserved");
  assert(
    result.rejection_reason === undefined,
    "No rejection reason for ingested doc",
  );
}

// ----------------------------------------------------------------
// Test 7: Ingestion pipeline — scope mismatch rejection
// ----------------------------------------------------------------

console.log("\nTest 7: Scope mismatch rejection in pipeline");

async function testScopeMismatchRejection(): Promise<void> {
  const result = await ingestTerritorialDocument(scopeMismatchDoc);

  assert(result.status === "rejected", "Scope mismatch document is rejected");
  assert(
    result.rejection_reason === "SOURCE_SCOPE_MISMATCH",
    "Rejection reason is SOURCE_SCOPE_MISMATCH",
  );
}

// ----------------------------------------------------------------
// Test 8: Ingestion pipeline — low relevance rejection
// ----------------------------------------------------------------

console.log("\nTest 8: Low relevance rejection in pipeline");

async function testLowRelevanceRejection(): Promise<void> {
  const result = await ingestTerritorialDocument(lowRelevanceDoc, {
    relevanceThreshold: 0.7,
  });

  assert(result.status === "rejected", "Low relevance document is rejected");
  assert(
    result.rejection_reason === "LOW_RELEVANCE",
    "Rejection reason is LOW_RELEVANCE",
  );
}

// ----------------------------------------------------------------
// Test 9: Batch ingestion
// ----------------------------------------------------------------

console.log("\nTest 9: Batch ingestion processes all documents");

async function testBatchIngestion(): Promise<void> {
  const docs = [
    validFiscalDoc,
    scopeMismatchDoc,
    lowRelevanceDoc,
    validLaborDoc,
  ];
  const results = await ingestTerritorialBatch(docs, {
    relevanceThreshold: 0.7,
  });

  assert(results.length === 4, "Batch produces results for all documents");
  assert(results[0].status === "ingested", "First doc is ingested");
  assert(
    results[1].status === "rejected",
    "Second doc (scope mismatch) is rejected",
  );
  assert(
    results[2].status === "rejected",
    "Third doc (low relevance) is rejected",
  );
  assert(results[3].status === "ingested", "Fourth doc is ingested");
}

// ----------------------------------------------------------------
// Test 10: processIngestionFolder summary
// ----------------------------------------------------------------

console.log("\nTest 10: Ingestion folder processing with summary");

async function testIngestionFolder(): Promise<void> {
  const docs = [
    validFiscalDoc,
    scopeMismatchDoc,
    lowRelevanceDoc,
    validLaborDoc,
    validMarketDoc,
  ];
  const { results, summary } = await processIngestionFolder(docs, {
    relevanceThreshold: 0.7,
  });

  assert(results.length === 5, "All documents processed");
  assert(summary.total === 5, "Total count is correct");
  assert(summary.ingested === 3, "Three documents ingested");
  assert(summary.rejected === 2, "Two documents rejected");
  assert(
    summary.rejectedByScopeMismatch === 1,
    "One rejected by scope mismatch",
  );
  assert(summary.rejectedByLowRelevance === 1, "One rejected by low relevance");
}

// ----------------------------------------------------------------
// Test 11: Full canonical notebook names accepted
// ----------------------------------------------------------------

console.log("\nTest 11: Full canonical notebook names accepted");

const canonicalNameDoc: IngestionDocument = {
  ...validFiscalDoc,
  document_id: "doc-canonical",
  notebook_id: "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
};

assert(
  validateScopeGovernance(canonicalNameDoc).valid === true,
  "Full canonical notebook name is accepted",
);

// ----------------------------------------------------------------
// Test 12: Custom relevance function
// ----------------------------------------------------------------

console.log("\nTest 12: Custom relevance function overrides default");

async function testCustomRelevance(): Promise<void> {
  // Force high relevance for a document that would normally be low
  const result = await ingestTerritorialDocument(lowRelevanceDoc, {
    relevanceThreshold: 0.7,
    computeRelevance: async () => 0.95,
  });

  // The document fails scope governance first (lowRelevanceDoc passes governance but has low relevance)
  // Actually this doc has domain='mercado' and notebook='NOTEBOOK_03', so governance should pass
  assert(
    result.status === "ingested",
    "Custom high relevance overrides default scoring",
  );
}

// ----------------------------------------------------------------
// Test 13: Persist callback is called
// ----------------------------------------------------------------

console.log("\nTest 13: Persist callback is invoked on successful ingestion");

async function testPersistCallback(): Promise<void> {
  let persistCalled = false;
  let persistedDoc: IngestionDocument | null = null;

  await ingestTerritorialDocument(validFiscalDoc, {
    relevanceThreshold: 0.7,
    persistDocument: async (doc) => {
      persistCalled = true;
      persistedDoc = doc;
    },
  });

  assert(persistCalled === true, "Persist callback was called");
  assert(
    persistedDoc?.document_id === "doc-001",
    "Correct document was persisted",
  );
}

// ----------------------------------------------------------------
// Run async tests
// ----------------------------------------------------------------

async function runAsyncTests(): Promise<void> {
  await testSuccessfulIngestion();
  await testScopeMismatchRejection();
  await testLowRelevanceRejection();
  await testBatchIngestion();
  await testIngestionFolder();
  await testCustomRelevance();
  await testPersistCallback();
}

runAsyncTests()
  .then(() => {
    console.log(`\n${"=".repeat(50)}`);
    console.log(
      `TERRITORIAL INGESTION TESTS: ${passed} passed, ${failed} failed`,
    );
    console.log("=".repeat(50));

    if (failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  });
