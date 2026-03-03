import { z } from "zod";

export const generalAlertReminderRecurrenceValues = ["monthly", "quarterly", "yearly"] as const;
export type GeneralAlertReminderRecurrence = (typeof generalAlertReminderRecurrenceValues)[number];

export interface GeneralAlertReminderRecord {
  id: string;
  user_id: string;
  category: string;
  title: string;
  message: string | null;
  priority: string;
  recurrence: string;
  anchor_date: string;
  lead_days: number;
  link_href: string | null;
  is_active: boolean;
  last_generated_for: string | null;
  created_at: string;
  updated_at: string;
}

export const createGeneralAlertReminderSchema = z.object({
  category: z.enum(["fiscal", "laboral", "facturacion"]),
  title: z.string().trim().min(3).max(255),
  message: z.string().max(2000).transform((value) => value.trim()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  recurrence: z.enum(generalAlertReminderRecurrenceValues),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leadDays: z.number().int().min(0).max(365),
  linkHref: z.string().trim().max(500).optional(),
}).transform((value) => ({
  ...value,
  message: value.message && value.message.length > 0 ? value.message : null,
  linkHref: value.linkHref && value.linkHref.length > 0 ? value.linkHref : null,
}));

export const updateGeneralAlertReminderSchema = z
  .object({
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

function parseDateOnly(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function getRecurrenceMonths(recurrence: GeneralAlertReminderRecurrence): number {
  if (recurrence === "monthly") return 1;
  if (recurrence === "quarterly") return 3;
  return 12;
}

export function getNextReminderOccurrence(input: {
  anchorDate: string;
  recurrence: GeneralAlertReminderRecurrence;
  from?: Date;
}): string {
  const from = input.from ?? new Date();
  const fromDate = parseDateOnly(formatDateOnly(from));
  let current = parseDateOnly(input.anchorDate);
  const stepMonths = getRecurrenceMonths(input.recurrence);

  while (current < fromDate) {
    current = addMonths(current, stepMonths);
  }

  return formatDateOnly(current);
}

export function buildReminderRunAfter(occurrenceDate: string, leadDays: number): string {
  const occurrence = parseDateOnly(occurrenceDate);
  occurrence.setUTCDate(occurrence.getUTCDate() - leadDays);
  occurrence.setUTCHours(8, 0, 0, 0);
  return occurrence.toISOString();
}

export function buildNextReminderOccurrence(currentOccurrenceDate: string, recurrence: GeneralAlertReminderRecurrence): string {
  return formatDateOnly(addMonths(parseDateOnly(currentOccurrenceDate), getRecurrenceMonths(recurrence)));
}

export function getReminderRecurrenceLabel(recurrence: string, locale: "es" | "en"): string {
  if (recurrence === "monthly") return locale === "en" ? "Monthly" : "Mensual";
  if (recurrence === "quarterly") return locale === "en" ? "Quarterly" : "Trimestral";
  return locale === "en" ? "Yearly" : "Anual";
}
