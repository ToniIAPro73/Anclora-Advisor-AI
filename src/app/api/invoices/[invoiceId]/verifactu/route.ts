import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { isVerifactuConfigured } from "@/lib/invoices/verifactu";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { createAppJob } from "@/lib/operations/jobs";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

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

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.invalid_session") }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!isVerifactuConfigured()) {
    const response = NextResponse.json({ success: false, error: "VERIFACTU_NOT_CONFIGURED" }, { status: 503 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (error || !data) {
    log("error", "api_invoice_verifactu_load_failed", requestId, { invoiceId, error: error?.message ?? "not_found" });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.db_error") }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const invoice = data as unknown as InvoiceRecord;

  try {
    const job = await createAppJob({
      userId: auth.userId,
      jobKind: "invoice_verifactu_submission",
      payload: {
        invoiceId,
      },
      maxAttempts: 3,
    });

    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({
        verifactu_status: "queued",
        verifactu_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select(INVOICE_SELECT_FIELDS)
      .single();

    if (updateError || !updatedInvoice) {
      throw new Error(updateError?.message ?? "VERIFACTU_QUEUE_UPDATE_FAILED");
    }

    try {
      await createAuditLog(supabase, {
        userId: auth.userId,
        domain: "invoices",
        entityType: "invoice_verifactu",
        entityId: invoiceId,
        action: "enqueued",
        summary: `Envio Verifactu encolado para ${invoice.client_name}`,
        metadata: { jobId: job.id },
      });
    } catch {
      // Queueing should not fail because of audit logging.
    }

    const response = NextResponse.json({
      success: true,
      invoice: updatedInvoice as unknown as InvoiceRecord,
      submission: {
        jobId: job.id,
        status: "queued",
        mode: "queue",
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (queueError) {
    log("error", "api_invoice_verifactu_enqueue_failed", requestId, {
      invoiceId,
      error: queueError instanceof Error ? queueError.message : "unknown",
    });
    const response = NextResponse.json({ success: false, error: "VERIFACTU_QUEUE_FAILED" }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
