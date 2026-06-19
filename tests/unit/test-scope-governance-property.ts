/**
 * Property-Based Test: NotebookLM Scope Governance Validation (Property 5)
 *
 * For any document submitted for ingestion or sync, the validation function
 * shall accept the document if and only if its domain matches the allowed
 * scope of the target notebook_id. Documents with mismatched scope shall be
 * rejected with SOURCE_SCOPE_MISMATCH.
 *
 * **Validates: Requirements 6.2, 8.2, 8.3**
 *
 * Run: npx tsx tests/unit/test-scope-governance-property.ts
 */

import * as fc from "fast-check";
import {
  validateScopeGovernance,
  type IngestionDocument,
} from "../../lib/rag/territorial-ingestion";

// ----------------------------------------------------------------
// Scope mapping (mirrors the NOTEBOOK_SCOPE_MAP in the source)
// ----------------------------------------------------------------

const VALID_NOTEBOOK_IDS = [
  "NOTEBOOK_01",
  "NOTEBOOK_02",
  "NOTEBOOK_03",
  "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
  "ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL",
  "ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO",
] as const;

type ValidNotebookId = (typeof VALID_NOTEBOOK_IDS)[number];

const NOTEBOOK_TO_DOMAIN: Record<ValidNotebookId, string> = {
  NOTEBOOK_01: "fiscal",
  NOTEBOOK_02: "laboral",
  NOTEBOOK_03: "mercado",
  ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL: "fiscal",
  ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL: "laboral",
  ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO: "mercado",
};

const ALL_DOMAINS = ["fiscal", "laboral", "mercado"] as const;

// ----------------------------------------------------------------
// Domain-specific keyword pools for generating content that passes
// the content-level scope validation in governance.ts
// ----------------------------------------------------------------

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fiscal: [
    "autónomo",
    "iva",
    "irpf",
    "reta",
    "deducción",
    "cuota cero",
    "inspección",
    "facturación",
    "tributación",
    "baleares",
  ],
  laboral: [
    "pluriactividad",
    "compatibilidad",
    "contrato",
    "despido",
    "excedencia",
    "laboral",
    "transición",
    "conflicto",
    "riesgo",
    "reputacional",
  ],
  mercado: [
    "marca",
    "posicionamiento",
    "premium",
    "usp",
    "narrativa",
    "autoridad",
    "conversión",
    "comercial",
    "linkedin",
    "inmobiliario",
  ],
};

// ----------------------------------------------------------------
// Generators
// ----------------------------------------------------------------

/** Generates a valid notebook_id from known notebooks */
const validNotebookIdArb = fc.constantFrom(...VALID_NOTEBOOK_IDS);

/** Generates a domain from the three valid domains */
const validDomainArb = fc.constantFrom(...ALL_DOMAINS);

/** Generates an unknown notebook_id (not in VALID_NOTEBOOK_IDS) */
const unknownNotebookIdArb = fc
  .string({ minLength: 5, maxLength: 30 })
  .filter(
    (s) => !VALID_NOTEBOOK_IDS.includes(s as ValidNotebookId) && s.length >= 5,
  );

/** Generates a valid reason_for_fit (>= 24 chars, with relevant keywords) */
function validReasonForFitArb(domain: string): fc.Arbitrary<string> {
  const keywords = DOMAIN_KEYWORDS[domain] ?? DOMAIN_KEYWORDS["fiscal"];
  return fc
    .tuple(
      fc.constantFrom(...keywords),
      fc.constantFrom(...keywords),
      fc.string({ minLength: 10, maxLength: 80 }),
    )
    .map(
      ([kw1, kw2, extra]) =>
        `Documento relevante sobre ${kw1} y ${kw2} con contexto de ${extra}`,
    );
}

/** Generates content with domain-specific keywords (at least 2 required for governance) */
function domainContentArb(domain: string): fc.Arbitrary<string> {
  const keywords = DOMAIN_KEYWORDS[domain] ?? DOMAIN_KEYWORDS["fiscal"];
  return fc
    .tuple(
      fc.constantFrom(...keywords),
      fc.constantFrom(...keywords),
      fc.constantFrom(...keywords),
      fc.string({ minLength: 50, maxLength: 200 }),
    )
    .map(([kw1, kw2, kw3, filler]) =>
      `Análisis detallado sobre ${kw1}, incluyendo aspectos de ${kw2} y ${kw3}. ${filler}. `.repeat(
        5,
      ),
    );
}

/** Generates a matching document (notebook_id + correct domain + valid content) */
const matchingDocumentArb: fc.Arbitrary<IngestionDocument> =
  validNotebookIdArb.chain((notebookId) => {
    const expectedDomain = NOTEBOOK_TO_DOMAIN[notebookId];
    return fc
      .tuple(
        fc.uuid(),
        validReasonForFitArb(expectedDomain),
        domainContentArb(expectedDomain),
        fc.string({ minLength: 5, maxLength: 50 }),
      )
      .map(([docId, reason, content, title]) => ({
        document_id: docId,
        notebook_id: notebookId,
        domain: expectedDomain,
        reason_for_fit: reason,
        title,
        content,
      }));
  });

/** Generates a mismatched document (valid notebook_id + WRONG domain) */
const mismatchedDocumentArb: fc.Arbitrary<IngestionDocument> =
  validNotebookIdArb.chain((notebookId) => {
    const expectedDomain = NOTEBOOK_TO_DOMAIN[notebookId];
    const wrongDomains = ALL_DOMAINS.filter((d) => d !== expectedDomain);
    return fc
      .tuple(
        fc.uuid(),
        fc.constantFrom(...wrongDomains),
        fc.string({ minLength: 30, maxLength: 100 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 100, maxLength: 300 }),
      )
      .map(([docId, wrongDomain, reason, title, content]) => ({
        document_id: docId,
        notebook_id: notebookId,
        domain: wrongDomain,
        reason_for_fit: reason,
        title,
        content,
      }));
  });

/** Generates a document with an unknown notebook_id */
const unknownNotebookDocArb: fc.Arbitrary<IngestionDocument> = fc
  .tuple(
    fc.uuid(),
    unknownNotebookIdArb,
    validDomainArb,
    fc.string({ minLength: 30, maxLength: 100 }),
    fc.string({ minLength: 5, maxLength: 50 }),
    fc.string({ minLength: 100, maxLength: 300 }),
  )
  .map(([docId, notebookId, domain, reason, title, content]) => ({
    document_id: docId,
    notebook_id: notebookId,
    domain,
    reason_for_fit: reason,
    title,
    content,
  }));

// ----------------------------------------------------------------
// Test runner
// ----------------------------------------------------------------

let passed = 0;
let failed = 0;

function reportProperty(
  name: string,
  result: { failed: boolean; counterexample?: unknown; error?: unknown },
): void {
  if (result.failed) {
    console.error(`  FAIL: ${name}`);
    if (result.counterexample) {
      console.error(
        `    Counterexample: ${JSON.stringify(result.counterexample, null, 2)}`,
      );
    }
    if (result.error) {
      console.error(`    Error: ${result.error}`);
    }
    failed++;
  } else {
    console.log(`  PASS: ${name}`);
    passed++;
  }
}

// ----------------------------------------------------------------
// Property 5.1: Matching domain → accepted (valid=true)
// ----------------------------------------------------------------

console.log(
  "\nProperty 5.1: Documents with matching domain are accepted (valid=true)",
);

const prop51 = fc.check(
  fc.property(matchingDocumentArb, (doc) => {
    const result = validateScopeGovernance(doc);
    return result.valid === true && result.reason === undefined;
  }),
  { numRuns: 200 },
);

reportProperty(
  "Matching domain → accepted (valid=true, no rejection reason)",
  prop51,
);

// ----------------------------------------------------------------
// Property 5.2: Mismatched domain → rejected with SOURCE_SCOPE_MISMATCH
// ----------------------------------------------------------------

console.log(
  "\nProperty 5.2: Documents with mismatched domain are rejected with SOURCE_SCOPE_MISMATCH",
);

const prop52 = fc.check(
  fc.property(mismatchedDocumentArb, (doc) => {
    const result = validateScopeGovernance(doc);
    return result.valid === false && result.reason === "SOURCE_SCOPE_MISMATCH";
  }),
  { numRuns: 200 },
);

reportProperty(
  "Mismatched domain → rejected with SOURCE_SCOPE_MISMATCH",
  prop52,
);

// ----------------------------------------------------------------
// Property 5.3: Unknown notebook_id → rejected with SOURCE_SCOPE_MISMATCH
// ----------------------------------------------------------------

console.log(
  "\nProperty 5.3: Documents with unknown notebook_id are rejected with SOURCE_SCOPE_MISMATCH",
);

const prop53 = fc.check(
  fc.property(unknownNotebookDocArb, (doc) => {
    const result = validateScopeGovernance(doc);
    return result.valid === false && result.reason === "SOURCE_SCOPE_MISMATCH";
  }),
  { numRuns: 200 },
);

reportProperty(
  "Unknown notebook_id → rejected with SOURCE_SCOPE_MISMATCH",
  prop53,
);

// ----------------------------------------------------------------
// Property 5.4: Accept iff domain matches (biconditional completeness)
// Documents are either accepted (matching) or rejected (non-matching).
// ----------------------------------------------------------------

console.log(
  "\nProperty 5.4: Accept iff domain matches allowed scope (biconditional)",
);

const anyDocumentArb: fc.Arbitrary<IngestionDocument> = fc
  .tuple(
    fc.uuid(),
    fc.oneof(validNotebookIdArb, unknownNotebookIdArb),
    fc.oneof(validDomainArb, fc.string({ minLength: 3, maxLength: 20 })),
    fc.string({ minLength: 30, maxLength: 120 }),
    fc.string({ minLength: 5, maxLength: 50 }),
    fc.string({ minLength: 100, maxLength: 300 }),
  )
  .map(([docId, notebookId, domain, reason, title, content]) => ({
    document_id: docId,
    notebook_id: notebookId,
    domain,
    reason_for_fit: reason,
    title,
    content,
  }));

const prop54 = fc.check(
  fc.property(anyDocumentArb, (doc) => {
    const result = validateScopeGovernance(doc);

    // If rejected, reason must be SOURCE_SCOPE_MISMATCH
    if (!result.valid) {
      return result.reason === "SOURCE_SCOPE_MISMATCH";
    }

    // If accepted, the notebook_id must be known and the domain must match
    const isKnownNotebook = VALID_NOTEBOOK_IDS.includes(
      doc.notebook_id as ValidNotebookId,
    );
    if (!isKnownNotebook) return false;

    const expectedDomain =
      NOTEBOOK_TO_DOMAIN[doc.notebook_id as ValidNotebookId];
    return doc.domain === expectedDomain;
  }),
  { numRuns: 300 },
);

reportProperty(
  "Accept iff notebook known AND domain matches allowed scope",
  prop54,
);

// ----------------------------------------------------------------
// Summary
// ----------------------------------------------------------------

console.log(`\n${"=".repeat(60)}`);
console.log(
  `SCOPE GOVERNANCE PROPERTY TESTS (Property 5): ${passed} passed, ${failed} failed`,
);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
