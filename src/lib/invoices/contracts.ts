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
  created_at: string;
}

export const createInvoiceSchema = z.object({
  clientName: z.string().min(2).max(255).transform((value) => value.trim()),
  clientNif: z.string().min(5).max(50).transform((value) => value.trim().toUpperCase()),
  amountBase: z.number().positive(),
  ivaRate: z.number().min(0).max(100),
  irpfRetention: z.number().min(0).max(100),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateInvoiceSchema = z
  .object({
    clientName: z.string().min(2).max(255).transform((value) => value.trim()).optional(),
    clientNif: z.string().min(5).max(50).transform((value) => value.trim().toUpperCase()).optional(),
    amountBase: z.number().positive().optional(),
    ivaRate: z.number().min(0).max(100).optional(),
    irpfRetention: z.number().min(0).max(100).optional(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(invoiceStatusValues).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });
