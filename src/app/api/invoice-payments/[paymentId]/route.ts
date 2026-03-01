import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

const INVOICE_PAYMENT_SELECT_FIELDS = [
  "id",
  "invoice_id",
  "amount",
  "paid_at",
  "payment_method",
  "payment_reference",
  "notes",
  "created_at",
].join(", ");

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

async function recalculateInvoiceStatus(
  accessToken: string,
  invoiceId: string,
): Promise<InvoiceRecord> {
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "INVOICE_NOT_FOUND");
  }

  const invoiceRecord = invoice as unknown as InvoiceRecord;
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("invoice_payments")
    .select(INVOICE_PAYMENT_SELECT_FIELDS)
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const payments = (paymentRows ?? []) as unknown as Array<{
    paid_at: string;
    amount: number;
    payment_method: string | null;
    payment_reference: string | null;
    notes: string | null;
  }>;
  const collectedAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const latestPayment = payments[0] ?? null;
  const isFullyPaid = collectedAmount + 0.0001 >= Number(invoiceRecord.total_amount);

  const nextStatus =
    payments.length === 0
      ? "issued"
      : isFullyPaid
        ? "paid"
        : "issued";

  const { data: updatedInvoice, error: updateError } = await supabase
    .from("invoices")
    .update({
      status: nextStatus,
      paid_at: isFullyPaid ? latestPayment?.paid_at ?? null : null,
      payment_method: latestPayment?.payment_method ?? null,
      payment_reference: latestPayment?.payment_reference ?? null,
      payment_notes: latestPayment?.notes ?? null,
    })
    .eq("id", invoiceId)
    .select(INVOICE_SELECT_FIELDS)
    .single();

  if (updateError || !updatedInvoice) {
    throw new Error(updateError?.message ?? "INVOICE_UPDATE_FAILED");
  }

  return updatedInvoice as unknown as InvoiceRecord;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: payment, error: paymentError } = await supabase
    .from("invoice_payments")
    .select(INVOICE_PAYMENT_SELECT_FIELDS)
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ success: false, error: paymentError?.message ?? "PAYMENT_NOT_FOUND" }, { status: 404 });
  }

  const invoiceId = (payment as unknown as { invoice_id: string }).invoice_id;
  const { error: deleteError } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (deleteError) {
    log("error", "api_invoice_payment_delete_failed", requestId, { paymentId, error: deleteError.message });
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  try {
    const invoice = await recalculateInvoiceStatus(auth.accessToken, invoiceId);
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "invoices",
      entityType: "invoice_payment",
      entityId: paymentId,
      action: "deleted",
      summary: `Cobro eliminado de factura ${invoiceId}`,
      metadata: { invoiceId },
    });
    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "PAYMENT_DELETE_RECALC_FAILED" }, { status: 500 });
  }
}
