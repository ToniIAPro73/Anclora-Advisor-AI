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
