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
export const fiscalAlertWorkflowStatusValues = ["pending", "prepared", "presented", "closed"] as const;
export const fiscalTaxRegimeValues = ["general", "estimacion_directa", "pluriactividad", "cuota_cero_baleares", "custom"] as const;
export const fiscalTaxModelValues = ["303", "130", "111", "reta", "cuota_cero", "custom"] as const;

export type FiscalAlertType = (typeof fiscalAlertTypeValues)[number];
export type FiscalAlertPriority = (typeof fiscalAlertPriorityValues)[number];
export type FiscalAlertStatus = (typeof fiscalAlertStatusValues)[number];
export type FiscalAlertWorkflowStatus = (typeof fiscalAlertWorkflowStatusValues)[number];
export type FiscalTaxRegime = (typeof fiscalTaxRegimeValues)[number];
export type FiscalTaxModel = (typeof fiscalTaxModelValues)[number];

export interface FiscalAlertRecord {
  id: string;
  alert_type: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  workflow_status: string;
  presented_at: string | null;
  template_id: string | null;
  period_key: string | null;
  source: string;
  tax_regime: string | null;
  tax_model: string | null;
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
  workflowStatus: z.enum(fiscalAlertWorkflowStatusValues).optional(),
  taxRegime: z.enum(fiscalTaxRegimeValues).optional(),
  taxModel: z.enum(fiscalTaxModelValues).optional(),
});

export const updateFiscalAlertSchema = z
  .object({
    alertType: z.enum(fiscalAlertTypeValues).optional(),
    description: optionalDescription,
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    priority: z.enum(fiscalAlertPriorityValues).optional(),
    status: z.enum(fiscalAlertStatusValues).optional(),
    workflowStatus: z.enum(fiscalAlertWorkflowStatusValues).optional(),
    taxRegime: z.enum(fiscalTaxRegimeValues).optional(),
    taxModel: z.enum(fiscalTaxModelValues).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

export function getDefaultFiscalModel(alertType: FiscalAlertType): FiscalTaxModel {
  if (alertType === "iva") return "303";
  if (alertType === "irpf") return "130";
  if (alertType === "retenciones") return "111";
  if (alertType === "autonomo") return "reta";
  if (alertType === "cuota_cero") return "cuota_cero";
  return "custom";
}

export function getDefaultFiscalRegime(alertType: FiscalAlertType): FiscalTaxRegime {
  if (alertType === "cuota_cero") return "cuota_cero_baleares";
  return "general";
}

export function getFiscalTaxRegimeLabel(regime: string | null | undefined): string {
  if (regime === "estimacion_directa") return "Estimacion directa";
  if (regime === "pluriactividad") return "Pluriactividad";
  if (regime === "cuota_cero_baleares") return "Cuota Cero Baleares";
  if (regime === "custom") return "Custom";
  return "General";
}

export function getFiscalTaxModelLabel(model: string | null | undefined): string {
  if (model === "reta") return "RETA";
  if (model === "cuota_cero") return "Cuota Cero";
  if (model === "custom") return "Custom";
  return model ?? "N/D";
}

export function sortFiscalAlerts<T extends FiscalAlertRecord>(alerts: T[]): T[] {
  return [...alerts].sort((left, right) => {
    const dueCompare = left.due_date.localeCompare(right.due_date);
    if (dueCompare !== 0) {
      return dueCompare;
    }
    return right.created_at.localeCompare(left.created_at);
  });
}
