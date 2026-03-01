import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { buildInvoiceReference, getInvoiceTypeLabel } from "@/lib/invoices/service";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getInvoicePdfFileName(invoice: InvoiceRecord): string {
  const reference = buildInvoiceReference(invoice.series, invoice.invoice_number)
    .replace(/\//g, "-")
    .replace(/ /g, "-");
  return `${invoice.invoice_type === "rectificative" ? "factura-rectificativa" : "factura"}-${reference}.pdf`;
}

export function renderInvoicePrintableHtml(invoice: InvoiceRecord): string {
  const amountBase = Number(invoice.amount_base);
  const ivaAmount = (amountBase * Number(invoice.iva_rate)) / 100;
  const irpfAmount = (amountBase * Number(invoice.irpf_retention)) / 100;
  const totalAmount = Number(invoice.total_amount);
  const invoiceReference = buildInvoiceReference(invoice.series, invoice.invoice_number);
  const invoiceTypeLabel = getInvoiceTypeLabel(invoice.invoice_type);

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoiceTypeLabel)} ${escapeHtml(invoiceReference)}</title>
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
        <h1>${escapeHtml(invoiceTypeLabel)} ${escapeHtml(invoiceReference)}</h1>
        <p class="muted">Emitida el ${escapeHtml(formatDate(invoice.issue_date))}</p>
        ${invoice.rectification_reason ? `<p class="muted">Motivo: ${escapeHtml(invoice.rectification_reason)}</p>` : ""}
      </div>
      <div class="card">
        <strong>Cliente</strong>
        <div>${escapeHtml(invoice.client_name)}</div>
        <div class="muted">${escapeHtml(invoice.client_nif)}</div>
        ${invoice.recipient_email ? `<div class="muted">${escapeHtml(invoice.recipient_email)}</div>` : ""}
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <strong>Datos de facturacion</strong>
        <table class="summary">
          <tr><th>Base imponible</th><td>${escapeHtml(formatCurrency(amountBase))}</td></tr>
          <tr><th>IVA (${escapeHtml(Number(invoice.iva_rate).toFixed(2))}%)</th><td>${escapeHtml(formatCurrency(ivaAmount))}</td></tr>
          <tr><th>IRPF (${escapeHtml(Number(invoice.irpf_retention).toFixed(2))}%)</th><td>- ${escapeHtml(formatCurrency(irpfAmount))}</td></tr>
          <tr><th class="total">Total</th><td class="total">${escapeHtml(formatCurrency(totalAmount))}</td></tr>
        </table>
      </div>
      <div class="card">
        <strong>Estado</strong>
        <div>${escapeHtml(invoice.status)}</div>
        <p class="muted" style="margin-top: 12px;">Serie: ${escapeHtml(invoice.series ?? "-")}</p>
        <p class="muted">Numero: ${escapeHtml(String(invoice.invoice_number ?? "-"))}</p>
        <p class="muted">Enviada: ${escapeHtml(invoice.sent_at ? formatDate(invoice.sent_at) : "No")}</p>
      </div>
    </div>
  </body>
</html>`;
}

export async function generateInvoicePdfBuffer(invoice: InvoiceRecord): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.16, 0.27);
  const muted = rgb(0.23, 0.31, 0.4);
  const amountBase = Number(invoice.amount_base);
  const ivaAmount = (amountBase * Number(invoice.iva_rate)) / 100;
  const irpfAmount = (amountBase * Number(invoice.irpf_retention)) / 100;
  const totalAmount = Number(invoice.total_amount);
  const invoiceReference = buildInvoiceReference(invoice.series, invoice.invoice_number);
  const invoiceTypeLabel = getInvoiceTypeLabel(invoice.invoice_type);

  let y = 790;
  page.drawText(`${invoiceTypeLabel} ${invoiceReference}`, { x: 50, y, size: 24, font: boldFont, color: dark });
  y -= 26;
  page.drawText(`Fecha de emision: ${formatDate(invoice.issue_date)}`, { x: 50, y, size: 11, font, color: muted });
  if (invoice.rectification_reason) {
    y -= 16;
    page.drawText(`Motivo: ${invoice.rectification_reason}`, { x: 50, y, size: 11, font, color: muted });
  }
  y -= 38;

  page.drawText("Cliente", { x: 50, y, size: 14, font: boldFont, color: dark });
  y -= 20;
  page.drawText(invoice.client_name, { x: 50, y, size: 12, font, color: dark });
  y -= 16;
  page.drawText(invoice.client_nif, { x: 50, y, size: 12, font, color: muted });
  if (invoice.recipient_email) {
    y -= 16;
    page.drawText(invoice.recipient_email, { x: 50, y, size: 12, font, color: muted });
  }

  y -= 40;
  page.drawText("Resumen", { x: 50, y, size: 14, font: boldFont, color: dark });
  y -= 24;

  const lines = [
    ["Base imponible", formatCurrency(amountBase)],
    [`IVA (${Number(invoice.iva_rate).toFixed(2)}%)`, formatCurrency(ivaAmount)],
    [`IRPF (${Number(invoice.irpf_retention).toFixed(2)}%)`, `- ${formatCurrency(irpfAmount)}`],
    ["Total", formatCurrency(totalAmount)],
    ["Estado", invoice.status],
    ["Serie", invoice.series ?? "-"],
    ["Numero", String(invoice.invoice_number ?? "-")],
  ];

  for (const [label, value] of lines) {
    page.drawText(label, { x: 50, y, size: 12, font: boldFont, color: dark });
    page.drawText(value, { x: 240, y, size: 12, font, color: dark });
    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
