import { z } from "zod";
import type { FiscalAlertRecord } from "@/lib/fiscal/alerts";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import type { LaborMitigationActionRecord } from "@/lib/labor/assessments";

export const generalAlertCategoryValues = ["fiscal", "laboral", "facturacion"] as const;
export const generalAlertPriorityValues = ["low", "medium", "high", "critical"] as const;
export const generalAlertStatusValues = ["pending", "resolved"] as const;
export const generalAlertSourceValues = ["manual", "fiscal", "laboral", "facturacion"] as const;

export type GeneralAlertCategory = (typeof generalAlertCategoryValues)[number];
export type GeneralAlertPriority = (typeof generalAlertPriorityValues)[number];
export type GeneralAlertStatus = (typeof generalAlertStatusValues)[number];
export type GeneralAlertSource = (typeof generalAlertSourceValues)[number];

export interface GeneralAlertRecord {
  id: string;
  user_id: string;
  source_key: string;
  source: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  category: string;
  title: string;
  message: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  link_href: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  browser_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneralAlertCandidate {
  sourceKey: string;
  source: GeneralAlertSource;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  category: GeneralAlertCategory;
  title: string;
  message: string | null;
  priority: GeneralAlertPriority;
  status: GeneralAlertStatus;
  dueDate: string | null;
  linkHref: string | null;
  metadata: Record<string, unknown>;
}

export const createGeneralAlertSchema = z.object({
  category: z.enum(generalAlertCategoryValues),
  title: z.string().trim().min(3).max(255),
  message: z.string().max(2000).transform((value) => value.trim()).optional(),
  priority: z.enum(generalAlertPriorityValues),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  linkHref: z.string().trim().max(500).optional(),
}).transform((value) => ({
  ...value,
  message: value.message && value.message.length > 0 ? value.message : null,
  dueDate: value.dueDate ?? null,
  linkHref: value.linkHref && value.linkHref.length > 0 ? value.linkHref : null,
}));

export const updateGeneralAlertSchema = z
  .object({
    read: z.boolean().optional(),
    status: z.enum(generalAlertStatusValues).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field must be provided",
  });

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysUntil(dateIso: string, now = new Date()): number {
  const due = startOfDay(new Date(dateIso));
  const base = startOfDay(now);
  return Math.round((due.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

function getPriorityRank(priority: string): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  return 3;
}

export function sortGeneralAlerts<T extends Pick<GeneralAlertRecord, "status" | "priority" | "due_date" | "created_at">>(alerts: T[]): T[] {
  return [...alerts].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "pending" ? -1 : 1;
    }

    const priorityCompare = getPriorityRank(left.priority) - getPriorityRank(right.priority);
    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    if (left.due_date && right.due_date) {
      const dueCompare = left.due_date.localeCompare(right.due_date);
      if (dueCompare !== 0) {
        return dueCompare;
      }
    } else if (left.due_date || right.due_date) {
      return left.due_date ? -1 : 1;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}

export function getGeneralAlertCategoryLabel(category: string, locale: "es" | "en"): string {
  if (category === "fiscal") return locale === "en" ? "Tax" : "Fiscal";
  if (category === "laboral") return locale === "en" ? "Labor" : "Laboral";
  return locale === "en" ? "Invoicing" : "Facturacion";
}

export function getGeneralAlertPriorityLabel(priority: string, locale: "es" | "en"): string {
  if (priority === "critical") return locale === "en" ? "Critical" : "Critica";
  if (priority === "high") return locale === "en" ? "High" : "Alta";
  if (priority === "medium") return locale === "en" ? "Medium" : "Media";
  return locale === "en" ? "Low" : "Baja";
}

export function getGeneralAlertDueLabel(dueDate: string | null, locale: "es" | "en", now = new Date()): string | null {
  if (!dueDate) {
    return null;
  }

  const days = daysUntil(dueDate, now);
  if (days < 0) {
    return locale === "en" ? `${Math.abs(days)} day(s) overdue` : `Vencida hace ${Math.abs(days)} dia(s)`;
  }
  if (days === 0) {
    return locale === "en" ? "Due today" : "Vence hoy";
  }
  if (days === 1) {
    return locale === "en" ? "Due tomorrow" : "Vence manana";
  }
  return locale === "en" ? `Due in ${days} day(s)` : `Vence en ${days} dia(s)`;
}

function getFiscalAlertTitle(alertType: string): string {
  if (alertType === "iva") return "Modelo 303 (IVA)";
  if (alertType === "irpf") return "Modelo 130 (IRPF)";
  if (alertType === "retenciones") return "Retenciones";
  if (alertType === "autonomo") return "Cuota autonomo";
  if (alertType === "cuota_cero") return "Cuota Cero";
  return alertType.replace(/_/g, " ");
}

function deriveLaborPriority(action: LaborMitigationActionRecord, now: Date): GeneralAlertPriority {
  const dueDate = action.sla_due_at ?? action.due_date;
  if (!dueDate) {
    return action.status === "blocked" ? "high" : "medium";
  }

  const days = daysUntil(dueDate, now);
  if (days < 0 || action.status === "blocked") return "critical";
  if (days <= 2) return "high";
  if (days <= 7) return "medium";
  return "low";
}

function buildFiscalCandidates(alerts: FiscalAlertRecord[]): GeneralAlertCandidate[] {
  return alerts
    .filter((alert) => alert.status === "pending")
    .map((alert) => ({
      sourceKey: `fiscal:${alert.id}`,
      source: "fiscal",
      sourceEntityType: "fiscal_alert",
      sourceEntityId: alert.id,
      category: "fiscal",
      title: getFiscalAlertTitle(alert.alert_type),
      message: alert.description ?? "Obligacion fiscal pendiente de seguimiento.",
      priority: (generalAlertPriorityValues.includes(alert.priority as GeneralAlertPriority) ? alert.priority : "medium") as GeneralAlertPriority,
      status: "pending",
      dueDate: alert.due_date,
      linkHref: `/dashboard/fiscal?alertId=${alert.id}`,
      metadata: {
        workflowStatus: alert.workflow_status,
        taxModel: alert.tax_model,
        taxRegime: alert.tax_regime,
        periodKey: alert.period_key,
      },
    }));
}

function buildLaborCandidates(actions: LaborMitigationActionRecord[], now: Date): GeneralAlertCandidate[] {
  return actions
    .filter((action) => (action.status === "pending" || action.status === "in_progress" || action.status === "blocked") && Boolean(action.due_date || action.sla_due_at))
    .map((action) => {
      const dueDate = action.sla_due_at ?? action.due_date;
      const dueLabel = dueDate ? getGeneralAlertDueLabel(dueDate, "es", now) : null;
      return {
        sourceKey: `laboral:${action.id}`,
        source: "laboral",
        sourceEntityType: "labor_mitigation_action",
        sourceEntityId: action.id,
        category: "laboral",
        title: `Accion laboral: ${action.title}`,
        message: [action.description, dueLabel].filter(Boolean).join(" · ") || "Accion laboral pendiente de cierre.",
        priority: deriveLaborPriority(action, now),
        status: "pending",
        dueDate,
        linkHref: `/dashboard/laboral?assessmentId=${action.assessment_id}`,
        metadata: {
          assessmentId: action.assessment_id,
          ownerName: action.owner_name,
          actionStatus: action.status,
        },
      } satisfies GeneralAlertCandidate;
    });
}

function deriveInvoicePriority(invoice: InvoiceRecord, now: Date): GeneralAlertPriority {
  const days = daysUntil(invoice.issue_date, now) * -1;
  if (days >= 45) return "critical";
  if (days >= 30) return "high";
  if (days >= 14) return "medium";
  return "low";
}

function buildInvoiceCandidates(invoices: InvoiceRecord[], now: Date): GeneralAlertCandidate[] {
  return invoices
    .filter((invoice) => invoice.status === "issued" && !invoice.paid_at)
    .map((invoice) => ({
      sourceKey: `facturacion:${invoice.id}`,
      source: "facturacion",
      sourceEntityType: "invoice",
      sourceEntityId: invoice.id,
      category: "facturacion",
      title: `Cobro pendiente: ${invoice.client_name}`,
      message: `Factura emitida el ${invoice.issue_date} por ${invoice.total_amount.toFixed(2)} EUR.`,
      priority: deriveInvoicePriority(invoice, now),
      status: "pending",
      dueDate: invoice.issue_date,
      linkHref: `/dashboard/facturacion?invoiceId=${invoice.id}`,
      metadata: {
        invoiceNumber: invoice.invoice_number,
        series: invoice.series,
        totalAmount: invoice.total_amount,
      },
    } satisfies GeneralAlertCandidate))
    .filter((candidate) => candidate.priority !== "low");
}

export function buildSystemAlertCandidates(input: {
  fiscalAlerts: FiscalAlertRecord[];
  laborActions: LaborMitigationActionRecord[];
  invoices: InvoiceRecord[];
  now?: Date;
}): GeneralAlertCandidate[] {
  const now = input.now ?? new Date();

  return [
    ...buildFiscalCandidates(input.fiscalAlerts),
    ...buildLaborCandidates(input.laborActions, now),
    ...buildInvoiceCandidates(input.invoices, now),
  ];
}
