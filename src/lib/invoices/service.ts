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
  "paid_at",
  "payment_method",
  "payment_reference",
  "payment_notes",
  "created_at",
].join(", ");

export type InvoiceFilterInput = {
  q?: string;
  status?: string;
  series?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

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

export function normalizeInvoiceQueryParams(input: InvoiceFilterInput) {
  return {
    q: input.q?.trim() ?? "",
    status: input.status?.trim() ?? "",
    series: input.series?.trim().toUpperCase() ?? "",
    dateFrom: input.dateFrom?.trim() ?? "",
    dateTo: input.dateTo?.trim() ?? "",
    limit: Math.max(1, Math.min(500, input.limit ?? 100)),
  };
}

export function applyInvoiceFilters<T>(
  query: T,
  filters: ReturnType<typeof normalizeInvoiceQueryParams>,
  validStatuses: readonly string[]
): T {
  let nextQuery = query;
  const getFilterable = () =>
    nextQuery as T & {
      eq: Function;
      gte: Function;
      lte: Function;
      or: Function;
    };

  if (filters.status && validStatuses.includes(filters.status)) {
    nextQuery = getFilterable().eq("status", filters.status) as T;
  }
  if (filters.series) {
    nextQuery = getFilterable().eq("series", filters.series) as T;
  }
  if (filters.dateFrom) {
    nextQuery = getFilterable().gte("issue_date", filters.dateFrom) as T;
  }
  if (filters.dateTo) {
    nextQuery = getFilterable().lte("issue_date", filters.dateTo) as T;
  }
  if (filters.q) {
    nextQuery = getFilterable().or(`client_name.ilike.%${filters.q}%,client_nif.ilike.%${filters.q}%`) as T;
  }

  return nextQuery;
}

export function buildInvoiceCsv(rows: Array<{
  reference: string;
  clientName: string;
  clientNif: string;
  issueDate: string;
  status: string;
  series: string;
  amountBase: number;
  ivaRate: number;
  irpfRetention: number;
  totalAmount: number;
  recipientEmail: string;
}>): string {
  const headers = [
    "reference",
    "client_name",
    "client_nif",
    "issue_date",
    "status",
    "series",
    "amount_base",
    "iva_rate",
    "irpf_retention",
    "total_amount",
    "recipient_email",
  ];

  const escape = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.reference,
        row.clientName,
        row.clientNif,
        row.issueDate,
        row.status,
        row.series,
        row.amountBase.toFixed(2),
        row.ivaRate.toFixed(2),
        row.irpfRetention.toFixed(2),
        row.totalAmount.toFixed(2),
        row.recipientEmail,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");
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
