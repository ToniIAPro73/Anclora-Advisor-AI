import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { buildInvoiceReference, INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { createAppJob, createEmailOutboxEntry, updateAppJobPayload } from "@/lib/operations/jobs";
import { isSmtpConfigured } from "@/lib/notifications/smtp";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

const sendInvoiceSchema = z.object({
  recipientEmail: z.string().email().max(255).transform((value) => value.trim().toLowerCase()),
});

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, userId: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, userId: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, userId: user.id, error: null };
}

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_invoice_send_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = sendInvoiceSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_invoice_send_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: currentData, error: currentError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (currentError || !currentData) {
    log("error", "api_invoice_send_load_failed", requestId, { invoiceId, error: currentError?.message ?? "not_found" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!isSmtpConfigured()) {
    const response = NextResponse.json(
      { success: false, error: "SMTP_NOT_CONFIGURED" },
      { status: 503 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const currentInvoice = currentData as unknown as InvoiceRecord;
  const subject = `Factura ${buildInvoiceReference(currentInvoice.series, currentInvoice.invoice_number)} - ${currentInvoice.client_name}`;

  try {
    const job = await createAppJob({
      userId: auth.userId,
      jobKind: "invoice_email_delivery",
      payload: {
        invoiceId,
        recipientEmail: payload.data.recipientEmail,
      },
      maxAttempts: 3,
    });

    const outbox = await createEmailOutboxEntry({
      userId: auth.userId,
      appJobId: job.id,
      invoiceId,
      recipientEmail: payload.data.recipientEmail,
      subject,
    });

    await updateAppJobPayload(job.id, {
      invoiceId,
      recipientEmail: payload.data.recipientEmail,
      outboxId: outbox.id,
    });

    const response = NextResponse.json({
      success: true,
      invoice: currentInvoice,
      delivery: {
        jobId: job.id,
        outboxId: outbox.id,
        status: "queued",
        mode: "queue",
      },
    });
    response.headers.set("x-request-id", requestId);
    log("info", "api_invoice_send_enqueued", requestId, {
      invoiceId,
      recipientEmail: payload.data.recipientEmail,
      jobId: job.id,
      outboxId: outbox.id,
    });
    try {
      await createAuditLog(supabase, {
        userId: auth.userId,
        domain: "invoices",
        entityType: "invoice_delivery",
        entityId: invoiceId,
        action: "enqueued",
        summary: `Envio de factura encolado para ${payload.data.recipientEmail}`,
        metadata: {
          jobId: job.id,
          outboxId: outbox.id,
        },
      });
    } catch (auditError) {
      log("warn", "api_invoice_send_audit_failed", requestId, {
        invoiceId,
        error: auditError instanceof Error ? auditError.message : "unknown",
      });
    }
    return response;
  } catch (queueError) {
    log("error", "api_invoice_send_enqueue_failed", requestId, {
      invoiceId,
      error: queueError instanceof Error ? queueError.message : "unknown",
    });
    const response = NextResponse.json(
      { success: false, error: "QUEUE_ENQUEUE_FAILED" },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
