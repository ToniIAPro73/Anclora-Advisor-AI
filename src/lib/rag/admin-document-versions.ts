import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";
import { generateEmbedding } from "@/lib/rag/embeddings";

type RagDocumentRow = {
  id: string;
  title: string;
  category: string | null;
  source_url: string | null;
  doc_metadata: Record<string, unknown> | null;
};

type RagChunkRow = {
  content: string;
  token_count: number | null;
};

export interface RagDocumentVersionRecord {
  id: string;
  document_id: string;
  version_number: number;
  snapshot_reason: string;
  title: string;
  category: string | null;
  source_url: string | null;
  doc_metadata: Record<string, unknown> | null;
  chunk_count: number;
  chunk_char_count: number;
  snapshot_payload: {
    document: RagDocumentRow;
    chunks: Array<{ content: string; token_count: number }>;
  };
  created_by: string | null;
  created_at: string;
}

export interface RagDocumentVersionDiffRecord {
  leftVersion: Pick<RagDocumentVersionRecord, "id" | "version_number" | "snapshot_reason" | "created_at">;
  rightVersion: Pick<RagDocumentVersionRecord, "id" | "version_number" | "snapshot_reason" | "created_at">;
  fieldChanges: Array<{
    field: string;
    leftValue: string;
    rightValue: string;
  }>;
  stats: {
    leftChunkCount: number;
    rightChunkCount: number;
    chunkCountDelta: number;
    leftChunkCharCount: number;
    rightChunkCharCount: number;
    chunkCharCountDelta: number;
  };
  chunkChanges: {
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
    addedSamples: string[];
    removedSamples: string[];
  };
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function normalizeChunkContent(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function buildChunkSample(content: string): string {
  const normalized = normalizeChunkContent(content);
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

export function buildDocumentVersionDiff(
  leftVersion: RagDocumentVersionRecord,
  rightVersion: RagDocumentVersionRecord
): RagDocumentVersionDiffRecord {
  const leftMetadata = leftVersion.doc_metadata ?? {};
  const rightMetadata = rightVersion.doc_metadata ?? {};
  const fieldChanges: RagDocumentVersionDiffRecord["fieldChanges"] = [];
  const trackedFields: Array<[string, unknown, unknown]> = [
    ["title", leftVersion.title, rightVersion.title],
    ["category", leftVersion.category, rightVersion.category],
    ["source_url", leftVersion.source_url, rightVersion.source_url],
    ["metadata.notebook_id", leftMetadata.notebook_id, rightMetadata.notebook_id],
    ["metadata.notebook_title", leftMetadata.notebook_title, rightMetadata.notebook_title],
    ["metadata.jurisdiction", leftMetadata.jurisdiction, rightMetadata.jurisdiction],
    ["metadata.topic", leftMetadata.topic, rightMetadata.topic],
    ["metadata.reason_for_fit", leftMetadata.reason_for_fit, rightMetadata.reason_for_fit],
  ];

  for (const [field, leftValueRaw, rightValueRaw] of trackedFields) {
    const leftValue = normalizeValue(leftValueRaw);
    const rightValue = normalizeValue(rightValueRaw);
    if (leftValue !== rightValue) {
      fieldChanges.push({
        field,
        leftValue: leftValue || "vacio",
        rightValue: rightValue || "vacio",
      });
    }
  }

  const leftChunkMap = new Map<string, number>();
  for (const chunk of leftVersion.snapshot_payload.chunks ?? []) {
    const key = normalizeChunkContent(chunk.content);
    leftChunkMap.set(key, (leftChunkMap.get(key) ?? 0) + 1);
  }

  const rightChunkMap = new Map<string, number>();
  for (const chunk of rightVersion.snapshot_payload.chunks ?? []) {
    const key = normalizeChunkContent(chunk.content);
    rightChunkMap.set(key, (rightChunkMap.get(key) ?? 0) + 1);
  }

  const allKeys = new Set([...leftChunkMap.keys(), ...rightChunkMap.keys()]);
  const addedSamples: string[] = [];
  const removedSamples: string[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  for (const key of allKeys) {
    const leftCount = leftChunkMap.get(key) ?? 0;
    const rightCount = rightChunkMap.get(key) ?? 0;
    const shared = Math.min(leftCount, rightCount);
    unchangedCount += shared;

    if (leftCount > rightCount) {
      const delta = leftCount - rightCount;
      removedCount += delta;
      if (removedSamples.length < 5) {
        removedSamples.push(buildChunkSample(key));
      }
    }

    if (rightCount > leftCount) {
      const delta = rightCount - leftCount;
      addedCount += delta;
      if (addedSamples.length < 5) {
        addedSamples.push(buildChunkSample(key));
      }
    }
  }

  return {
    leftVersion: {
      id: leftVersion.id,
      version_number: leftVersion.version_number,
      snapshot_reason: leftVersion.snapshot_reason,
      created_at: leftVersion.created_at,
    },
    rightVersion: {
      id: rightVersion.id,
      version_number: rightVersion.version_number,
      snapshot_reason: rightVersion.snapshot_reason,
      created_at: rightVersion.created_at,
    },
    fieldChanges,
    stats: {
      leftChunkCount: leftVersion.chunk_count,
      rightChunkCount: rightVersion.chunk_count,
      chunkCountDelta: leftVersion.chunk_count - rightVersion.chunk_count,
      leftChunkCharCount: leftVersion.chunk_char_count,
      rightChunkCharCount: rightVersion.chunk_char_count,
      chunkCharCountDelta: leftVersion.chunk_char_count - rightVersion.chunk_char_count,
    },
    chunkChanges: {
      addedCount,
      removedCount,
      unchangedCount,
      addedSamples,
      removedSamples,
    },
  };
}

async function getNextVersionNumber(documentId: string): Promise<number> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("rag_document_versions")
    .select("version_number")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.version_number ?? 0) + 1;
}

export async function createDocumentSnapshot(params: {
  documentId: string;
  snapshotReason: string;
  createdBy?: string | null;
}): Promise<RagDocumentVersionRecord | null> {
  const supabase = createServiceSupabaseClient();

  const [{ data: document, error: documentError }, { data: chunks, error: chunksError }] = await Promise.all([
    supabase
      .from("rag_documents")
      .select("id, title, category, source_url, doc_metadata")
      .eq("id", params.documentId)
      .single<RagDocumentRow>(),
    supabase
      .from("rag_chunks")
      .select("content, token_count")
      .eq("document_id", params.documentId)
      .order("created_at", { ascending: true }),
  ]);

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (chunksError) {
    throw new Error(chunksError.message);
  }
  if (!document) {
    return null;
  }

  const normalizedChunks = ((chunks ?? []) as RagChunkRow[]).map((chunk) => ({
    content: chunk.content,
    token_count: Number(chunk.token_count ?? Math.ceil(chunk.content.length / 4)),
  }));
  const versionNumber = await getNextVersionNumber(params.documentId);
  const chunkCharCount = normalizedChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

  const { data, error } = await supabase
    .from("rag_document_versions")
    .insert({
      document_id: params.documentId,
      version_number: versionNumber,
      snapshot_reason: params.snapshotReason,
      title: document.title,
      category: document.category,
      source_url: document.source_url,
      doc_metadata: document.doc_metadata,
      chunk_count: normalizedChunks.length,
      chunk_char_count: chunkCharCount,
      snapshot_payload: {
        document,
        chunks: normalizedChunks,
      },
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single<RagDocumentVersionRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create document snapshot");
  }

  return data;
}

export async function listDocumentVersions(documentId: string, limit = 10): Promise<RagDocumentVersionRecord[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("rag_document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RagDocumentVersionRecord[];
}

export async function getDocumentVersionDiff(params: {
  documentId: string;
  leftVersionId: string;
  rightVersionId: string;
}): Promise<RagDocumentVersionDiffRecord> {
  const versions = await listDocumentVersions(params.documentId, 50);
  const leftVersion = versions.find((version) => version.id === params.leftVersionId);
  const rightVersion = versions.find((version) => version.id === params.rightVersionId);

  if (!leftVersion || !rightVersion) {
    throw new Error("Versiones no encontradas para calcular diff");
  }

  return buildDocumentVersionDiff(leftVersion, rightVersion);
}

export async function rollbackDocumentVersion(params: {
  documentId: string;
  versionId: string;
  requestedBy?: string | null;
}): Promise<{ restoredVersion: RagDocumentVersionRecord; insertedChunks: number }> {
  const supabase = createServiceSupabaseClient();
  const { data: versionData, error: versionError } = await supabase
    .from("rag_document_versions")
    .select("*")
    .eq("id", params.versionId)
    .eq("document_id", params.documentId)
    .single<RagDocumentVersionRecord>();

  if (versionError || !versionData) {
    throw new Error(versionError?.message ?? "Version not found");
  }

  await createDocumentSnapshot({
    documentId: params.documentId,
    snapshotReason: `pre_rollback_to_v${versionData.version_number}`,
    createdBy: params.requestedBy ?? null,
  });

  const snapshotDocument = versionData.snapshot_payload.document;
  const snapshotChunks = versionData.snapshot_payload.chunks ?? [];

  const { error: updateError } = await supabase
    .from("rag_documents")
    .update({
      title: snapshotDocument.title,
      category: snapshotDocument.category,
      source_url: snapshotDocument.source_url,
      doc_metadata: snapshotDocument.doc_metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.documentId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: deleteChunksError } = await supabase.from("rag_chunks").delete().eq("document_id", params.documentId);
  if (deleteChunksError) {
    throw new Error(deleteChunksError.message);
  }

  const restoredChunkRows = [];
  for (const chunk of snapshotChunks) {
    const embedding = await generateEmbedding(chunk.content);
    restoredChunkRows.push({
      document_id: params.documentId,
      content: chunk.content,
      token_count: chunk.token_count,
      embedding,
    });
  }

  if (restoredChunkRows.length > 0) {
    const { error: insertChunksError } = await supabase.from("rag_chunks").insert(restoredChunkRows);
    if (insertChunksError) {
      throw new Error(insertChunksError.message);
    }
  }

  return {
    restoredVersion: versionData,
    insertedChunks: restoredChunkRows.length,
  };
}
