import assert from "node:assert/strict";
import { buildDocumentVersionDiff, type RagDocumentVersionRecord } from "@/lib/rag/admin-document-versions";

function createVersion(overrides: Partial<RagDocumentVersionRecord>): RagDocumentVersionRecord {
  return {
    id: overrides.id ?? "version-a",
    document_id: overrides.document_id ?? "doc-1",
    version_number: overrides.version_number ?? 2,
    snapshot_reason: overrides.snapshot_reason ?? "test",
    title: overrides.title ?? "Documento A",
    category: overrides.category ?? "fiscal",
    source_url: overrides.source_url ?? "https://example.com/a",
    doc_metadata: overrides.doc_metadata ?? {
      topic: "iva",
      jurisdiction: "ES-IB",
      notebook_id: "nb-1",
      notebook_title: "Notebook Fiscal",
      reason_for_fit: "Encaja",
    },
    chunk_count: overrides.chunk_count ?? 2,
    chunk_char_count: overrides.chunk_char_count ?? 40,
    snapshot_payload: overrides.snapshot_payload ?? {
      document: {
        id: "doc-1",
        title: "Documento A",
        category: "fiscal",
        source_url: "https://example.com/a",
        doc_metadata: {
          topic: "iva",
        },
      },
      chunks: [
        { content: "Articulo 1 base imponible", token_count: 5 },
        { content: "Articulo 2 tipo general", token_count: 5 },
      ],
    },
    created_by: overrides.created_by ?? "user-1",
    created_at: overrides.created_at ?? "2026-03-01T10:00:00.000Z",
  };
}

const leftVersion = createVersion({});
const rightVersion = createVersion({
  id: "version-b",
  version_number: 1,
  title: "Documento B",
  source_url: "https://example.com/b",
  doc_metadata: {
    topic: "irpf",
    jurisdiction: "ES",
    notebook_id: "nb-1",
    notebook_title: "Notebook Fiscal",
    reason_for_fit: "Encaja distinto",
  },
  chunk_count: 2,
  chunk_char_count: 43,
  snapshot_payload: {
    document: {
      id: "doc-1",
      title: "Documento B",
      category: "fiscal",
      source_url: "https://example.com/b",
      doc_metadata: {
        topic: "irpf",
      },
    },
    chunks: [
      { content: "Articulo 1 base imponible", token_count: 5 },
      { content: "Articulo 3 retenciones", token_count: 4 },
    ],
  },
});

const diff = buildDocumentVersionDiff(leftVersion, rightVersion);

assert.equal(diff.leftVersion.version_number, 2);
assert.equal(diff.rightVersion.version_number, 1);
assert.equal(diff.fieldChanges.some((change) => change.field === "title"), true);
assert.equal(diff.fieldChanges.some((change) => change.field === "source_url"), true);
assert.equal(diff.fieldChanges.some((change) => change.field === "metadata.topic"), true);
assert.equal(diff.chunkChanges.removedCount, 1);
assert.equal(diff.chunkChanges.addedCount, 1);
assert.equal(diff.chunkChanges.unchangedCount, 1);
assert.equal(diff.chunkChanges.removedSamples[0]?.includes("Articulo 2"), true);
assert.equal(diff.chunkChanges.addedSamples[0]?.includes("Articulo 3"), true);

console.log("test-admin-rag-document-versions: ok");
