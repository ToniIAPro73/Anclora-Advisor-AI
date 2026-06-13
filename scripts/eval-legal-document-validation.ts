import fs from "node:fs";
import path from "node:path";
import { validateLegalDocument } from "../src/lib/legal-documents/legal-document-validator";
import type { LegalDocumentValidatorDependencies } from "../src/lib/legal-documents/legal-document-validator";
import type { RAGChunk, RetrievalResult } from "../src/lib/rag/retrieval";

interface EvalCase {
  id: string;
  expected_status: string;
  expected_block_signing: boolean;
  document_type: string;
  current_text: string;
  canonical_text?: string;
  variable_snapshot?: Record<string, unknown>;
  source_mode?: "none" | "current";
  model_status?: string;
  model_findings?: unknown[];
}

const datasetPath = process.argv[2] ?? path.join("docs", "evals", "legal_document_validation_dataset_v1.json");
const cases = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as EvalCase[];

const source: RAGChunk = {
  id: "eval-source",
  document_id: "eval-source",
  content: "Synthetic current legal source for real-estate document validation. Identity, price, object, dates, jurisdiction, annexes and temporal cause must be checked.",
  metadata: {
    title: "Synthetic legal validation source",
    category: "legal",
    source_url: "https://example.test/synthetic-legal-source",
    doc_metadata: {
      jurisdiction: "España",
      status: "current",
      authority: "Synthetic QA",
      source_type: "qa",
      confidence: 0.95,
      reviewed_at: "2026-06-13"
    }
  },
  similarity: 0.95
};

async function run(): Promise<void> {
  let failed = 0;
  for (const item of cases) {
    const deps: LegalDocumentValidatorDependencies = {
      retrieve: async (): Promise<RetrievalResult> => ({
        chunks: item.source_mode === "none" ? [] : [source],
        query: item.id,
        cached: false
      }),
      generate: async () => JSON.stringify({
        status: item.model_status ?? "approved",
        confidence: 0.9,
        summary: "Synthetic evaluation result.",
        findings: item.model_findings ?? [],
        required_actions: []
      }),
      now: () => new Date("2026-06-13T00:00:00.000Z")
    };

    const result = await validateLegalDocument({
      documentId: item.id,
      documentType: item.document_type,
      operationType: item.document_type,
      jurisdiction: "España",
      language: "es",
      currentText: item.current_text,
      canonicalText: item.canonical_text,
      variableSnapshot: item.variable_snapshot,
      requestId: `eval-${item.id}`
    }, `eval-${item.id}`, deps);

    const body = result.body;
    if ("error" in body) {
      console.error(`${item.id}: unexpected error ${body.error}`);
      failed += 1;
      continue;
    }

    const ok = body.status === item.expected_status && body.block_signing === item.expected_block_signing;
    console.log(`${ok ? "PASS" : "FAIL"} ${item.id}: status=${body.status} block=${body.block_signing}`);
    if (!ok) failed += 1;
  }

  if (failed > 0) {
    console.error(`Legal validation eval failed: ${failed}/${cases.length}`);
    process.exit(1);
  }
  console.log(`Legal validation eval passed: ${cases.length}/${cases.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
