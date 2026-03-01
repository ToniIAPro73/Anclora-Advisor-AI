import { z } from "zod";
import type { FiscalAlertPriority, FiscalAlertType, FiscalTaxModel, FiscalTaxRegime } from "@/lib/fiscal/alerts";
import {
  fiscalAlertPriorityValues,
  fiscalAlertTypeValues,
  fiscalTaxModelValues,
  fiscalTaxRegimeValues,
  getFiscalTaxModelLabel,
  getFiscalTaxRegimeLabel,
} from "@/lib/fiscal/alerts";

export const fiscalTemplateRecurrenceValues = ["monthly", "quarterly", "annual"] as const;
export type FiscalTemplateRecurrence = (typeof fiscalTemplateRecurrenceValues)[number];

export interface FiscalAlertTemplateRecord {
  id: string;
  alert_type: string;
  description: string | null;
  priority: string;
  recurrence: string;
  due_day: number;
  due_month: number | null;
  start_date: string;
  is_active: boolean;
  tax_regime: string | null;
  tax_model: string | null;
  created_at: string;
  updated_at: string;
}

const fiscalTemplateSchemaBase = z.object({
  alertType: z.enum(fiscalAlertTypeValues),
  description: z.string().max(2000).transform((value) => value.trim()).transform((value) => value || null).nullable().optional(),
  priority: z.enum(fiscalAlertPriorityValues),
  recurrence: z.enum(fiscalTemplateRecurrenceValues),
  dueDay: z.number().int().min(1).max(28),
  dueMonth: z.number().int().min(1).max(12).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean().optional(),
  taxRegime: z.enum(fiscalTaxRegimeValues).optional(),
  taxModel: z.enum(fiscalTaxModelValues).optional(),
});

function validateAnnualDueMonth(
  value: { recurrence?: FiscalTemplateRecurrence; dueMonth?: number | null },
  ctx: z.RefinementCtx
) {
  if (value.recurrence === "annual" && !value.dueMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueMonth"],
      message: "dueMonth is required for annual templates",
    });
  }
}

export const createFiscalTemplateSchema = fiscalTemplateSchemaBase.superRefine(validateAnnualDueMonth);

export const updateFiscalTemplateSchema = fiscalTemplateSchemaBase
  .partial()
  .superRefine(validateAnnualDueMonth)
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

export function getFiscalTemplateLabel(template: {
  alert_type: string;
  recurrence: string;
  due_day: number;
  due_month: number | null;
  tax_regime?: string | null;
  tax_model?: string | null;
}): string {
  const recurrence = template.recurrence === "monthly"
    ? "mensual"
    : template.recurrence === "quarterly"
      ? "trimestral"
      : "anual";

  const cadence = template.recurrence === "annual"
    ? `${recurrence} · dia ${template.due_day}/${template.due_month}`
    : `${recurrence} · dia ${template.due_day}`;
  const model = template.tax_model ? getFiscalTaxModelLabel(template.tax_model) : "Sin modelo";
  const regime = template.tax_regime ? getFiscalTaxRegimeLabel(template.tax_regime) : "General";
  return `${template.alert_type} · ${model} · ${regime} · ${cadence}`;
}

export function normalizeFiscalTemplatePatch(input: {
  alertType?: FiscalAlertType;
  description?: string | null;
  priority?: FiscalAlertPriority;
  recurrence?: FiscalTemplateRecurrence;
  dueDay?: number;
  dueMonth?: number | null;
  startDate?: string;
  isActive?: boolean;
  taxRegime?: FiscalTaxRegime;
  taxModel?: FiscalTaxModel;
}) {
  const patch: Record<string, string | number | boolean | null> = {};
  if (input.alertType !== undefined) patch.alert_type = input.alertType;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  if (input.dueDay !== undefined) patch.due_day = input.dueDay;
  if (input.dueMonth !== undefined) patch.due_month = input.dueMonth;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.taxRegime !== undefined) patch.tax_regime = input.taxRegime;
  if (input.taxModel !== undefined) patch.tax_model = input.taxModel;
  return patch;
}
