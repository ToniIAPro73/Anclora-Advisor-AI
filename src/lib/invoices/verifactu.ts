import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { buildInvoiceReference } from "@/lib/invoices/service";

export type VerifactuSubmissionResult = {
  submissionId: string;
  status: "submitted";
  submittedAt: string;
  rawResponse: Record<string, unknown>;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function isVerifactuConfigured(): boolean {
  return Boolean(process.env.VERIFACTU_ENDPOINT_URL && process.env.VERIFACTU_API_TOKEN);
}

export function buildVerifactuPayload(invoice: InvoiceRecord, userId: string): Record<string, unknown> {
  return {
    issuerSystemId: process.env.VERIFACTU_SYSTEM_ID?.trim() || "ANCLORA-ADVISOR-AI",
    invoiceId: invoice.id,
    userId,
    reference: buildInvoiceReference(invoice.series, invoice.invoice_number),
    invoiceType: invoice.invoice_type ?? "standard",
    issuedAt: invoice.issue_date,
    recipient: {
      name: invoice.client_name,
      taxId: invoice.client_nif,
      email: invoice.recipient_email,
    },
    totals: {
      baseAmount: Number(invoice.amount_base),
      ivaRate: Number(invoice.iva_rate),
      irpfRetention: Number(invoice.irpf_retention),
      totalAmount: Number(invoice.total_amount),
    },
    payment: {
      method: invoice.payment_method,
      reference: invoice.payment_reference,
      notes: invoice.payment_notes,
      paidAt: invoice.paid_at,
    },
  };
}

export async function submitInvoiceToVerifactu(params: {
  invoice: InvoiceRecord;
  userId: string;
}): Promise<VerifactuSubmissionResult> {
  const endpointUrl = readRequiredEnv("VERIFACTU_ENDPOINT_URL");
  const apiToken = readRequiredEnv("VERIFACTU_API_TOKEN");
  const submittedAt = new Date().toISOString();
  const payload = buildVerifactuPayload(params.invoice, params.userId);

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "X-Verifactu-System": process.env.VERIFACTU_SYSTEM_ID?.trim() || "ANCLORA-ADVISOR-AI",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawResponse = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errorMessage =
      typeof rawResponse.error === "string"
        ? rawResponse.error
        : typeof rawResponse.message === "string"
          ? rawResponse.message
          : `VERIFACTU_HTTP_${response.status}`;
    throw new Error(errorMessage);
  }

  const candidateId =
    typeof rawResponse.submissionId === "string"
      ? rawResponse.submissionId
      : typeof rawResponse.id === "string"
        ? rawResponse.id
        : typeof rawResponse.reference === "string"
          ? rawResponse.reference
          : null;

  return {
    submissionId: candidateId ?? crypto.randomUUID(),
    status: "submitted",
    submittedAt,
    rawResponse,
  };
}
