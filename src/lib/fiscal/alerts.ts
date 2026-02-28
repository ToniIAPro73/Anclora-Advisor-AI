import { z } from "zod";

export const fiscalAlertTypeValues = [
  "cuota_cero",
  "iva",
  "irpf",
  "retenciones",
  "autonomo",
  "recordatorio",
] as const;

export const fiscalAlertPriorityValues = ["low", "medium", "high", "critical"] as const;
export const fiscalAlertStatusValues = ["pending", "resolved", "ignored"] as const;

export type FiscalAlertType = (typeof fiscalAlertTypeValues)[number];
export type FiscalAlertPriority = (typeof fiscalAlertPriorityValues)[number];
export type FiscalAlertStatus = (typeof fiscalAlertStatusValues)[number];

export interface FiscalAlertRecord {
  id: string;
  alert_type: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  created_at: string;
}

const optionalDescription = z
  .string()
  .max(2000)
  .transform((value) => value.trim())
  .transform((value) => value || null)
  .nullable()
  .optional();

export const createFiscalAlertSchema = z.object({
  alertType: z.enum(fiscalAlertTypeValues),
  description: optionalDescription,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.enum(fiscalAlertPriorityValues),
});

export const updateFiscalAlertSchema = z
  .object({
    alertType: z.enum(fiscalAlertTypeValues).optional(),
    description: optionalDescription,
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    priority: z.enum(fiscalAlertPriorityValues).optional(),
    status: z.enum(fiscalAlertStatusValues).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

export function sortFiscalAlerts<T extends FiscalAlertRecord>(alerts: T[]): T[] {
  return [...alerts].sort((left, right) => {
    const dueCompare = left.due_date.localeCompare(right.due_date);
    if (dueCompare !== 0) {
      return dueCompare;
    }
    return right.created_at.localeCompare(left.created_at);
  });
}
