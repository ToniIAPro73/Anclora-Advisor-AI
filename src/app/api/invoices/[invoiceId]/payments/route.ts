import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import {
  createInvoicePaymentSchema,
  type InvoicePaymentRecord,
  type InvoiceRecord,
} from "@/lib/invoices/contracts";
import { INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
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

  const payments = (paymentRows ?? []) as unknown as InvoicePaymentRecord[];
  const collectedAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const latestPayment = payments[0] ?? null;
  const isFullyPaid = collectedAmount + 0.0001 >= Number(invoiceRecord.total_amount);

  const nextStatus =
    payments.length === 0
      ? invoiceRecord.status === "draft"
        ? "draft"
        : "issued"
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

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("invoice_payments")
    .select(INVOICE_PAYMENT_SELECT_FIELDS)
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

  if (error) {
    log("error", "api_invoice_payments_get_failed", requestId, { invoiceId, error: error.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ success: true, payments: data ?? [] });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = createInvoicePaymentSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json({ success: false, error: "INVALID_PAYMENT_PAYLOAD" }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoiceRow) {
    return NextResponse.json({ success: false, error: invoiceError?.message ?? "INVOICE_NOT_FOUND" }, { status: 404 });
  }

  const invoiceRecord = invoiceRow as unknown as InvoiceRecord;
  const { data: existingPayments, error: existingPaymentsError } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  if (existingPaymentsError) {
    return NextResponse.json({ success: false, error: existingPaymentsError.message }, { status: 500 });
  }

  const collectedAmount = (existingPayments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstandingAmount = Math.max(0, Number(invoiceRecord.total_amount) - collectedAmount);
  if (payload.data.amount - outstandingAmount > 0.01) {
    return NextResponse.json({ success: false, error: "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE" }, { status: 400 });
  }

  const { data: createdPayment, error: createError } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      user_id: auth.userId,
      amount: payload.data.amount,
      paid_at: payload.data.paidAt,
      payment_method: payload.data.paymentMethod,
      payment_reference: payload.data.paymentReference ?? null,
      notes: payload.data.notes ?? null,
    })
    .select(INVOICE_PAYMENT_SELECT_FIELDS)
    .single();

  if (createError || !createdPayment) {
    log("error", "api_invoice_payments_post_failed", requestId, { invoiceId, error: createError?.message ?? "unknown" });
    return NextResponse.json({ success: false, error: createError?.message ?? "PAYMENT_CREATE_FAILED" }, { status: 500 });
  }

  try {
    const invoice = await recalculateInvoiceStatus(auth.accessToken, invoiceId);

    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "invoices",
      entityType: "invoice_payment",
      entityId: (createdPayment as { id?: string }).id ?? null,
      action: "created",
      summary: `Cobro registrado para factura ${invoiceId}`,
      metadata: {
        invoiceId,
        amount: payload.data.amount,
        paymentMethod: payload.data.paymentMethod,
      },
    });

    const response = NextResponse.json({
      success: true,
      payment: createdPayment,
      invoice,
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    log("error", "api_invoice_payments_recalc_failed", requestId, {
      invoiceId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "PAYMENT_RECALC_FAILED" }, { status: 500 });
  }
}
