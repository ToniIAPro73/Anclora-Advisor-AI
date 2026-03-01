import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { getNextInvoiceNumber, INVOICE_SELECT_FIELDS, normalizeInvoiceSeries } from "@/lib/invoices/service";
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
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  try {
    const { data: source, error: sourceError } = await supabase
      .from("invoices")
      .select(INVOICE_SELECT_FIELDS)
      .eq("id", invoiceId)
      .single();

    if (sourceError || !source) {
      throw new Error(sourceError?.message ?? "SOURCE_INVOICE_NOT_FOUND");
    }

    const sourceInvoice = source as unknown as InvoiceRecord;
    const issueDate = new Date().toISOString().slice(0, 10);
    const series = normalizeInvoiceSeries(sourceInvoice.series ?? undefined, issueDate);
    const invoiceNumber = await getNextInvoiceNumber(supabase, auth.userId, series);

    const { data: duplicated, error: insertError } = await supabase
      .from("invoices")
      .insert({
        user_id: auth.userId,
        client_name: sourceInvoice.client_name,
        client_nif: sourceInvoice.client_nif,
        amount_base: sourceInvoice.amount_base,
        iva_rate: sourceInvoice.iva_rate,
        irpf_retention: sourceInvoice.irpf_retention,
        total_amount: sourceInvoice.total_amount,
        issue_date: issueDate,
        status: "draft",
        series,
        invoice_number: invoiceNumber,
        recipient_email: sourceInvoice.recipient_email,
        sent_at: null,
      })
      .select(INVOICE_SELECT_FIELDS)
      .single();

    if (insertError || !duplicated) {
      throw new Error(insertError?.message ?? "DUPLICATE_INVOICE_FAILED");
    }

    try {
      await createAuditLog(supabase, {
        userId: auth.userId,
        domain: "invoices",
        entityType: "invoice",
        entityId: (duplicated as unknown as { id: string }).id,
        action: "duplicated",
        summary: `Factura duplicada desde ${invoiceId}`,
        metadata: { sourceInvoiceId: invoiceId },
      });
    } catch {
      // Do not fail duplicate on audit.
    }

    return NextResponse.json({ success: true, invoice: duplicated });
  } catch (error) {
    log("error", "api_invoice_duplicate_failed", requestId, {
      userId: auth.userId,
      invoiceId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "DUPLICATE_FAILED" }, { status: 500 });
  }
}
