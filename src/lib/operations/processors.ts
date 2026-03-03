import {
  buildNextReminderOccurrence,
  buildReminderRunAfter,
  type GeneralAlertReminderRecord,
} from "@/lib/alerts/general-alert-reminders";
import { generateFiscalAlertsFromTemplates } from "@/lib/fiscal/generation";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { deliverInvoiceByEmail } from "@/lib/invoices/delivery";
import { buildInvoiceReference, INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { isVerifactuConfigured, submitInvoiceToVerifactu } from "@/lib/invoices/verifactu";
import { createSmtpEmailSender, isSmtpConfigured } from "@/lib/notifications/smtp";
import {
  claimPendingJobs,
  createAppJob,
  completeAppJob,
  failAppJob,
  listUserIdsWithPendingJobs,
  markEmailOutboxFailed,
  markEmailOutboxSent,
  type AppJobRecord,
} from "@/lib/operations/jobs";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

function getString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid job payload: ${key}`);
  }
  return value;
}

async function processFiscalTemplateGeneration(job: AppJobRecord): Promise<void> {
  const templateIds = Array.isArray(job.payload.templateIds)
    ? job.payload.templateIds.filter((value): value is string => typeof value === "string")
    : undefined;
  const horizonMonths = typeof job.payload.horizonMonths === "number" ? job.payload.horizonMonths : 6;

  const result = await generateFiscalAlertsFromTemplates({
    userId: job.user_id,
    templateIds,
    horizonMonths,
  });

  await completeAppJob(job.id, result);
}

async function processInvoiceEmailDelivery(job: AppJobRecord): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const invoiceId = getString(job.payload, "invoiceId");
  const recipientEmail = getString(job.payload, "recipientEmail");
  const outboxId = getString(job.payload, "outboxId");

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .eq("user_id", job.user_id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "INVOICE_NOT_FOUND");
  }

  const invoice = data as unknown as InvoiceRecord;
  const delivery = await deliverInvoiceByEmail({
    invoice,
    recipientEmail,
    emailSender: createSmtpEmailSender(),
  });

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({
      recipient_email: recipientEmail,
      sent_at: new Date().toISOString(),
      status: invoice.status === "draft" ? "issued" : invoice.status,
    })
    .eq("id", invoice.id)
    .eq("user_id", job.user_id);

  if (invoiceUpdateError) {
    throw new Error(invoiceUpdateError.message);
  }

  await markEmailOutboxSent({
    outboxId,
    providerMessageId: delivery.messageId,
  });

  await completeAppJob(job.id, {
    invoiceId: invoice.id,
    recipientEmail,
    providerMessageId: delivery.messageId,
    attachmentFilename: delivery.attachmentFilename,
    reference: buildInvoiceReference(invoice.series, invoice.invoice_number),
  });
}

async function processGeneralAlertReminderGeneration(job: AppJobRecord): Promise<void> {
  const reminderId = getString(job.payload, "reminderId");
  const occurrenceDate = getString(job.payload, "occurrenceDate");

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("general_alert_reminders")
    .select("id, user_id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active, last_generated_for, created_at, updated_at")
    .eq("id", reminderId)
    .eq("user_id", job.user_id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "GENERAL_ALERT_REMINDER_NOT_FOUND");
  }

  const reminder = data as GeneralAlertReminderRecord;
  if (!reminder.is_active) {
    await completeAppJob(job.id, {
      reminderId,
      skipped: true,
      reason: "inactive",
    });
    return;
  }

  const sourceKey = `reminder:${reminder.id}:${occurrenceDate}`;
  const { error: alertError } = await supabase.from("general_alerts").upsert(
    {
      user_id: job.user_id,
      source_key: sourceKey,
      source: "reminder",
      source_entity_type: "general_alert_reminder",
      source_entity_id: reminder.id,
      category: reminder.category,
      title: reminder.title,
      message: reminder.message,
      priority: reminder.priority,
      status: "pending",
      due_date: occurrenceDate,
      link_href: reminder.link_href,
      metadata: {
        reminderId: reminder.id,
        recurrence: reminder.recurrence,
        generatedFor: occurrenceDate,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,source_key" }
  );

  if (alertError) {
    throw new Error(alertError.message);
  }

  const { error: reminderUpdateError } = await supabase
    .from("general_alert_reminders")
    .update({
      last_generated_for: occurrenceDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminder.id)
    .eq("user_id", job.user_id);

  if (reminderUpdateError) {
    throw new Error(reminderUpdateError.message);
  }

  const nextOccurrenceDate = buildNextReminderOccurrence(
    occurrenceDate,
    reminder.recurrence as "monthly" | "quarterly" | "yearly"
  );
  await createAppJob({
    userId: job.user_id,
    jobKind: "general_alert_reminder_generation",
    payload: {
      reminderId: reminder.id,
      occurrenceDate: nextOccurrenceDate,
    },
    runAfter: buildReminderRunAfter(nextOccurrenceDate, reminder.lead_days),
    maxAttempts: 3,
  });

  await completeAppJob(job.id, {
    reminderId: reminder.id,
    generatedFor: occurrenceDate,
    nextOccurrenceDate,
  });
}

async function processInvoiceVerifactuSubmission(job: AppJobRecord): Promise<void> {
  if (!isVerifactuConfigured()) {
    throw new Error("VERIFACTU_NOT_CONFIGURED");
  }

  const invoiceId = getString(job.payload, "invoiceId");
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .eq("user_id", job.user_id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "INVOICE_NOT_FOUND");
  }

  const invoice = data as unknown as InvoiceRecord;
  const submission = await submitInvoiceToVerifactu({
    invoice,
    userId: job.user_id,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      verifactu_status: "submitted",
      verifactu_submitted_at: submission.submittedAt,
      verifactu_submission_id: submission.submissionId,
      verifactu_last_error: null,
      status: invoice.status === "draft" ? "issued" : invoice.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .eq("user_id", job.user_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await completeAppJob(job.id, {
    invoiceId: invoice.id,
    submissionId: submission.submissionId,
    submittedAt: submission.submittedAt,
    reference: buildInvoiceReference(invoice.series, invoice.invoice_number),
  });
}

export async function processPendingAppJobs(params: {
  userId: string;
  limit?: number;
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
}> {
  const claimedJobs = await claimPendingJobs({
    userId: params.userId,
    limit: params.limit ?? 10,
  });

  let completed = 0;
  let failed = 0;

  for (const job of claimedJobs) {
    try {
      if (job.job_kind === "invoice_email_delivery") {
        await processInvoiceEmailDelivery(job);
        completed += 1;
        continue;
      }

      if (job.job_kind === "invoice_verifactu_submission") {
        await processInvoiceVerifactuSubmission(job);
        completed += 1;
        continue;
      }

      if (job.job_kind === "fiscal_template_generation") {
        await processFiscalTemplateGeneration(job);
        completed += 1;
        continue;
      }

      if (job.job_kind === "general_alert_reminder_generation") {
        await processGeneralAlertReminderGeneration(job);
        completed += 1;
        continue;
      }

      throw new Error(`Unsupported job kind: ${job.job_kind}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_JOB_ERROR";
      const retryable =
        message !== "SMTP_NOT_CONFIGURED" &&
        message !== "VERIFACTU_NOT_CONFIGURED" &&
        message !== "INVOICE_NOT_FOUND" &&
        message !== "GENERAL_ALERT_REMINDER_NOT_FOUND";

      if (job.job_kind === "invoice_email_delivery") {
        const outboxId = typeof job.payload.outboxId === "string" ? job.payload.outboxId : null;
        if (outboxId) {
          await markEmailOutboxFailed({
            outboxId,
            message,
            keepQueued: retryable,
          });
        }
      }

      if (job.job_kind === "invoice_verifactu_submission") {
        const invoiceId = typeof job.payload.invoiceId === "string" ? job.payload.invoiceId : null;
        if (invoiceId) {
          const supabase = createServiceSupabaseClient();
          await supabase
            .from("invoices")
            .update({
              verifactu_status: "failed",
              verifactu_last_error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceId)
            .eq("user_id", job.user_id);
        }
      }

      await failAppJob({
        job,
        message,
        retryable,
      });
      failed += 1;
    }
  }

  return {
    claimed: claimedJobs.length,
    completed,
    failed,
  };
}

export async function processPendingAppJobsForAllUsers(params?: {
  userLimit?: number;
  jobsPerUserLimit?: number;
}): Promise<{
  userCount: number;
  claimed: number;
  completed: number;
  failed: number;
}> {
  const userIds = await listUserIdsWithPendingJobs(params?.userLimit ?? 100);
  let claimed = 0;
  let completed = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await processPendingAppJobs({
      userId,
      limit: params?.jobsPerUserLimit ?? 25,
    });
    claimed += result.claimed;
    completed += result.completed;
    failed += result.failed;
  }

  return {
    userCount: userIds.length,
    claimed,
    completed,
    failed,
  };
}
