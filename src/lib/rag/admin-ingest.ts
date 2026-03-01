import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";
import { chunkStructuredText, normalizeText } from "@/lib/rag/chunking";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { createDocumentSnapshot } from "@/lib/rag/admin-document-versions";
import type { IngestSourcePayload, NotebookDomain } from "@/lib/rag/governance";

export interface AdminIngestRequest {
  notebook_id: string;
  notebook_title: string;
  domain: NotebookDomain;
  sources: IngestSourcePayload[];
  replace_existing?: boolean;
  requested_by?: string | null;
}

export interface AdminIngestResult {
  documentsProcessed: number;
  chunksInserted: number;
  replacedDocuments: number;
}

function inferTopic(title: string, domain: string): string | null {
  const haystack = `${title} ${domain}`.toLowerCase();
  if (haystack.includes("cuota cero")) return "cuota_cero";
  if (haystack.includes("iva") || haystack.includes("modelo 303")) return "iva";
  if (haystack.includes("irpf") || haystack.includes("modelo 130")) return "irpf";
  if (haystack.includes("reta")) return "reta";
  if (haystack.includes("pluriactividad")) return "pluriactividad";
  if (haystack.includes("despido")) return "despido";
  if (haystack.includes("fianza") || haystack.includes("alquiler") || haystack.includes("arrend")) return "arrendamiento";
  if (haystack.includes("marca") || haystack.includes("posicionamiento")) return "posicionamiento";
  return null;
}

function inferJurisdiction(title: string, url: string | null, domain: string): string {
  const haystack = `${title} ${url ?? ""}`.toLowerCase();
  if (haystack.includes("baleares") || haystack.includes("balears") || haystack.includes("mallorca") || haystack.includes("caib.es")) {
    return "es-bal";
  }
  if (["fiscal", "laboral", "mercado"].includes(domain)) {
    return "es";
  }
  return "unknown";
}

function inferSourceType(url: string | null, sourceType: string | null | undefined): string {
  if (sourceType && sourceType.trim().length > 0) {
    return sourceType;
  }
  return url && url.trim().length > 0 ? "web_page" : "generated_text";
}

export async function ingestAdminSources(payload: AdminIngestRequest): Promise<AdminIngestResult> {
  const supabase = createServiceSupabaseClient();
  let documentsProcessed = 0;
  let chunksInserted = 0;
  let replacedDocuments = 0;

  for (const source of payload.sources) {
    const sourceUrl = source.url ?? "";
    const normalizedContent = normalizeText(source.content);
    const chunks = chunkStructuredText(normalizedContent);

    const { data: existingDocument, error: findError } = await supabase
      .from("rag_documents")
      .select("id")
      .eq("title", source.title)
      .eq("source_url", sourceUrl)
      .maybeSingle<{ id: string }>();

    if (findError) {
      throw new Error(`Unable to lookup existing document "${source.title}": ${findError.message}`);
    }

    const docMetadata = {
      notebook_id: payload.notebook_id,
      notebook_title: payload.notebook_title,
      source_type: inferSourceType(source.url, source.source_type),
      jurisdiction: inferJurisdiction(source.title, source.url, payload.domain),
      topic: inferTopic(source.title, payload.domain),
      reason_for_fit: source.reason_for_fit,
      chunking_strategy: "structured_v1",
    };

    let documentId = existingDocument?.id ?? null;

    if (!documentId) {
      const { data: inserted, error: insertError } = await supabase
        .from("rag_documents")
        .insert({
          title: source.title,
          category: payload.domain,
          source_url: sourceUrl,
          doc_metadata: docMetadata,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !inserted) {
        throw new Error(`Unable to insert document "${source.title}": ${insertError?.message ?? "unknown_error"}`);
      }

      documentId = inserted.id;
    } else {
      const { error: updateError } = await supabase
        .from("rag_documents")
        .update({
          category: payload.domain,
          doc_metadata: docMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (updateError) {
        throw new Error(`Unable to update document "${source.title}": ${updateError.message}`);
      }
    }

    if (payload.replace_existing !== false) {
      if (documentId) {
        await createDocumentSnapshot({
          documentId,
          snapshotReason: "pre_ingest_replace",
          createdBy: payload.requested_by ?? null,
        });
      }
      const { error: deleteError } = await supabase
        .from("rag_chunks")
        .delete()
        .eq("document_id", documentId);

      if (deleteError) {
        throw new Error(`Unable to replace chunks for "${source.title}": ${deleteError.message}`);
      }

      if (existingDocument) {
        replacedDocuments += 1;
      }
    }

    const chunkRows = [];
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      chunkRows.push({
        document_id: documentId,
        content: chunk,
        embedding,
        token_count: Math.ceil(chunk.length / 4),
      });
    }

    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabase
        .from("rag_chunks")
        .insert(chunkRows);

      if (chunkError) {
        throw new Error(`Unable to insert chunks for "${source.title}": ${chunkError.message}`);
      }
    }

    documentsProcessed += 1;
    chunksInserted += chunkRows.length;
  }

  return {
    documentsProcessed,
    chunksInserted,
    replacedDocuments,
  };
}
