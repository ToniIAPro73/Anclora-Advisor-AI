"use client";

import { useMemo, useState } from "react";
import { buildProactiveFiscalAlerts } from "@/lib/alerts/proactive-alerts";
import {
  fiscalAlertPriorityValues,
  fiscalAlertStatusValues,
  fiscalAlertTypeValues,
  type FiscalAlertPriority,
  type FiscalAlertRecord,
  type FiscalAlertStatus,
  type FiscalAlertType,
  sortFiscalAlerts,
} from "@/lib/fiscal/alerts";

interface FiscalWorkspaceProps {
  initialAlerts: FiscalAlertRecord[];
}

type FilterStatus = "all" | FiscalAlertStatus;

type FiscalFormState = {
  alertType: FiscalAlertType;
  description: string;
  dueDate: string;
  priority: FiscalAlertPriority;
};

const INITIAL_FORM: FiscalFormState = {
  alertType: "iva",
  description: "",
  dueDate: new Date().toISOString().slice(0, 10),
  priority: "medium",
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

function getQuotaCeroState(alerts: FiscalAlertRecord[]) {
  const cuotaAlerts = alerts.filter((alert) => alert.alert_type === "cuota_cero");
  if (cuotaAlerts.length === 0) {
    return {
      label: "Sin datos",
      progress: 0,
      detail: "No hay alertas de Cuota Cero registradas para este usuario.",
    };
  }

  const hasResolved = cuotaAlerts.some((alert) => alert.status === "resolved");
  const activeYear = cuotaAlerts.length >= 2 || hasResolved ? "Ano 2" : "Ano 1";

  return {
    label: activeYear,
    progress: activeYear === "Ano 2" ? 100 : 50,
    detail: `${cuotaAlerts.length} alerta(s) relacionadas con Cuota Cero.`,
  };
}

function toFormState(alert: FiscalAlertRecord): FiscalFormState {
  return {
    alertType: (fiscalAlertTypeValues.includes(alert.alert_type as FiscalAlertType)
      ? alert.alert_type
      : "recordatorio") as FiscalAlertType,
    description: alert.description ?? "",
    dueDate: alert.due_date,
    priority: (fiscalAlertPriorityValues.includes(alert.priority as FiscalAlertPriority)
      ? alert.priority
      : "medium") as FiscalAlertPriority,
  };
}

export function FiscalWorkspace({ initialAlerts }: FiscalWorkspaceProps) {
  const [alerts, setAlerts] = useState<FiscalAlertRecord[]>(sortFiscalAlerts(initialAlerts));
  const [form, setForm] = useState<FiscalFormState>(INITIAL_FORM);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [submitting, setSubmitting] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    if (filterStatus === "all") {
      return alerts;
    }
    return alerts.filter((alert) => alert.status === filterStatus);
  }, [alerts, filterStatus]);

  const proactiveAlerts = useMemo(() => buildProactiveFiscalAlerts(alerts), [alerts]);
  const quotaCero = useMemo(() => getQuotaCeroState(alerts), [alerts]);
  const pendingCount = useMemo(() => alerts.filter((alert) => alert.status === "pending").length, [alerts]);
  const resolvedCount = useMemo(() => alerts.filter((alert) => alert.status === "resolved").length, [alerts]);
  const overdueCount = useMemo(
    () =>
      alerts.filter((alert) => {
        if (alert.status !== "pending") {
          return false;
        }
        return new Date(alert.due_date).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime();
      }).length,
    [alerts]
  );

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingAlertId(null);
  }

  function startEditing(alert: FiscalAlertRecord) {
    setForm(toFormState(alert));
    setEditingAlertId(alert.id);
    setError(null);
    setOkMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      const isEditing = Boolean(editingAlertId);
      const response = await fetch(isEditing ? `/api/fiscal-alerts/${editingAlertId}` : "/api/fiscal-alerts", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        alert?: FiscalAlertRecord;
      };

      if (!response.ok || !result.success || !result.alert) {
        throw new Error(result.error ?? "No se pudo guardar la alerta fiscal");
      }

      const savedAlert = result.alert;
      setAlerts((previous) => {
        const next = isEditing
          ? previous.map((item) => (item.id === savedAlert.id ? savedAlert : item))
          : [savedAlert, ...previous];
        return sortFiscalAlerts(next);
      });
      setOkMessage(isEditing ? "Alerta fiscal actualizada." : "Alerta fiscal creada.");
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar alerta fiscal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(alertId: string, status: FiscalAlertStatus) {
    setUpdatingAlertId(alertId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/fiscal-alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        alert?: FiscalAlertRecord;
      };

      if (!response.ok || !result.success || !result.alert) {
        throw new Error(result.error ?? "No se pudo actualizar el estado");
      }

      const savedAlert = result.alert;
      setAlerts((previous) => sortFiscalAlerts(previous.map((item) => (item.id === savedAlert.id ? savedAlert : item))));
      setOkMessage(`Alerta marcada como ${status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar alerta");
    } finally {
      setUpdatingAlertId(null);
    }
  }

  async function handleDelete(alertId: string) {
    if (!window.confirm("Se eliminara la alerta fiscal. Esta accion no se puede deshacer.")) {
      return;
    }

    setUpdatingAlertId(alertId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/fiscal-alerts/${alertId}`, { method: "DELETE" });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo eliminar la alerta");
      }

      setAlerts((previous) => previous.filter((item) => item.id !== alertId));
      if (editingAlertId === alertId) {
        resetForm();
      }
      setOkMessage("Alerta fiscal eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar alerta");
    } finally {
      setUpdatingAlertId(null);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
        <article className="advisor-card shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {editingAlertId ? "Editar alerta fiscal" : "Nueva alerta fiscal"}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">
                Crea, corrige y prioriza obligaciones fiscales sin salir del dashboard.
              </p>
            </div>
            {editingAlertId && (
              <button
                type="button"
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="advisor-label" htmlFor="fiscalAlertType">
                Tipo de alerta
              </label>
              <select
                id="fiscalAlertType"
                className="advisor-input"
                value={form.alertType}
                onChange={(event) => setForm((current) => ({ ...current, alertType: event.target.value as FiscalAlertType }))}
              >
                {fiscalAlertTypeValues.map((type) => (
                  <option key={type} value={type}>
                    {getAlertLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="fiscalDueDate">
                  Vencimiento
                </label>
                <input
                  id="fiscalDueDate"
                  type="date"
                  className="advisor-input"
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="fiscalPriority">
                  Prioridad
                </label>
                <select
                  id="fiscalPriority"
                  className="advisor-input"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value as FiscalAlertPriority }))
                  }
                >
                  {fiscalAlertPriorityValues.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="fiscalDescription">
                Descripcion operativa
              </label>
              <textarea
                id="fiscalDescription"
                className="advisor-input min-h-28 resize-y"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Ej. Preparar documentacion para solicitud de cuota cero 2025."
              />
            </div>
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? "Guardando..." : editingAlertId ? "Actualizar alerta" : "Crear alerta"}
            </button>
          </form>
        </article>

        <article className="advisor-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Resumen operativo</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cuota Cero</p>
              <p className="mt-1 text-lg font-semibold text-[#162944]">{quotaCero.label}</p>
              <p className="mt-1 text-sm text-[#3a4f67]">{quotaCero.detail}</p>
              <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                <div className="h-2 rounded-full bg-[#1dab89]" style={{ width: `${quotaCero.progress}%` }} />
              </div>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Estado actual</p>
              <div className="mt-2 space-y-1 text-sm text-[#3a4f67]">
                <p>Pendientes: <strong className="text-[#162944]">{pendingCount}</strong></p>
                <p>Resueltas: <strong className="text-[#162944]">{resolvedCount}</strong></p>
                <p>Vencidas: <strong className="text-[#162944]">{overdueCount}</strong></p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Alertas proactivas</p>
            {proactiveAlerts.length === 0 ? (
              <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
                No hay alertas pendientes priorizadas en este momento.
              </div>
            ) : (
              proactiveAlerts.map((item) => (
                <div key={item.id} className="advisor-card-muted p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#162944]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#3a4f67]">{item.detail}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#d2dceb] bg-white px-2 py-0.5 text-xs font-semibold text-[#1c2b3c]">
                      {item.dueLabel}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(item.status)}`}>
                      estado: {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="advisor-heading text-2xl text-[#162944]">Alertas fiscales</h3>
              <p className="mt-1 text-sm text-[#3a4f67]">
                {filteredAlerts.length} visible(s) de {alerts.length} registro(s).
              </p>
            </div>
            <div>
              <label className="advisor-label" htmlFor="fiscalStatusFilter">
                Filtro de estado
              </label>
              <select
                id="fiscalStatusFilter"
                className="advisor-input min-w-40"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}
              >
                <option value="all">Todos</option>
                {fiscalAlertStatusValues.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredAlerts.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">
              No hay alertas fiscales para el filtro seleccionado.
            </div>
          ) : (
            <div className="space-y-3">
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
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(alert.priority)}`}>
                        prioridad: {alert.priority}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(alert.status)}`}>
                        estado: {alert.status}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={() => startEditing(alert)}
                      >
                        Editar
                      </button>
                      {alert.status !== "resolved" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(alert.id, "resolved")}
                        >
                          Resolver
                        </button>
                      )}
                      {alert.status !== "ignored" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(alert.id, "ignored")}
                        >
                          Ignorar
                        </button>
                      )}
                      {alert.status !== "pending" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusChange(alert.id, "pending")}
                        >
                          Reabrir
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleDelete(alert.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

