import { parseInvoiceCalculationQuery } from "@/lib/tools/invoice-calculator";
import {
  deriveRiskLevel,
  type LaborRiskLevel,
} from "@/lib/labor/assessments";
import type {
  FiscalAlertPriority,
  FiscalAlertType,
} from "@/lib/fiscal/alerts";

export type ChatActionKind =
  | "create_fiscal_alert"
  | "create_labor_assessment"
  | "create_invoice_draft";

export interface ChatActionRoutingLike {
  primarySpecialist: string;
  confidence: number;
}

export interface ChatActionAlertLike {
  type: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
}

export interface FiscalAlertActionPayload {
  alertType: FiscalAlertType;
  description: string;
  dueDate: string;
  priority: FiscalAlertPriority;
}

export interface LaborAssessmentActionPayload {
  scenarioDescription: string;
  riskScore: number;
  riskLevel: LaborRiskLevel;
  recommendations: string[];
}

export interface InvoiceDraftActionPayload {
  clientName: string;
  clientNif: string;
  amountBase: number;
  ivaRate: number;
  irpfRetention: number;
  issueDate: string;
  series?: string;
  recipientEmail?: string;
}

export interface ChatSuggestedAction {
  id: string;
  kind: ChatActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  navigationHref: string;
  payload:
    | FiscalAlertActionPayload
    | LaborAssessmentActionPayload
    | InvoiceDraftActionPayload;
}

export interface BuildChatSuggestedActionsInput {
  query: string;
  response: string;
  routing: ChatActionRoutingLike | null;
  alerts: ChatActionAlertLike[];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
}

function summarizeText(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function inferFiscalAlertType(query: string): FiscalAlertType {
  const normalized = query.toLowerCase();
  if (normalized.includes("cuota cero")) return "cuota_cero";
  if (normalized.includes("iva") || normalized.includes("modelo 303")) return "iva";
  if (normalized.includes("irpf") || normalized.includes("modelo 130")) return "irpf";
  if (normalized.includes("retencion") || normalized.includes("retención")) return "retenciones";
  if (normalized.includes("reta") || normalized.includes("autonom")) return "autonomo";
  return "recordatorio";
}

function inferFiscalPriority(
  query: string,
  alerts: ChatActionAlertLike[],
): FiscalAlertPriority {
  const normalized = query.toLowerCase();
  if (
    alerts.some((alert) => alert.type === "CRITICAL") ||
    /urgente|hoy|vence|vencimiento|inspeccion|inspección/.test(normalized)
  ) {
    return "critical";
  }
  if (
    alerts.some((alert) => alert.type === "HIGH") ||
    /plazo|presentar|modelo|declaracion|declaración|retencion|retención/.test(
      normalized,
    )
  ) {
    return "high";
  }
  if (/cuota cero|iva|irpf|autonom/.test(normalized)) {
    return "medium";
  }
  return "low";
}

function shouldSuggestFiscalAlert(query: string, primarySpecialist: string): boolean {
  if (primarySpecialist !== "fiscal") {
    return false;
  }
  return /cuota cero|iva|irpf|reta|modelo|plazo|venc|present|deduc|record/.test(
    query.toLowerCase(),
  );
}

function buildFiscalAlertAction(
  query: string,
  alerts: ChatActionAlertLike[],
): ChatSuggestedAction {
  const alertType = inferFiscalAlertType(query);
  const priority = inferFiscalPriority(query, alerts);
  return {
    id: "create_fiscal_alert",
    kind: "create_fiscal_alert",
    title: "Crear alerta fiscal",
    description:
      "Guarda esta consulta como alerta operativa para revisarla desde el modulo fiscal.",
    ctaLabel: "Crear alerta",
    navigationHref: "/dashboard/fiscal",
    payload: {
      alertType,
      description: summarizeText(`Seguimiento desde chat: ${query}`, 240),
      dueDate: addDays(priority === "critical" ? 1 : priority === "high" ? 3 : 7),
      priority,
    },
  };
}

function inferLaborRiskScore(
  query: string,
  response: string,
  alerts: ChatActionAlertLike[],
): number {
  const normalized = `${query} ${response}`.toLowerCase();
  let score = 0.42;

  if (/pluriactividad|compatib|conflicto|exclusividad/.test(normalized)) {
    score = Math.max(score, 0.68);
  }
  if (/despido|sancion|sanción|incumplimiento|vulnerab|reputacional/.test(normalized)) {
    score = Math.max(score, 0.78);
  }
  if (alerts.some((alert) => alert.type === "CRITICAL" || alert.type === "HIGH")) {
    score = Math.max(score, 0.85);
  }

  return Math.round(score * 100) / 100;
}

function shouldSuggestLaborAssessment(
  query: string,
  primarySpecialist: string,
): boolean {
  if (primarySpecialist !== "labor") {
    return false;
  }
  return /pluriactividad|contrato|laboral|riesgo|compatib|despido|exclusividad/.test(
    query.toLowerCase(),
  );
}

function buildLaborAssessmentAction(
  query: string,
  response: string,
  alerts: ChatActionAlertLike[],
): ChatSuggestedAction {
  const riskScore = inferLaborRiskScore(query, response, alerts);
  const riskLevel = deriveRiskLevel(riskScore);

  return {
    id: "create_labor_assessment",
    kind: "create_labor_assessment",
    title: "Crear evaluacion laboral",
    description:
      "Convierte esta consulta en una evaluacion de riesgo y sigue las mitigaciones desde el modulo laboral.",
    ctaLabel: "Crear evaluacion",
    navigationHref: "/dashboard/laboral",
    payload: {
      scenarioDescription: summarizeText(`Consulta de chat: ${query}`, 400),
      riskScore,
      riskLevel,
      recommendations: [
        "Validar el escenario con un asesor laboral.",
        "Registrar medidas de mitigacion y seguimiento.",
      ],
    },
  };
}

function buildInvoiceDraftAction(query: string): ChatSuggestedAction | null {
  const parsed = parseInvoiceCalculationQuery(query);
  if (!parsed.matched) {
    return null;
  }

  return {
    id: "create_invoice_draft",
    kind: "create_invoice_draft",
    title: "Crear borrador de factura",
    description:
      "Genera un borrador en facturacion con los importes detectados para completarlo despues.",
    ctaLabel: "Crear borrador",
    navigationHref: "/dashboard/facturacion",
    payload: {
      clientName: "Cliente pendiente",
      clientNif: "PENDIENTE",
      amountBase: parsed.amountBase,
      ivaRate: parsed.ivaRate,
      irpfRetention: parsed.irpfRetention,
      issueDate: toIsoDate(new Date()),
    },
  };
}

export function buildSuggestedChatActions(
  input: BuildChatSuggestedActionsInput,
): ChatSuggestedAction[] {
  const primarySpecialist = input.routing?.primarySpecialist ?? "";
  const actions: ChatSuggestedAction[] = [];
  const invoiceDraftAction = buildInvoiceDraftAction(input.query);

  if (invoiceDraftAction) {
    actions.push(invoiceDraftAction);
  }

  if (shouldSuggestFiscalAlert(input.query, primarySpecialist)) {
    actions.push(buildFiscalAlertAction(input.query, input.alerts));
  }

  if (shouldSuggestLaborAssessment(input.query, primarySpecialist)) {
    actions.push(buildLaborAssessmentAction(input.query, input.response, input.alerts));
  }

  return actions.slice(0, 2);
}
