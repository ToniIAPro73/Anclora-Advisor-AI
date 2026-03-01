import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { getNextInvoiceNumber, INVOICE_SELECT_FIELDS, normalizeInvoiceSeries } from "@/lib/invoices/service";
import { resolveLocale, t } from "@/lib/i18n/messages";
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
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = payload.reason?.trim() || "Rectificacion operativa";
  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  const { data: currentInvoiceData, error: loadError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  const currentInvoice = currentInvoiceData as unknown as InvoiceRecord | null;

  if (loadError || !currentInvoice) {
    log("error", "api_invoice_rectify_load_failed", requestId, { invoiceId, error: loadError?.message ?? "not_found" });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.db_error") }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const nextSeries = normalizeInvoiceSeries(`${currentInvoice.series ?? currentInvoice.issue_date.slice(0, 4)}R`, currentInvoice.issue_date);
  const nextInvoiceNumber = await getNextInvoiceNumber(supabase, auth.userId, nextSeries);
  const { data: rectifiedInvoiceData, error } = await supabase
    .from("invoices")
    .insert({
      user_id: auth.userId,
      client_name: currentInvoice.client_name,
      client_nif: currentInvoice.client_nif,
      amount_base: -Math.abs(Number(currentInvoice.amount_base)),
      iva_rate: Number(currentInvoice.iva_rate),
      irpf_retention: Number(currentInvoice.irpf_retention),
      total_amount: -Math.abs(Number(currentInvoice.total_amount)),
      issue_date: new Date().toISOString().slice(0, 10),
      status: "draft",
      series: nextSeries,
      invoice_number: nextInvoiceNumber,
      recipient_email: currentInvoice.recipient_email,
      invoice_type: "rectificative",
      rectifies_invoice_id: invoiceId,
      rectification_reason: reason,
      payment_method: null,
      payment_reference: null,
      payment_notes: null,
      paid_at: null,
    })
    .select(INVOICE_SELECT_FIELDS)
    .single();

  const data = rectifiedInvoiceData as unknown as InvoiceRecord | null;

  if (error || !data) {
    log("error", "api_invoice_rectify_failed", requestId, { invoiceId, error: error?.message ?? "unknown" });
    const response = NextResponse.json({ success: false, error: t(locale, "api.invoices.db_error") }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "invoices",
      entityType: "invoice",
      entityId: data.id,
      action: "created",
      summary: `Factura rectificativa creada para ${currentInvoice.client_name}`,
      metadata: {
        sourceInvoiceId: invoiceId,
        reason,
      },
    });
  } catch (auditError) {
    log("warn", "api_invoice_rectify_audit_failed", requestId, {
      invoiceId: data.id,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }

  const response = NextResponse.json({ success: true, invoice: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
