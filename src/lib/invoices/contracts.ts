import { z } from "zod";

export const invoiceStatusValues = ["draft", "issued", "paid"] as const;

export type InvoiceStatus = (typeof invoiceStatusValues)[number];

export interface InvoiceRecord {
  id: string;
  client_name: string;
  client_nif: string;
  amount_base: number;
  iva_rate: number;
  irpf_retention: number;
  total_amount: number;
  issue_date: string;
  status: string;
  series: string | null;
  invoice_number: number | null;
  recipient_email: string | null;
  sent_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  created_at: string;
}

export interface InvoicePaymentRecord {
  id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}

export const createInvoiceSchema = z.object({
  clientName: z.string().min(2).max(255).transform((value) => value.trim()),
  clientNif: z.string().min(5).max(50).transform((value) => value.trim().toUpperCase()),
  amountBase: z.number().positive(),
  ivaRate: z.number().min(0).max(100),
  irpfRetention: z.number().min(0).max(100),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  series: z.string().min(1).max(20).transform((value) => value.trim().toUpperCase()).optional(),
  recipientEmail: z.string().email().max(255).transform((value) => value.trim().toLowerCase()).optional(),
  paidAt: z.string().datetime().optional(),
  paymentMethod: z.string().min(2).max(80).transform((value) => value.trim()).optional(),
  paymentReference: z.string().min(1).max(120).transform((value) => value.trim()).optional(),
  paymentNotes: z.string().max(2000).transform((value) => value.trim()).optional(),
});

export const updateInvoiceSchema = z
  .object({
    clientName: z.string().min(2).max(255).transform((value) => value.trim()).optional(),
    clientNif: z.string().min(5).max(50).transform((value) => value.trim().toUpperCase()).optional(),
    amountBase: z.number().positive().optional(),
    ivaRate: z.number().min(0).max(100).optional(),
    irpfRetention: z.number().min(0).max(100).optional(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    series: z.string().min(1).max(20).transform((value) => value.trim().toUpperCase()).optional(),
    recipientEmail: z.string().email().max(255).transform((value) => value.trim().toLowerCase()).optional(),
    status: z.enum(invoiceStatusValues).optional(),
    paidAt: z.string().datetime().nullable().optional(),
    paymentMethod: z.string().min(2).max(80).transform((value) => value.trim()).nullable().optional(),
    paymentReference: z.string().min(1).max(120).transform((value) => value.trim()).nullable().optional(),
    paymentNotes: z.string().max(2000).transform((value) => value.trim()).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

export const createInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.string().datetime(),
  paymentMethod: z.string().min(2).max(80).transform((value) => value.trim()),
  paymentReference: z.string().max(120).transform((value) => value.trim()).optional(),
  notes: z.string().max(2000).transform((value) => value.trim()).optional(),
});
