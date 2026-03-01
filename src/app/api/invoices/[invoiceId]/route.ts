import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import { updateInvoiceSchema, type InvoiceRecord } from "@/lib/invoices/contracts";
import { getNextInvoiceNumber, INVOICE_SELECT_FIELDS, normalizeInvoiceSeries } from "@/lib/invoices/service";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";
import { calculateInvoiceTotals } from "@/lib/tools/invoice-calculator";

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

type CurrentInvoiceRow = {
  amount_base: number;
  iva_rate: number;
  irpf_retention: number;
  issue_date: string;
  series: string | null;
};

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
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
  const updatePayload: Record<string, string | number | null> = {};

  if (patch.clientName !== undefined) updatePayload.client_name = patch.clientName;
  if (patch.clientNif !== undefined) updatePayload.client_nif = patch.clientNif;
  if (patch.issueDate !== undefined) updatePayload.issue_date = patch.issueDate;
  if (patch.recipientEmail !== undefined) updatePayload.recipient_email = patch.recipientEmail;
  if (patch.status !== undefined) updatePayload.status = patch.status;
  if (patch.paymentMethod !== undefined) updatePayload.payment_method = patch.paymentMethod;
  if (patch.paymentReference !== undefined) updatePayload.payment_reference = patch.paymentReference;
  if (patch.paymentNotes !== undefined) updatePayload.payment_notes = patch.paymentNotes;
  if (patch.paidAt !== undefined) updatePayload.paid_at = patch.paidAt;
  if (patch.invoiceType !== undefined) updatePayload.invoice_type = patch.invoiceType;
  if (patch.rectifiesInvoiceId !== undefined) updatePayload.rectifies_invoice_id = patch.rectifiesInvoiceId;
  if (patch.rectificationReason !== undefined) updatePayload.rectification_reason = patch.rectificationReason;

  const needsRecalculation =
    patch.amountBase !== undefined || patch.ivaRate !== undefined || patch.irpfRetention !== undefined;

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  let currentInvoice: CurrentInvoiceRow | null = null;

  const needsCurrentInvoice =
    needsRecalculation || patch.issueDate !== undefined || patch.series !== undefined;

  if (needsCurrentInvoice) {
    const { data, error } = await supabase
      .from("invoices")
      .select("amount_base, iva_rate, irpf_retention, issue_date, series")
      .eq("id", invoiceId)
      .single();

    if (error || !data) {
      log("error", "api_invoice_patch_load_failed", requestId, {
        invoiceId,
        error: error?.message ?? "not_found",
      });
      const response = NextResponse.json(
        { success: false, error: t(locale, "api.invoices.db_error") },
        { status: 500 }
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    currentInvoice = data as CurrentInvoiceRow;
  }

  if (needsRecalculation) {
    const calculation = calculateInvoiceTotals({
      amountBase: patch.amountBase ?? Number(currentInvoice?.amount_base ?? 0),
      ivaRate: patch.ivaRate ?? Number(currentInvoice?.iva_rate ?? 0),
      irpfRetention: patch.irpfRetention ?? Number(currentInvoice?.irpf_retention ?? 0),
    });

    updatePayload.amount_base = calculation.amountBase;
    updatePayload.iva_rate = calculation.ivaRate;
    updatePayload.irpf_retention = calculation.irpfRetention;
    updatePayload.total_amount = calculation.totalAmount;
  }

  if (patch.series !== undefined || patch.issueDate !== undefined) {
    const nextIssueDate = patch.issueDate ?? currentInvoice?.issue_date ?? new Date().toISOString().slice(0, 10);
    const nextSeries = normalizeInvoiceSeries(patch.series ?? currentInvoice?.series ?? undefined, nextIssueDate);
    updatePayload.series = nextSeries;

    const currentSeries = currentInvoice?.series ?? normalizeInvoiceSeries(undefined, currentInvoice?.issue_date ?? nextIssueDate);
    if (nextSeries !== currentSeries) {
      try {
        updatePayload.invoice_number = await getNextInvoiceNumber(supabase, auth.userId, nextSeries);
      } catch (sequenceError) {
        log("error", "api_invoice_patch_sequence_failed", requestId, {
          invoiceId,
          error: sequenceError instanceof Error ? sequenceError.message : "unknown",
          series: nextSeries,
        });
        const response = NextResponse.json(
          { success: false, error: t(locale, "api.invoices.db_error") },
          { status: 500 }
        );
        response.headers.set("x-request-id", requestId);
        return response;
      }
    }
  }

  if (patch.status === "paid" && patch.paidAt === undefined) {
    updatePayload.paid_at = new Date().toISOString();
  }

  if (patch.status && patch.status !== "paid" && patch.paidAt === undefined) {
    updatePayload.paid_at = null;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updatePayload)
    .eq("id", invoiceId)
    .select(INVOICE_SELECT_FIELDS)
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

  const invoiceRecord = data as unknown as InvoiceRecord;
  const response = NextResponse.json({ success: true, invoice: invoiceRecord });
  response.headers.set("x-request-id", requestId);
  log("info", "api_invoice_patch_succeeded", requestId, { invoiceId, status: invoiceRecord.status });
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "invoices",
      entityType: "invoice",
      entityId: invoiceId,
      action: "updated",
      summary: `Factura actualizada: ${invoiceRecord.client_name}`,
      metadata: {
        status: invoiceRecord.status,
        patch,
      },
    });
  } catch (auditError) {
    log("warn", "api_invoice_patch_audit_failed", requestId, {
      invoiceId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
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
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "invoices",
      entityType: "invoice",
      entityId: invoiceId,
      action: "deleted",
      summary: "Factura eliminada",
    });
  } catch (auditError) {
    log("warn", "api_invoice_delete_audit_failed", requestId, {
      invoiceId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}
