import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";
import type { AdminIngestRequest, AdminIngestResult } from "@/lib/rag/admin-ingest";

export type AdminJobStatus = "pending" | "running" | "completed" | "failed" | "validated";

export interface AdminJobRecord {
  id: string;
  requested_by: string;
  notebook_id: string;
  notebook_title: string;
  domain: string;
  project_ref: string;
  status: AdminJobStatus;
  source_count: number;
  documents_processed: number;
  chunks_inserted: number;
  replaced_documents: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  job_payload: Record<string, unknown>;
}

export async function createAdminIngestJob(input: {
  requestedBy: string;
  projectRef: string;
  payload: AdminIngestRequest;
  status: AdminJobStatus;
}): Promise<AdminJobRecord> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("rag_ingest_jobs")
    .insert({
      requested_by: input.requestedBy,
      notebook_id: input.payload.notebook_id,
      notebook_title: input.payload.notebook_title,
      domain: input.payload.domain,
      project_ref: input.projectRef,
      status: input.status,
      source_count: input.payload.sources.length,
      job_payload: {
        replace_existing: input.payload.replace_existing !== false,
        source_titles: input.payload.sources.map((source) => source.title),
      },
    })
    .select("*")
    .single<AdminJobRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create admin ingest job");
  }

  return data;
}

export async function updateAdminIngestJob(
  jobId: string,
  patch: Partial<{
    status: AdminJobStatus;
    documents_processed: number;
    chunks_inserted: number;
    replaced_documents: number;
    error_message: string | null;
  }>
): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("rag_ingest_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function completeAdminIngestJob(jobId: string, result: AdminIngestResult): Promise<void> {
  await updateAdminIngestJob(jobId, {
    status: "completed",
    documents_processed: result.documentsProcessed,
    chunks_inserted: result.chunksInserted,
    replaced_documents: result.replacedDocuments,
    error_message: null,
  });
}

export async function failAdminIngestJob(jobId: string, message: string): Promise<void> {
  await updateAdminIngestJob(jobId, {
    status: "failed",
    error_message: message,
  });
}

export async function listRecentAdminIngestJobs(limit = 8): Promise<AdminJobRecord[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("rag_ingest_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminJobRecord[];
}
