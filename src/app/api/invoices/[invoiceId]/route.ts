import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { updateInvoiceSchema } from "@/lib/invoices/contracts";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";
import { calculateInvoiceTotals } from "@/lib/tools/invoice-calculator";

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_invoice_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateInvoiceSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_invoice_patch_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const patch = payload.data;
  const updatePayload: Record<string, string | number> = {};

  if (patch.clientName !== undefined) updatePayload.client_name = patch.clientName;
  if (patch.clientNif !== undefined) updatePayload.client_nif = patch.clientNif;
  if (patch.issueDate !== undefined) updatePayload.issue_date = patch.issueDate;
  if (patch.status !== undefined) updatePayload.status = patch.status;

  const needsRecalculation =
    patch.amountBase !== undefined || patch.ivaRate !== undefined || patch.irpfRetention !== undefined;

  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  if (needsRecalculation) {
    const { data: currentInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("amount_base, iva_rate, irpf_retention")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !currentInvoice) {
      log("error", "api_invoice_patch_load_failed", requestId, { invoiceId, error: fetchError?.message ?? "not_found" });
      const response = NextResponse.json(
        { success: false, error: t(locale, "api.invoices.db_error") },
        { status: 500 }
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const calculation = calculateInvoiceTotals({
      amountBase: patch.amountBase ?? Number(currentInvoice.amount_base),
      ivaRate: patch.ivaRate ?? Number(currentInvoice.iva_rate),
      irpfRetention: patch.irpfRetention ?? Number(currentInvoice.irpf_retention),
    });

    updatePayload.amount_base = calculation.amountBase;
    updatePayload.iva_rate = calculation.ivaRate;
    updatePayload.irpf_retention = calculation.irpfRetention;
    updatePayload.total_amount = calculation.totalAmount;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updatePayload)
    .eq("id", invoiceId)
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .single();

  if (error) {
    log("error", "api_invoice_patch_failed", requestId, { invoiceId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, invoice: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoice_patch_succeeded", requestId, { invoiceId, status: data?.status ?? null });
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_invoice_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    log("error", "api_invoice_delete_failed", requestId, { invoiceId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.invoices.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoice_delete_succeeded", requestId, { invoiceId });
  return response;
}
