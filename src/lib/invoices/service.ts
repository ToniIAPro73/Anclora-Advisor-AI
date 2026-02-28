import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_SELECT_FIELDS = [
  "id",
  "client_name",
  "client_nif",
  "amount_base",
  "iva_rate",
  "irpf_retention",
  "total_amount",
  "issue_date",
  "status",
  "series",
  "invoice_number",
  "recipient_email",
  "sent_at",
  "created_at",
].join(", ");

export function normalizeInvoiceSeries(series: string | undefined, issueDate: string): string {
  const candidate = (series ?? issueDate.slice(0, 4)).trim().toUpperCase();
  return candidate || issueDate.slice(0, 4);
}

export async function getNextInvoiceNumber(
  supabase: SupabaseClient,
  userId: string,
  series: string
): Promise<number> {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .eq("series", series)
    .order("invoice_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.invoice_number ?? 0) + 1;
}

export function buildInvoiceReference(series: string | null, invoiceNumber: number | null): string {
  if (!series || !invoiceNumber) {
    return "Sin numerar";
  }

  return `${series}-${String(invoiceNumber).padStart(4, "0")}`;
}

export function buildInvoiceMailtoUrl(params: {
  recipientEmail: string;
  invoiceReference: string;
  clientName: string;
  totalAmount: number;
}): string {
  const subject = `Factura ${params.invoiceReference} - ${params.clientName}`;
  const bodyLines = [
    `Hola ${params.clientName},`,
    "",
    `Adjunto la factura ${params.invoiceReference} por importe de ${params.totalAmount.toFixed(2)} EUR.`,
    "",
    "Puedes descargar la version imprimible desde el dashboard de Anclora.",
  ];

  return `mailto:${encodeURIComponent(params.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
}
