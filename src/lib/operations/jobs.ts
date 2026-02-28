import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

export const APP_JOB_STATUS_VALUES = ["pending", "running", "completed", "failed"] as const;
export type AppJobStatus = (typeof APP_JOB_STATUS_VALUES)[number];

export const APP_JOB_KIND_VALUES = ["invoice_email_delivery", "fiscal_template_generation"] as const;
export type AppJobKind = (typeof APP_JOB_KIND_VALUES)[number];

export interface AppJobRecord {
  id: string;
  user_id: string;
  job_kind: AppJobKind;
  status: AppJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  run_after: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailOutboxRecord {
  id: string;
  user_id: string;
  app_job_id: string;
  invoice_id: string | null;
  recipient_email: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

type CreateAppJobInput = {
  userId: string;
  jobKind: AppJobKind;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  runAfter?: string;
};

export async function createAppJob(input: CreateAppJobInput): Promise<AppJobRecord> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("app_jobs")
    .insert({
      user_id: input.userId,
      job_kind: input.jobKind,
      payload: input.payload,
      max_attempts: input.maxAttempts ?? 3,
      run_after: input.runAfter ?? new Date().toISOString(),
    })
    .select("*")
    .single<AppJobRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create app job");
  }

  return data;
}

export async function createEmailOutboxEntry(input: {
  userId: string;
  appJobId: string;
  invoiceId: string;
  recipientEmail: string;
  subject: string;
}): Promise<EmailOutboxRecord> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("email_outbox")
    .insert({
      user_id: input.userId,
      app_job_id: input.appJobId,
      invoice_id: input.invoiceId,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      status: "queued",
    })
    .select("*")
    .single<EmailOutboxRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create email outbox entry");
  }

  return data;
}

export async function listRecentAppJobsForUser(userId: string, limit = 8): Promise<AppJobRecord[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("app_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AppJobRecord[];
}

export async function listRecentEmailOutboxForUser(userId: string, limit = 8): Promise<EmailOutboxRecord[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("email_outbox")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailOutboxRecord[];
}

export async function listUserIdsWithPendingJobs(limit = 100): Promise<string[]> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_jobs")
    .select("user_id")
    .eq("status", "pending")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((item) => (typeof item.user_id === "string" ? item.user_id : ""))
        .filter(Boolean)
    )
  );
}

export async function claimPendingJobs(params: {
  userId: string;
  limit: number;
}): Promise<AppJobRecord[]> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_jobs")
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(params.limit);

  if (error) {
    throw new Error(error.message);
  }

  const jobs = (data ?? []) as AppJobRecord[];
  const claimed: AppJobRecord[] = [];

  for (const job of jobs) {
    const { data: updated, error: updateError } = await supabase
      .from("app_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("*")
      .single<AppJobRecord>();

    if (!updateError && updated) {
      claimed.push(updated);
    }
  }

  return claimed;
}

export async function completeAppJob(jobId: string, result: Record<string, unknown>): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("app_jobs")
    .update({
      status: "completed",
      result,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAppJobPayload(jobId: string, payload: Record<string, unknown>): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("app_jobs")
    .update({
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function failAppJob(params: {
  job: AppJobRecord;
  message: string;
  retryable?: boolean;
}): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const attempts = params.job.attempts + 1;
  const canRetry = Boolean(params.retryable) && attempts < params.job.max_attempts;
  const nextRun = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("app_jobs")
    .update({
      status: canRetry ? "pending" : "failed",
      attempts,
      run_after: canRetry ? nextRun : params.job.run_after,
      finished_at: canRetry ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: params.message,
    })
    .eq("id", params.job.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markEmailOutboxSent(params: {
  outboxId: string;
  providerMessageId: string;
}): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("email_outbox")
    .update({
      status: "sent",
      provider_message_id: params.providerMessageId,
      last_error: null,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.outboxId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markEmailOutboxFailed(params: {
  outboxId: string;
  message: string;
  keepQueued?: boolean;
}): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("email_outbox")
    .update({
      status: params.keepQueued ? "queued" : "failed",
      last_error: params.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.outboxId);

  if (error) {
    throw new Error(error.message);
  }
}
