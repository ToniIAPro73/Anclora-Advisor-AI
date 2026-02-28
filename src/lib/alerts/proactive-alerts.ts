type FiscalAlertRecord = {
  id: string;
  alert_type: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
};

export interface ProactiveAlertCard {
  id: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  dueLabel: string;
  status: string;
}

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

function formatDueLabel(days: number): string {
  if (days < 0) return `Vencida hace ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence manana";
  return `Vence en ${days} dia(s)`;
}

function deriveSeverity(alert: FiscalAlertRecord, days: number): ProactiveAlertCard["severity"] {
  if (alert.priority === "critical" || days < 0) return "critical";
  if (alert.priority === "high" || days <= 7) return "high";
  if (alert.priority === "medium" || days <= 15) return "medium";
  return "low";
}

function getAlertTitle(alertType: string): string {
  if (alertType === "iva") return "Modelo 303 (IVA)";
  if (alertType === "irpf") return "Modelo 130 (IRPF)";
  if (alertType === "cuota_cero") return "Cuota Cero";
  return alertType.replace(/_/g, " ");
}

export function buildProactiveFiscalAlerts(
  alerts: FiscalAlertRecord[],
  now = new Date()
): ProactiveAlertCard[] {
  return alerts
    .filter((alert) => alert.status === "pending")
    .map((alert) => {
      const days = daysUntil(alert.due_date, now);
      return {
        id: alert.id,
        title: getAlertTitle(alert.alert_type),
        detail: alert.description || "Revisa esta obligacion y confirma su estado.",
        severity: deriveSeverity(alert, days),
        dueLabel: formatDueLabel(days),
        status: alert.status,
      } satisfies ProactiveAlertCard;
    })
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 4);
}
