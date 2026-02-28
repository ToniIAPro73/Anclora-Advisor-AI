import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { deliverInvoiceByEmail } from "@/lib/invoices/delivery";
import { INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { createSmtpEmailSender, isSmtpConfigured } from "@/lib/notifications/smtp";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

const sendInvoiceSchema = z.object({
  recipientEmail: z.string().email().max(255).transform((value) => value.trim().toLowerCase()),
});

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, error: null };
}

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
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

  let delivery;
  try {
    delivery = await deliverInvoiceByEmail({
      invoice: currentInvoice,
      recipientEmail: payload.data.recipientEmail,
      emailSender: createSmtpEmailSender(),
    });
  } catch (deliveryError) {
    log("error", "api_invoice_send_delivery_failed", requestId, {
      invoiceId,
      error: deliveryError instanceof Error ? deliveryError.message : "unknown",
    });
    const response = NextResponse.json(
      { success: false, error: "SMTP_DELIVERY_FAILED" },
      { status: 502 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({
      recipient_email: payload.data.recipientEmail,
      sent_at: new Date().toISOString(),
      status: currentInvoice.status === "draft" ? "issued" : currentInvoice.status,
    })
    .eq("id", invoiceId)
    .select(INVOICE_SELECT_FIELDS)
    .single();

  if (error || !data) {
    log("error", "api_invoice_send_failed", requestId, { invoiceId, error: error?.message ?? "not_found" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const invoiceRecord = data as unknown as InvoiceRecord;
  const response = NextResponse.json({
    success: true,
    invoice: invoiceRecord,
    delivery: {
      messageId: delivery.messageId,
      attachmentFilename: delivery.attachmentFilename,
      mode: "smtp",
    },
  });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoice_send_succeeded", requestId, { invoiceId, recipientEmail: payload.data.recipientEmail });
  return response;
}
