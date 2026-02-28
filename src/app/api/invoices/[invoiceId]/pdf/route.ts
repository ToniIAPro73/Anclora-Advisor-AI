import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { buildInvoiceReference, INVOICE_SELECT_FIELDS } from "@/lib/invoices/service";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

async function getAuthenticatedAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return null;
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return null;
  }

  return accessToken;
}

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const accessToken = await getAuthenticatedAccessToken();

  if (!accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { invoiceId } = await context.params;
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", invoiceId)
    .single();

  if (error || !data) {
    log("error", "api_invoice_pdf_failed", requestId, { invoiceId, error: error?.message ?? "not_found" });
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const invoiceRecord = data as unknown as InvoiceRecord;
  const amountBase = Number(invoiceRecord.amount_base);
  const ivaAmount = (amountBase * Number(invoiceRecord.iva_rate)) / 100;
  const irpfAmount = (amountBase * Number(invoiceRecord.irpf_retention)) / 100;
  const totalAmount = Number(invoiceRecord.total_amount);
  const invoiceReference = buildInvoiceReference(invoiceRecord.series, invoiceRecord.invoice_number);

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Factura ${invoiceReference}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #162944; margin: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
      .card { border: 1px solid #d2dceb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .summary { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .summary td, .summary th { padding: 10px; border-bottom: 1px solid #d2dceb; text-align: left; }
      .total { font-size: 20px; font-weight: 700; }
      .muted { color: #3a4f67; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Factura ${invoiceReference}</h1>
        <p class="muted">Emitida el ${formatDate(invoiceRecord.issue_date)}</p>
      </div>
      <div class="card">
        <strong>Cliente</strong>
        <div>${invoiceRecord.client_name}</div>
        <div class="muted">${invoiceRecord.client_nif}</div>
        ${invoiceRecord.recipient_email ? `<div class="muted">${invoiceRecord.recipient_email}</div>` : ""}
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <strong>Datos de facturacion</strong>
        <table class="summary">
          <tr><th>Base imponible</th><td>${formatCurrency(amountBase)}</td></tr>
          <tr><th>IVA (${Number(invoiceRecord.iva_rate).toFixed(2)}%)</th><td>${formatCurrency(ivaAmount)}</td></tr>
          <tr><th>IRPF (${Number(invoiceRecord.irpf_retention).toFixed(2)}%)</th><td>- ${formatCurrency(irpfAmount)}</td></tr>
          <tr><th class="total">Total</th><td class="total">${formatCurrency(totalAmount)}</td></tr>
        </table>
      </div>
      <div class="card">
        <strong>Estado</strong>
        <div>${invoiceRecord.status}</div>
        <p class="muted" style="margin-top: 12px;">Serie: ${invoiceRecord.series ?? "-"}</p>
        <p class="muted">Numero: ${invoiceRecord.invoice_number ?? "-"}</p>
        <p class="muted">Enviada: ${invoiceRecord.sent_at ? formatDate(invoiceRecord.sent_at) : "No"}</p>
      </div>
    </div>
  </body>
</html>`;

  const response = new NextResponse(html, { status: 200 });
  response.headers.set("content-type", "text/html; charset=utf-8");
  response.headers.set("x-request-id", requestId);
  return response;
}
