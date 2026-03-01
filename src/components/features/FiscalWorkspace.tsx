"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditTimeline } from "@/components/features/AuditTimeline";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import { buildProactiveFiscalAlerts } from "@/lib/alerts/proactive-alerts";
import type { AuditLogRecord } from "@/lib/audit/logs";
import {
  fiscalAlertPriorityValues,
  fiscalAlertStatusValues,
  fiscalTaxModelValues,
  fiscalTaxRegimeValues,
  fiscalAlertTypeValues,
  fiscalAlertWorkflowStatusValues,
  getDefaultFiscalModel,
  getDefaultFiscalRegime,
  sortFiscalAlerts,
  type FiscalAlertPriority,
  type FiscalAlertRecord,
  type FiscalAlertStatus,
  type FiscalTaxModel,
  type FiscalTaxRegime,
  type FiscalAlertType,
  type FiscalAlertWorkflowStatus,
  getFiscalTaxModelLabel,
  getFiscalTaxRegimeLabel,
} from "@/lib/fiscal/alerts";
import {
  getFiscalTemplateLabel,
  type FiscalAlertTemplateRecord,
  type FiscalTemplateRecurrence,
} from "@/lib/fiscal/templates";

interface FiscalWorkspaceProps {
  initialAlerts: FiscalAlertRecord[];
  initialTemplates: FiscalAlertTemplateRecord[];
  initialAuditLogs: AuditLogRecord[];
  initialSearchQuery?: string;
  initialSelectedAlertId?: string | null;
}

type FilterStatus = "all" | FiscalAlertStatus;

type FiscalFormState = {
  alertType: FiscalAlertType;
  description: string;
  dueDate: string;
  priority: FiscalAlertPriority;
  workflowStatus: FiscalAlertWorkflowStatus;
  taxRegime: FiscalTaxRegime;
  taxModel: FiscalTaxModel;
};

type TemplateFormState = {
  alertType: FiscalAlertType;
  description: string;
  priority: FiscalAlertPriority;
  recurrence: FiscalTemplateRecurrence;
  dueDay: string;
  dueMonth: string;
  startDate: string;
  isActive: boolean;
  taxRegime: FiscalTaxRegime;
  taxModel: FiscalTaxModel;
};

type OperationJobRecord = {
  id: string;
  job_kind: string;
  status: string;
  created_at: string;
  error_message: string | null;
};

const TODAY = new Date().toISOString().slice(0, 10);

const INITIAL_ALERT_FORM: FiscalFormState = {
  alertType: "iva",
  description: "",
  dueDate: TODAY,
  priority: "medium",
  workflowStatus: "pending",
  taxRegime: "general",
  taxModel: "303",
};

const INITIAL_TEMPLATE_FORM: TemplateFormState = {
  alertType: "iva",
  description: "",
  priority: "medium",
  recurrence: "quarterly",
  dueDay: "20",
  dueMonth: "1",
  startDate: TODAY,
  isActive: true,
  taxRegime: "general",
  taxModel: "303",
};

function formatDate(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getPriorityClass(priority: string): string {
  if (priority === "critical") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "high") return "bg-orange-100 text-orange-700 border-orange-200";
  if (priority === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getStatusClass(status: string): string {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "ignored") return "bg-slate-200 text-slate-700 border-slate-300";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

function getWorkflowClass(status: string): string {
  if (status === "closed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "presented") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "prepared") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getAlertLabel(alertType: string, locale: "es" | "en"): string {
  if (alertType === "cuota_cero") return locale === "en" ? "Zero-fee aid" : "Cuota Cero";
  if (alertType === "iva") return locale === "en" ? "Form 303 (VAT)" : "Modelo 303 (IVA)";
  if (alertType === "irpf") return locale === "en" ? "Form 130 (Income tax)" : "Modelo 130 (IRPF)";
  if (alertType === "retenciones") return locale === "en" ? "Withholdings" : "Retenciones";
  if (alertType === "autonomo") return locale === "en" ? "Self-employed" : "Autonomo";
  if (alertType === "recordatorio") return locale === "en" ? "Reminder" : "Recordatorio";
  return alertType.replace(/_/g, " ");
}

function getCompactFiscalTaxRegimeLabel(regime: FiscalTaxRegime, locale: "es" | "en"): string {
  if (regime === "estimacion_directa") return locale === "en" ? "Direct est." : "Estim. directa";
  if (regime === "pluriactividad") return locale === "en" ? "Multi-act." : "Pluriact.";
  if (regime === "cuota_cero_baleares") return locale === "en" ? "Zero-fee BAL" : "C. Cero BAL";
  if (regime === "custom") return locale === "en" ? "Custom" : "Personal.";
  return "General";
}

function getCompactFiscalTaxModelLabel(model: FiscalTaxModel, locale: "es" | "en"): string {
  if (model === "303") return locale === "en" ? "303 VAT" : "303 IVA";
  if (model === "130") return locale === "en" ? "130 PIT" : "130 IRPF";
  if (model === "111") return locale === "en" ? "111 Withh." : "111 Ret.";
  if (model === "reta") return "RETA";
  if (model === "cuota_cero") return locale === "en" ? "Zero-fee" : "C. Cero";
  return locale === "en" ? "Custom" : "Personal.";
}

function toAlertForm(alert: FiscalAlertRecord): FiscalFormState {
  return {
    alertType: alert.alert_type as FiscalAlertType,
    description: alert.description ?? "",
    dueDate: alert.due_date,
    priority: alert.priority as FiscalAlertPriority,
    workflowStatus: (alert.workflow_status as FiscalAlertWorkflowStatus) ?? "pending",
    taxRegime: (alert.tax_regime as FiscalTaxRegime) ?? getDefaultFiscalRegime(alert.alert_type as FiscalAlertType),
    taxModel: (alert.tax_model as FiscalTaxModel) ?? getDefaultFiscalModel(alert.alert_type as FiscalAlertType),
  };
}

function getFiscalPeriodLabel(alert: FiscalAlertRecord, locale: "es" | "en"): string {
  if (alert.period_key) {
    return locale === "en" ? alert.period_key : alert.period_key.replace("Q", "T");
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", { month: "short", year: "numeric" }).format(new Date(alert.due_date));
}

function getPriorityLabel(priority: FiscalAlertPriority | string, locale: "es" | "en"): string {
  if (priority === "critical") return locale === "en" ? "Critical" : "Critica";
  if (priority === "high") return locale === "en" ? "High" : "Alta";
  if (priority === "medium") return locale === "en" ? "Medium" : "Media";
  return locale === "en" ? "Low" : "Baja";
}

function getStatusLabel(status: FiscalAlertStatus | string, locale: "es" | "en"): string {
  if (status === "resolved") return locale === "en" ? "Resolved" : "Resuelta";
  if (status === "ignored") return locale === "en" ? "Ignored" : "Ignorada";
  return locale === "en" ? "Pending" : "Pendiente";
}

function getWorkflowLabel(status: FiscalAlertWorkflowStatus | string, locale: "es" | "en"): string {
  if (status === "closed") return locale === "en" ? "Closed" : "Cerrado";
  if (status === "presented") return locale === "en" ? "Filed" : "Presentado";
  if (status === "prepared") return locale === "en" ? "Prepared" : "Preparado";
  return locale === "en" ? "Pending" : "Pendiente";
}

function getRecurrenceLabel(recurrence: FiscalTemplateRecurrence, locale: "es" | "en"): string {
  if (recurrence === "monthly") return locale === "en" ? "Monthly" : "Mensual";
  if (recurrence === "quarterly") return locale === "en" ? "Quarterly" : "Trimestral";
  return locale === "en" ? "Annual" : "Anual";
}

function getTemplateStateLabel(isActive: boolean, locale: "es" | "en"): string {
  return isActive ? (locale === "en" ? "active" : "activa") : (locale === "en" ? "inactive" : "inactiva");
}

function toTemplateForm(template: FiscalAlertTemplateRecord): TemplateFormState {
  return {
    alertType: template.alert_type as FiscalAlertType,
    description: template.description ?? "",
    priority: template.priority as FiscalAlertPriority,
    recurrence: template.recurrence as FiscalTemplateRecurrence,
    dueDay: String(template.due_day),
    dueMonth: String(template.due_month ?? 1),
    startDate: template.start_date,
    isActive: template.is_active,
    taxRegime: (template.tax_regime as FiscalTaxRegime) ?? getDefaultFiscalRegime(template.alert_type as FiscalAlertType),
    taxModel: (template.tax_model as FiscalTaxModel) ?? getDefaultFiscalModel(template.alert_type as FiscalAlertType),
  };
}

export function FiscalWorkspace({
  initialAlerts,
  initialTemplates,
  initialAuditLogs,
  initialSearchQuery = "",
  initialSelectedAlertId = null,
}: FiscalWorkspaceProps) {
  const { locale } = useAppPreferences();
  const isEn = locale === "en";
  const [alerts, setAlerts] = useState(sortFiscalAlerts(initialAlerts));
  const [templates, setTemplates] = useState(initialTemplates);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [alertForm, setAlertForm] = useState(INITIAL_ALERT_FORM);
  const [templateForm, setTemplateForm] = useState(INITIAL_TEMPLATE_FORM);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [submitting, setSubmitting] = useState(false);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [generatingTemplates, setGeneratingTemplates] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<OperationJobRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const filteredAlerts = useMemo(
    () => {
      const scopedAlerts = filterStatus === "all" ? alerts : alerts.filter((alert) => alert.status === filterStatus);
      const needle = searchQuery.trim().toLowerCase();
      if (!needle) {
        return scopedAlerts;
      }
      return scopedAlerts.filter((alert) => {
        const haystack = [
          alert.alert_type,
          alert.description ?? "",
          alert.period_key ?? "",
          alert.source,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    },
    [alerts, filterStatus, searchQuery]
  );
  const proactiveAlerts = useMemo(() => buildProactiveFiscalAlerts(alerts), [alerts]);
  const fiscalJobs = useMemo(() => jobs.filter((job) => job.job_kind === "fiscal_template_generation"), [jobs]);
  const workflowCounts = useMemo(() => ({
    pending: alerts.filter((alert) => alert.workflow_status === "pending").length,
    prepared: alerts.filter((alert) => alert.workflow_status === "prepared").length,
    presented: alerts.filter((alert) => alert.workflow_status === "presented").length,
    closed: alerts.filter((alert) => alert.workflow_status === "closed").length,
  }), [alerts]);
  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const alert of alerts) {
      const key = getFiscalTaxModelLabel(alert.tax_model);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [alerts]);
  const calendarGroups = useMemo(() => {
    const groups = new Map<string, FiscalAlertRecord[]>();
    for (const alert of filteredAlerts) {
      const key = getFiscalPeriodLabel(alert, locale);
      const current = groups.get(key) ?? [];
      current.push(alert);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).map(([period, items]) => ({
      period,
      items: sortFiscalAlerts(items),
    }));
  }, [filteredAlerts]);

  async function refreshAuditLogs() {
    try {
      const response = await fetch("/api/audit-logs?domain=fiscal&limit=8", { cache: "no-store" });
      const result = (await response.json()) as { success: boolean; logs?: AuditLogRecord[] };
      if (response.ok && result.success && result.logs) {
        setAuditLogs(result.logs);
      }
    } catch {
      // Ignore audit refresh errors in UI.
    }
  }

  async function refreshJobs() {
    const response = await fetch("/api/operations/jobs", { cache: "no-store" });
    const result = (await response.json()) as { success: boolean; error?: string; jobs?: OperationJobRecord[] };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "No se pudieron cargar jobs operativos");
    }
    setJobs(result.jobs ?? []);
  }

  useEffect(() => {
    void refreshJobs().catch((jobError) => setError(jobError instanceof Error ? jobError.message : "Error al cargar jobs"));
  }, []);

  async function saveAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const isEditing = Boolean(editingAlertId);
      const response = await fetch(isEditing ? `/api/fiscal-alerts/${editingAlertId}` : "/api/fiscal-alerts", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertForm),
      });
      const result = (await response.json()) as { success: boolean; error?: string; alert?: FiscalAlertRecord };
      if (!response.ok || !result.success || !result.alert) {
        throw new Error(result.error ?? "No se pudo guardar la alerta fiscal");
      }
      setAlerts((current) =>
        sortFiscalAlerts(
          isEditing
            ? current.map((item) => (item.id === result.alert!.id ? result.alert! : item))
            : [result.alert!, ...current]
        )
      );
      setAlertForm(INITIAL_ALERT_FORM);
      setEditingAlertId(null);
      setOkMessage(isEditing ? "Alerta fiscal actualizada." : "Alerta fiscal creada.");
      await refreshAuditLogs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar alerta fiscal");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemplateSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const isEditing = Boolean(editingTemplateId);
      const response = await fetch(isEditing ? `/api/fiscal-templates/${editingTemplateId}` : "/api/fiscal-templates", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertType: templateForm.alertType,
          description: templateForm.description,
          priority: templateForm.priority,
          recurrence: templateForm.recurrence,
          dueDay: Number.parseInt(templateForm.dueDay, 10),
          dueMonth: templateForm.recurrence === "annual" ? Number.parseInt(templateForm.dueMonth, 10) : null,
          startDate: templateForm.startDate,
          isActive: templateForm.isActive,
          taxRegime: templateForm.taxRegime,
          taxModel: templateForm.taxModel,
        }),
      });
      const result = (await response.json()) as { success: boolean; error?: string; template?: FiscalAlertTemplateRecord };
      if (!response.ok || !result.success || !result.template) {
        throw new Error(result.error ?? "No se pudo guardar la plantilla fiscal");
      }
      setTemplates((current) =>
        [result.template!, ...current.filter((item) => item.id !== result.template!.id)].sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        )
      );
      setTemplateForm(INITIAL_TEMPLATE_FORM);
      setEditingTemplateId(null);
      setOkMessage(isEditing ? "Plantilla fiscal actualizada." : "Plantilla fiscal creada.");
      await refreshAuditLogs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar plantilla fiscal");
    } finally {
      setTemplateSubmitting(false);
    }
  }

  async function updateAlertStatus(alertId: string, status: FiscalAlertStatus) {
    setUpdatingAlertId(alertId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/fiscal-alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { success: boolean; error?: string; alert?: FiscalAlertRecord };
      if (!response.ok || !result.success || !result.alert) {
        throw new Error(result.error ?? "No se pudo actualizar la alerta");
      }
      setAlerts((current) => sortFiscalAlerts(current.map((item) => (item.id === result.alert!.id ? result.alert! : item))));
      setOkMessage(`Alerta marcada como ${status}.`);
      await refreshAuditLogs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar alerta");
    } finally {
      setUpdatingAlertId(null);
    }
  }

  async function updateAlertWorkflowStatus(alertId: string, workflowStatus: FiscalAlertWorkflowStatus) {
    setUpdatingAlertId(alertId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/fiscal-alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus }),
      });
      const result = (await response.json()) as { success: boolean; error?: string; alert?: FiscalAlertRecord };
      if (!response.ok || !result.success || !result.alert) {
        throw new Error(result.error ?? "No se pudo actualizar el tramite");
      }
      setAlerts((current) => sortFiscalAlerts(current.map((item) => (item.id === result.alert!.id ? result.alert! : item))));
      setOkMessage(`Tramite marcado como ${workflowStatus}.`);
      await refreshAuditLogs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar tramite fiscal");
    } finally {
      setUpdatingAlertId(null);
    }
  }

  async function deleteResource(url: string, onSuccess: () => void, successMessage: string) {
    const response = await fetch(url, { method: "DELETE" });
    const result = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "No se pudo eliminar el recurso");
    }
    onSuccess();
    setOkMessage(successMessage);
    await refreshAuditLogs();
  }

  async function enqueueTemplates() {
    setGeneratingTemplates(true);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch("/api/fiscal-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonMonths: 6 }),
      });
      const result = (await response.json()) as { success: boolean; error?: string; jobId?: string };
      if (!response.ok || !result.success || !result.jobId) {
        throw new Error(result.error ?? "No se pudo encolar la generacion");
      }
      await refreshJobs();
      setOkMessage(`Generacion recurrente encolada. Job ${result.jobId}.`);
      await refreshAuditLogs();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Error al encolar generacion");
    } finally {
      setGeneratingTemplates(false);
    }
  }

  async function processQueue() {
    setProcessingQueue(true);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch("/api/operations/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        result?: { claimed: number; completed: number; failed: number };
      };
      if (!response.ok || !result.success || !result.result) {
        throw new Error(result.error ?? "No se pudo procesar la cola");
      }
      await refreshJobs();
      setOkMessage(`Cola procesada: ${result.result.completed} completado(s), ${result.result.failed} fallido(s).`);
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Error al procesar cola");
    } finally {
      setProcessingQueue(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pr-1 lg:col-span-2">
        <article className="advisor-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {isEn ? (editingTemplateId ? "Edit template" : "Recurring template") : (editingTemplateId ? "Editar plantilla" : "Plantilla recurrente")}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Automate future tax obligations through the operational queue." : "Automatiza obligaciones fiscales futuras por cola operativa."}</p>
            </div>
            {editingTemplateId && (
              <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setTemplateForm(INITIAL_TEMPLATE_FORM); setEditingTemplateId(null); }}>
                {isEn ? "Cancel" : "Cancelar"}
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={saveTemplate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="advisor-input"
                value={templateForm.alertType}
                onChange={(event) =>
                  setTemplateForm((current) => {
                    const alertType = event.target.value as FiscalAlertType;
                    return {
                      ...current,
                      alertType,
                      taxRegime: getDefaultFiscalRegime(alertType),
                      taxModel: getDefaultFiscalModel(alertType),
                    };
                  })
                }
              >
                {fiscalAlertTypeValues.map((type) => <option key={type} value={type}>{getAlertLabel(type, locale)}</option>)}
              </select>
              <select className="advisor-input" value={templateForm.priority} onChange={(event) => setTemplateForm((current) => ({ ...current, priority: event.target.value as FiscalAlertPriority }))}>
                {fiscalAlertPriorityValues.map((priority) => <option key={priority} value={priority}>{getPriorityLabel(priority, locale)}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="advisor-input" value={templateForm.taxRegime} onChange={(event) => setTemplateForm((current) => ({ ...current, taxRegime: event.target.value as FiscalTaxRegime }))}>
                {fiscalTaxRegimeValues.map((regime) => <option key={regime} value={regime}>{getCompactFiscalTaxRegimeLabel(regime, locale)}</option>)}
              </select>
              <select className="advisor-input" value={templateForm.taxModel} onChange={(event) => setTemplateForm((current) => ({ ...current, taxModel: event.target.value as FiscalTaxModel }))}>
                {fiscalTaxModelValues.map((model) => <option key={model} value={model}>{getCompactFiscalTaxModelLabel(model, locale)}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="advisor-input" value={templateForm.recurrence} onChange={(event) => setTemplateForm((current) => ({ ...current, recurrence: event.target.value as FiscalTemplateRecurrence }))}>
                <option value="monthly">{getRecurrenceLabel("monthly", locale)}</option>
                <option value="quarterly">{getRecurrenceLabel("quarterly", locale)}</option>
                <option value="annual">{getRecurrenceLabel("annual", locale)}</option>
              </select>
              <input type="date" className="advisor-input" value={templateForm.startDate} onChange={(event) => setTemplateForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="number" min="1" max="28" className="advisor-input" value={templateForm.dueDay} onChange={(event) => setTemplateForm((current) => ({ ...current, dueDay: event.target.value }))} required />
              <input type="number" min="1" max="12" className="advisor-input" value={templateForm.dueMonth} onChange={(event) => setTemplateForm((current) => ({ ...current, dueMonth: event.target.value }))} disabled={templateForm.recurrence !== "annual"} />
            </div>
            <textarea className="advisor-input min-h-24 resize-y" value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} placeholder={isEn ? "Base obligation description" : "Descripcion base de la obligacion"} />
            <label className="flex items-center gap-2 text-sm text-[#162944]">
              <input type="checkbox" checked={templateForm.isActive} onChange={(event) => setTemplateForm((current) => ({ ...current, isActive: event.target.checked }))} />
              {isEn ? "active template" : "plantilla activa"}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="submit" disabled={templateSubmitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
                {templateSubmitting ? (isEn ? "Saving..." : "Guardando...") : editingTemplateId ? (isEn ? "Update template" : "Actualizar plantilla") : (isEn ? "Create template" : "Crear plantilla")}
              </button>
              <button type="button" disabled={generatingTemplates || templates.length === 0} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void enqueueTemplates()}>
                {generatingTemplates ? (isEn ? "Queueing..." : "Encolando...") : (isEn ? "Generate recurring" : "Generar recurrentes")}
              </button>
            </div>
          </form>
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Tax jobs" : "Jobs fiscales"}</p>
                <p className="mt-1 break-words text-sm text-[#162944]">{fiscalJobs.length} {isEn ? "automation record(s)" : "registro(s) de automatizacion"}</p>
              </div>
              <button type="button" disabled={processingQueue} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void processQueue()}>
                {processingQueue ? (isEn ? "Processing..." : "Procesando...") : (isEn ? "Process queue" : "Procesar cola")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {fiscalJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  <p className="break-words"><strong>{job.job_kind}</strong> · <span className={`rounded-full border px-2 py-0.5 ${getStatusClass(job.status === "completed" ? "resolved" : job.status === "failed" ? "ignored" : "pending")}`}>{job.status === "completed" ? getStatusLabel("resolved", locale) : job.status === "failed" ? getStatusLabel("ignored", locale) : getStatusLabel("pending", locale)}</span></p>
                  <p className="mt-1">{formatDate(job.created_at, locale)}</p>
                  {job.error_message && <p className="mt-1 text-red-700">{job.error_message}</p>}
                </div>
              ))}
              {fiscalJobs.length === 0 && <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">{isEn ? "No automation jobs yet." : "Sin jobs de automatizacion."}</div>}
            </div>
          </div>
        </article>

        <article className="advisor-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">{isEn ? (editingAlertId ? "Edit alert" : "New alert") : (editingAlertId ? "Editar alerta" : "Nueva alerta")}</h2>
              <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Create and manage tax alerts manually." : "Alta y gestion manual de alertas fiscales."}</p>
            </div>
            {editingAlertId && <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setAlertForm(INITIAL_ALERT_FORM); setEditingAlertId(null); }}>{isEn ? "Cancel" : "Cancelar"}</button>}
          </div>
          <form className="mt-4 space-y-3" onSubmit={saveAlert}>
            <select
              className="advisor-input"
              value={alertForm.alertType}
              onChange={(event) =>
                setAlertForm((current) => {
                  const alertType = event.target.value as FiscalAlertType;
                  return {
                    ...current,
                    alertType,
                    taxRegime: getDefaultFiscalRegime(alertType),
                    taxModel: getDefaultFiscalModel(alertType),
                  };
                })
              }
            >
                {fiscalAlertTypeValues.map((type) => <option key={type} value={type}>{getAlertLabel(type, locale)}</option>)}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="date" className="advisor-input" value={alertForm.dueDate} onChange={(event) => setAlertForm((current) => ({ ...current, dueDate: event.target.value }))} required />
              <select className="advisor-input" value={alertForm.priority} onChange={(event) => setAlertForm((current) => ({ ...current, priority: event.target.value as FiscalAlertPriority }))}>
                {fiscalAlertPriorityValues.map((priority) => <option key={priority} value={priority}>{getPriorityLabel(priority, locale)}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="advisor-input" value={alertForm.taxRegime} onChange={(event) => setAlertForm((current) => ({ ...current, taxRegime: event.target.value as FiscalTaxRegime }))}>
                {fiscalTaxRegimeValues.map((regime) => <option key={regime} value={regime}>{getCompactFiscalTaxRegimeLabel(regime, locale)}</option>)}
              </select>
              <select className="advisor-input" value={alertForm.taxModel} onChange={(event) => setAlertForm((current) => ({ ...current, taxModel: event.target.value as FiscalTaxModel }))}>
                {fiscalTaxModelValues.map((model) => <option key={model} value={model}>{getCompactFiscalTaxModelLabel(model, locale)}</option>)}
              </select>
            </div>
            <select className="advisor-input" value={alertForm.workflowStatus} onChange={(event) => setAlertForm((current) => ({ ...current, workflowStatus: event.target.value as FiscalAlertWorkflowStatus }))}>
              {fiscalAlertWorkflowStatusValues.map((workflowStatus) => <option key={workflowStatus} value={workflowStatus}>{getWorkflowLabel(workflowStatus, locale)}</option>)}
            </select>
            <textarea className="advisor-input min-h-28 resize-y" value={alertForm.description} onChange={(event) => setAlertForm((current) => ({ ...current, description: event.target.value }))} placeholder={isEn ? "Operational description" : "Descripcion operativa"} />
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? (isEn ? "Saving..." : "Guardando...") : editingAlertId ? (isEn ? "Update alert" : "Actualizar alerta") : (isEn ? "Create alert" : "Crear alerta")}
            </button>
          </form>
        </article>

        <AuditTimeline title={isEn ? "Tax audit" : "Auditoria fiscal"} logs={auditLogs} />
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="space-y-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">{isEn ? "Tax operations" : "Operacion fiscal"}</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">{filteredAlerts.length} {isEn ? "alert(s)" : "alerta(s)"}, {templates.length} {isEn ? "template(s)" : "plantilla(s)"}, {proactiveAlerts.length} {isEn ? "proactive alert(s)" : "alerta(s) proactiva(s)"}.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:max-w-[36rem]">
              <input
                className="advisor-input min-w-0 w-full"
                placeholder={isEn ? "Search alert" : "Buscar alerta"}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <select className="advisor-input min-w-0 w-full" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}>
                <option value="all">{isEn ? "All" : "Todos"}</option>
                {fiscalAlertStatusValues.map((status) => <option key={status} value={status}>{getStatusLabel(status, locale)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div className="advisor-card-muted p-3">
              <p className="text-sm font-semibold text-[#162944]">{isEn ? "Calendar and filing" : "Calendario y tramite"}</p>
              <div className="mt-2 grid gap-2 text-sm text-[#3a4f67] sm:grid-cols-4">
                <p>Pendiente: <strong className="text-[#162944]">{workflowCounts.pending}</strong></p>
                <p>Preparado: <strong className="text-[#162944]">{workflowCounts.prepared}</strong></p>
                <p>Presentado: <strong className="text-[#162944]">{workflowCounts.presented}</strong></p>
                <p>Cerrado: <strong className="text-[#162944]">{workflowCounts.closed}</strong></p>
              </div>
              <div className="mt-3 space-y-2">
                {calendarGroups.length === 0 && <div className="rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#3a4f67]">{isEn ? "No obligations in the current calendar." : "Sin obligaciones en el calendario actual."}</div>}
                {calendarGroups.map((group) => (
                  <div key={group.period} className="rounded-xl border border-[#d2dceb] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#162944]">{group.period}</p>
                      <span className="text-xs text-[#3a4f67]">{group.items.length} {isEn ? "obligation(s)" : "obligacion(es)"}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {group.items.map((alert) => (
                        <div key={`${group.period}_${alert.id}`} className="rounded-lg border border-[#e2e8f3] bg-[#f8fbff] p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#162944]">{getAlertLabel(alert.alert_type, locale)}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getWorkflowClass(alert.workflow_status)}`}>{getWorkflowLabel(alert.workflow_status, locale)}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityClass(alert.priority)}`}>{getPriorityLabel(alert.priority, locale)}</span>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-[#3a4f67]">{isEn ? "Due" : "Vence"} {formatDate(alert.due_date, locale)}{alert.presented_at ? `${isEn ? " · filed " : " · presentado "}${formatDate(alert.presented_at, locale)}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="advisor-card-muted p-3">
              <p className="text-sm font-semibold text-[#162944]">{isEn ? "Tracked forms" : "Modelos en seguimiento"}</p>
              <div className="mt-2 grid gap-2 text-sm text-[#3a4f67] sm:grid-cols-3">
                {modelCounts.length === 0 && <p>{isEn ? "No active forms." : "Sin modelos activos."}</p>}
                {modelCounts.map(([label, count]) => (
                  <p key={label}>{label}: <strong className="text-[#162944]">{count}</strong></p>
                ))}
              </div>
            </div>

            <div className="advisor-card-muted p-3">
              <p className="text-sm font-semibold text-[#162944]">{isEn ? "Active templates" : "Plantillas activas"}</p>
              <div className="mt-2 space-y-2">
                {templates.length === 0 && <div className="rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#3a4f67]">{isEn ? "No templates configured." : "No hay plantillas configuradas."}</div>}
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-[#d2dceb] bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="break-words text-sm font-semibold text-[#162944]">{getFiscalTemplateLabel(template)}</p>
                        <p className="mt-1 break-words text-xs text-[#3a4f67]">{template.description || (isEn ? "No base description." : "Sin descripcion base.")}</p>
                      </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(template.priority)}`}>{getPriorityLabel(template.priority, locale)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${template.is_active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>{getTemplateStateLabel(template.is_active, locale)}</span>
                      <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{getFiscalTaxRegimeLabel(template.tax_regime)}</span>
                      <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{getFiscalTaxModelLabel(template.tax_model)}</span>
                    </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setTemplateForm(toTemplateForm(template)); setEditingTemplateId(template.id); }}>
                        {isEn ? "Edit" : "Editar"}
                      </button>
                      <button type="button" className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void deleteResource(`/api/fiscal-templates/${template.id}`, () => setTemplates((current) => current.filter((item) => item.id !== template.id)), "Plantilla fiscal eliminada.").catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar plantilla"))}>
                        {isEn ? "Delete" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {proactiveAlerts.length > 0 && (
              <div className="advisor-card-muted p-3">
                <p className="text-sm font-semibold text-[#162944]">{isEn ? "Proactive alerts" : "Alertas proactivas"}</p>
                <div className="mt-2 space-y-2">
                  {proactiveAlerts.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#d2dceb] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="break-words text-sm font-semibold text-[#162944]">{item.title}</p>
                          <p className="mt-1 break-words text-sm text-[#3a4f67]">{item.detail}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(item.severity)}`}>{getPriorityLabel(item.severity, locale)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredAlerts.length === 0 && <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">{isEn ? "No alerts for the selected filter." : "No hay alertas para el filtro seleccionado."}</div>}
              {filteredAlerts.map((alert) => {
                const isBusy = updatingAlertId === alert.id;
                const isSelected = initialSelectedAlertId === alert.id;
                return (
                <div key={alert.id} className={`advisor-card-muted p-4 ${isSelected ? "ring-2 ring-[#1dab89] ring-offset-2 ring-offset-white" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="break-words text-sm font-semibold text-[#162944]">{getAlertLabel(alert.alert_type, locale)}</p>
                      <p className="mt-1 break-words text-sm text-[#3a4f67]">{alert.description || (isEn ? "No operational description." : "Sin descripcion operativa.")}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#1c2b3c]">{formatDate(alert.due_date, locale)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(alert.priority)}`}>{isEn ? "priority" : "prioridad"}: {getPriorityLabel(alert.priority, locale)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(alert.status)}`}>{isEn ? "status" : "estado"}: {getStatusLabel(alert.status, locale)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getWorkflowClass(alert.workflow_status)}`}>{isEn ? "filing" : "tramite"}: {getWorkflowLabel(alert.workflow_status, locale)}</span>
                    <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{isEn ? "period" : "periodo"}: {getFiscalPeriodLabel(alert, locale)}</span>
                    <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{isEn ? "source" : "origen"}: {alert.source}</span>
                    <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{getFiscalTaxRegimeLabel(alert.tax_regime)}</span>
                    <span className="rounded-full border border-[#d2dceb] px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">{getFiscalTaxModelLabel(alert.tax_model)}</span>
                  </div>
                  {alert.presented_at && (
                    <p className="mt-2 text-xs text-[#3a4f67]">{isEn ? "Filed on" : "Presentado el"} {formatDate(alert.presented_at, locale)}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setAlertForm(toAlertForm(alert)); setEditingAlertId(alert.id); }}>
                      {isEn ? "Edit" : "Editar"}
                    </button>
                    {alert.workflow_status !== "prepared" && <button type="button" disabled={isBusy} className="advisor-btn bg-amber-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertWorkflowStatus(alert.id, "prepared")}>{isEn ? "Prepare" : "Preparar"}</button>}
                    {alert.workflow_status !== "presented" && <button type="button" disabled={isBusy} className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertWorkflowStatus(alert.id, "presented")}>{isEn ? "File" : "Presentar"}</button>}
                    {alert.workflow_status !== "closed" && <button type="button" disabled={isBusy} className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertWorkflowStatus(alert.id, "closed")}>{isEn ? "Close" : "Cerrar"}</button>}
                    {alert.workflow_status !== "pending" && <button type="button" disabled={isBusy} className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertWorkflowStatus(alert.id, "pending")}>{isEn ? "Reopen filing" : "Reabrir tramite"}</button>}
                    {alert.status !== "resolved" && <button type="button" disabled={isBusy} className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "resolved")}>{isEn ? "Resolve" : "Resolver"}</button>}
                    {alert.status !== "ignored" && <button type="button" disabled={isBusy} className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "ignored")}>{isEn ? "Ignore" : "Ignorar"}</button>}
                    {alert.status !== "pending" && <button type="button" disabled={isBusy} className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "pending")}>{isEn ? "Reopen" : "Reabrir"}</button>}
                    <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void deleteResource(`/api/fiscal-alerts/${alert.id}`, () => setAlerts((current) => current.filter((item) => item.id !== alert.id)), "Alerta fiscal eliminada.").catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar alerta"))}>
                      {isEn ? "Delete" : "Eliminar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </article>
    </div>
  );
}
