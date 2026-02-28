"use client";

import { useEffect, useMemo, useState } from "react";
import { buildProactiveFiscalAlerts } from "@/lib/alerts/proactive-alerts";
import {
  fiscalAlertPriorityValues,
  fiscalAlertStatusValues,
  fiscalAlertTypeValues,
  sortFiscalAlerts,
  type FiscalAlertPriority,
  type FiscalAlertRecord,
  type FiscalAlertStatus,
  type FiscalAlertType,
} from "@/lib/fiscal/alerts";
import {
  getFiscalTemplateLabel,
  type FiscalAlertTemplateRecord,
  type FiscalTemplateRecurrence,
} from "@/lib/fiscal/templates";

interface FiscalWorkspaceProps {
  initialAlerts: FiscalAlertRecord[];
  initialTemplates: FiscalAlertTemplateRecord[];
}

type FilterStatus = "all" | FiscalAlertStatus;

type FiscalFormState = {
  alertType: FiscalAlertType;
  description: string;
  dueDate: string;
  priority: FiscalAlertPriority;
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
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
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

function getAlertLabel(alertType: string): string {
  if (alertType === "cuota_cero") return "Cuota Cero";
  if (alertType === "iva") return "Modelo 303 (IVA)";
  if (alertType === "irpf") return "Modelo 130 (IRPF)";
  if (alertType === "retenciones") return "Retenciones";
  if (alertType === "autonomo") return "Autonomo";
  if (alertType === "recordatorio") return "Recordatorio";
  return alertType.replace(/_/g, " ");
}

function toAlertForm(alert: FiscalAlertRecord): FiscalFormState {
  return {
    alertType: alert.alert_type as FiscalAlertType,
    description: alert.description ?? "",
    dueDate: alert.due_date,
    priority: alert.priority as FiscalAlertPriority,
  };
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
  };
}

export function FiscalWorkspace({ initialAlerts, initialTemplates }: FiscalWorkspaceProps) {
  const [alerts, setAlerts] = useState(sortFiscalAlerts(initialAlerts));
  const [templates, setTemplates] = useState(initialTemplates);
  const [alertForm, setAlertForm] = useState(INITIAL_ALERT_FORM);
  const [templateForm, setTemplateForm] = useState(INITIAL_TEMPLATE_FORM);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [submitting, setSubmitting] = useState(false);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [generatingTemplates, setGeneratingTemplates] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<OperationJobRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const filteredAlerts = useMemo(
    () => (filterStatus === "all" ? alerts : alerts.filter((alert) => alert.status === filterStatus)),
    [alerts, filterStatus]
  );
  const proactiveAlerts = useMemo(() => buildProactiveFiscalAlerts(alerts), [alerts]);
  const fiscalJobs = useMemo(() => jobs.filter((job) => job.job_kind === "fiscal_template_generation"), [jobs]);

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
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar alerta");
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
      <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
        <article className="advisor-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {editingTemplateId ? "Editar plantilla" : "Plantilla recurrente"}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Automatiza obligaciones fiscales futuras por cola operativa.</p>
            </div>
            {editingTemplateId && (
              <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setTemplateForm(INITIAL_TEMPLATE_FORM); setEditingTemplateId(null); }}>
                Cancelar
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={saveTemplate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="advisor-input" value={templateForm.alertType} onChange={(event) => setTemplateForm((current) => ({ ...current, alertType: event.target.value as FiscalAlertType }))}>
                {fiscalAlertTypeValues.map((type) => <option key={type} value={type}>{getAlertLabel(type)}</option>)}
              </select>
              <select className="advisor-input" value={templateForm.priority} onChange={(event) => setTemplateForm((current) => ({ ...current, priority: event.target.value as FiscalAlertPriority }))}>
                {fiscalAlertPriorityValues.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="advisor-input" value={templateForm.recurrence} onChange={(event) => setTemplateForm((current) => ({ ...current, recurrence: event.target.value as FiscalTemplateRecurrence }))}>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
                <option value="annual">annual</option>
              </select>
              <input type="date" className="advisor-input" value={templateForm.startDate} onChange={(event) => setTemplateForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="number" min="1" max="28" className="advisor-input" value={templateForm.dueDay} onChange={(event) => setTemplateForm((current) => ({ ...current, dueDay: event.target.value }))} required />
              <input type="number" min="1" max="12" className="advisor-input" value={templateForm.dueMonth} onChange={(event) => setTemplateForm((current) => ({ ...current, dueMonth: event.target.value }))} disabled={templateForm.recurrence !== "annual"} />
            </div>
            <textarea className="advisor-input min-h-24 resize-y" value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descripcion base de la obligacion" />
            <label className="flex items-center gap-2 text-sm text-[#162944]">
              <input type="checkbox" checked={templateForm.isActive} onChange={(event) => setTemplateForm((current) => ({ ...current, isActive: event.target.checked }))} />
              plantilla activa
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="submit" disabled={templateSubmitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
                {templateSubmitting ? "Guardando..." : editingTemplateId ? "Actualizar plantilla" : "Crear plantilla"}
              </button>
              <button type="button" disabled={generatingTemplates || templates.length === 0} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void enqueueTemplates()}>
                {generatingTemplates ? "Encolando..." : "Generar recurrentes"}
              </button>
            </div>
          </form>
          <div className="mt-4 rounded-2xl border border-[#d2dceb] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Jobs fiscales</p>
                <p className="mt-1 text-sm text-[#162944]">{fiscalJobs.length} registro(s) de automatizacion</p>
              </div>
              <button type="button" disabled={processingQueue} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void processQueue()}>
                {processingQueue ? "Procesando..." : "Procesar cola"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {fiscalJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">
                  <p><strong>{job.job_kind}</strong> · <span className={`rounded-full border px-2 py-0.5 ${getStatusClass(job.status === "completed" ? "resolved" : job.status === "failed" ? "ignored" : "pending")}`}>{job.status}</span></p>
                  <p className="mt-1">{formatDate(job.created_at)}</p>
                  {job.error_message && <p className="mt-1 text-red-700">{job.error_message}</p>}
                </div>
              ))}
              {fiscalJobs.length === 0 && <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-2 text-xs text-[#3a4f67]">Sin jobs de automatizacion.</div>}
            </div>
          </div>
        </article>

        <article className="advisor-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">{editingAlertId ? "Editar alerta" : "Nueva alerta"}</h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Alta y gestion manual de alertas fiscales.</p>
            </div>
            {editingAlertId && <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setAlertForm(INITIAL_ALERT_FORM); setEditingAlertId(null); }}>Cancelar</button>}
          </div>
          <form className="mt-4 space-y-3" onSubmit={saveAlert}>
            <select className="advisor-input" value={alertForm.alertType} onChange={(event) => setAlertForm((current) => ({ ...current, alertType: event.target.value as FiscalAlertType }))}>
              {fiscalAlertTypeValues.map((type) => <option key={type} value={type}>{getAlertLabel(type)}</option>)}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="date" className="advisor-input" value={alertForm.dueDate} onChange={(event) => setAlertForm((current) => ({ ...current, dueDate: event.target.value }))} required />
              <select className="advisor-input" value={alertForm.priority} onChange={(event) => setAlertForm((current) => ({ ...current, priority: event.target.value as FiscalAlertPriority }))}>
                {fiscalAlertPriorityValues.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <textarea className="advisor-input min-h-28 resize-y" value={alertForm.description} onChange={(event) => setAlertForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descripcion operativa" />
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? "Guardando..." : editingAlertId ? "Actualizar alerta" : "Crear alerta"}
            </button>
          </form>
        </article>
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">Operacion fiscal</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">{filteredAlerts.length} alerta(s), {templates.length} plantilla(s), {proactiveAlerts.length} alerta(s) proactiva(s).</p>
            </div>
            <select className="advisor-input min-w-40" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}>
              <option value="all">Todos</option>
              {fiscalAlertStatusValues.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div className="advisor-card-muted p-3">
              <p className="text-sm font-semibold text-[#162944]">Plantillas activas</p>
              <div className="mt-2 space-y-2">
                {templates.length === 0 && <div className="rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#3a4f67]">No hay plantillas configuradas.</div>}
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-[#d2dceb] bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#162944]">{getFiscalTemplateLabel(template)}</p>
                        <p className="mt-1 text-xs text-[#3a4f67]">{template.description || "Sin descripcion base."}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(template.priority)}`}>{template.priority}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${template.is_active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>{template.is_active ? "activa" : "inactiva"}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setTemplateForm(toTemplateForm(template)); setEditingTemplateId(template.id); }}>
                        Editar
                      </button>
                      <button type="button" className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void deleteResource(`/api/fiscal-templates/${template.id}`, () => setTemplates((current) => current.filter((item) => item.id !== template.id)), "Plantilla fiscal eliminada.").catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar plantilla"))}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {proactiveAlerts.length > 0 && (
              <div className="advisor-card-muted p-3">
                <p className="text-sm font-semibold text-[#162944]">Alertas proactivas</p>
                <div className="mt-2 space-y-2">
                  {proactiveAlerts.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#d2dceb] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#162944]">{item.title}</p>
                          <p className="mt-1 text-sm text-[#3a4f67]">{item.detail}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(item.severity)}`}>{item.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredAlerts.length === 0 && <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay alertas para el filtro seleccionado.</div>}
            {filteredAlerts.map((alert) => {
              const isBusy = updatingAlertId === alert.id;
              return (
                <div key={alert.id} className="advisor-card-muted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#162944]">{getAlertLabel(alert.alert_type)}</p>
                      <p className="mt-1 text-sm text-[#3a4f67]">{alert.description || "Sin descripcion operativa."}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#1c2b3c]">{formatDate(alert.due_date)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(alert.priority)}`}>prioridad: {alert.priority}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(alert.status)}`}>estado: {alert.status}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => { setAlertForm(toAlertForm(alert)); setEditingAlertId(alert.id); }}>
                      Editar
                    </button>
                    {alert.status !== "resolved" && <button type="button" disabled={isBusy} className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "resolved")}>Resolver</button>}
                    {alert.status !== "ignored" && <button type="button" disabled={isBusy} className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "ignored")}>Ignorar</button>}
                    {alert.status !== "pending" && <button type="button" disabled={isBusy} className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void updateAlertStatus(alert.id, "pending")}>Reabrir</button>}
                    <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void deleteResource(`/api/fiscal-alerts/${alert.id}`, () => setAlerts((current) => current.filter((item) => item.id !== alert.id)), "Alerta fiscal eliminada.").catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar alerta"))}>
                      Eliminar
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
