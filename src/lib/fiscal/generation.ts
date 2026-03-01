import type { FiscalAlertTemplateRecord } from "@/lib/fiscal/templates";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

function toUtcDateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map((item) => Number.parseInt(item, 10));
  return { year, month, day };
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate(), 0, 0, 0, 0));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildPeriodKey(recurrence: string, dueDate: Date): string {
  const year = dueDate.getUTCFullYear();
  const month = dueDate.getUTCMonth() + 1;
  if (recurrence === "monthly") {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  if (recurrence === "quarterly") {
    return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  }
  return `${year}`;
}

function getRecurrenceStepMonths(recurrence: string): number {
  if (recurrence === "quarterly") return 3;
  if (recurrence === "annual") return 12;
  return 1;
}

function getInitialDueDate(template: FiscalAlertTemplateRecord): Date {
  const startDate = toUtcDateParts(template.start_date);
  const start = createUtcDate(startDate.year, startDate.month, startDate.day);
  const dueMonth = template.recurrence === "annual"
    ? template.due_month ?? startDate.month
    : startDate.month;

  let dueDate = createUtcDate(startDate.year, dueMonth, template.due_day);
  const stepMonths = getRecurrenceStepMonths(template.recurrence);

  while (dueDate.getTime() < start.getTime()) {
    dueDate = addMonths(dueDate, stepMonths);
  }

  return dueDate;
}

function buildDueDates(template: FiscalAlertTemplateRecord, horizonMonths: number, now = new Date()): Date[] {
  const horizonEnd = addMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), horizonMonths);
  const dates: Date[] = [];
  const stepMonths = getRecurrenceStepMonths(template.recurrence);
  let dueDate = getInitialDueDate(template);

  while (dueDate.getTime() <= horizonEnd.getTime()) {
    if (dueDate.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
      dates.push(dueDate);
    }
    dueDate = addMonths(dueDate, stepMonths);
  }

  return dates;
}

export async function generateFiscalAlertsFromTemplates(params: {
  userId: string;
  templateIds?: string[];
  horizonMonths?: number;
}): Promise<{
  templatesProcessed: number;
  alertsCreated: number;
}> {
  const supabase = createServiceSupabaseClient();
  let query = supabase
    .from("fiscal_alert_templates")
    .select("*")
    .eq("user_id", params.userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (params.templateIds && params.templateIds.length > 0) {
    query = query.in("id", params.templateIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const templates = (data ?? []) as FiscalAlertTemplateRecord[];
  let alertsCreated = 0;

  for (const template of templates) {
    const dueDates = buildDueDates(template, params.horizonMonths ?? 6);
    for (const dueDate of dueDates) {
      const periodKey = buildPeriodKey(template.recurrence, dueDate);
      const { data: existing, error: existingError } = await supabase
        .from("fiscal_alerts")
        .select("id")
        .eq("user_id", params.userId)
        .eq("template_id", template.id)
        .eq("period_key", periodKey)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existing) {
        continue;
      }

      const { error: insertError } = await supabase
        .from("fiscal_alerts")
        .insert({
          user_id: params.userId,
          alert_type: template.alert_type,
          description: template.description,
          due_date: formatDate(dueDate),
          priority: template.priority,
          status: "pending",
          workflow_status: "pending",
          template_id: template.id,
          period_key: periodKey,
          source: "template",
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      alertsCreated += 1;
    }
  }

  return {
    templatesProcessed: templates.length,
    alertsCreated,
  };
}
