"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  getReminderRecurrenceLabel,
  type GeneralAlertReminderRecurrence,
  type GeneralAlertReminderRecord,
} from "@/lib/alerts/general-alert-reminders";
import {
  getGeneralAlertCategoryLabel,
  getGeneralAlertDueLabel,
  getGeneralAlertPriorityLabel,
  sortGeneralAlerts,
  type GeneralAlertCategory,
  type GeneralAlertPriority,
  type GeneralAlertRecord,
} from "@/lib/alerts/general-alerts";

type GeneralAlertsWorkspaceProps = {
  initialAlerts: GeneralAlertRecord[];
  initialReminders: GeneralAlertReminderRecord[];
  locale: "es" | "en";
};

type FilterCategory = "all" | GeneralAlertCategory;

type AlertFormState = {
  title: string;
  message: string;
  category: GeneralAlertCategory;
  priority: GeneralAlertPriority;
  dueDate: string;
  recurrence: "none" | GeneralAlertReminderRecurrence;
  leadDays: string;
};

const INITIAL_FORM: AlertFormState = {
  title: "",
  message: "",
  category: "fiscal",
  priority: "medium",
  dueDate: "",
  recurrence: "none",
  leadDays: "7",
};

const CATEGORY_ORDER: FilterCategory[] = ["all", "fiscal", "laboral", "facturacion"];

function getPriorityBadgeClass(priority: string): string {
  if (priority === "critical") return "border-red-300 bg-red-50 text-red-700";
  if (priority === "high") return "border-orange-300 bg-orange-50 text-orange-700";
  if (priority === "medium") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function getCategoryTone(category: string): string {
  if (category === "fiscal") return "bg-[rgba(29,171,137,0.14)] text-[var(--advisor-accent)]";
  if (category === "laboral") return "bg-[rgba(73,127,255,0.16)] text-[#8bb0ff]";
  return "bg-[rgba(255,179,71,0.16)] text-[#ffca7d]";
}

function getStatusLabel(status: string, locale: "es" | "en"): string {
  if (status === "resolved") return locale === "en" ? "Resolved" : "Resuelta";
  return locale === "en" ? "Pending" : "Pendiente";
}

function getSourceLabel(source: GeneralAlertRecord["source"], locale: "es" | "en"): string {
  if (source === "manual") return locale === "en" ? "Manual" : "Manual";
  if (source === "reminder") return locale === "en" ? "Reminder" : "Recordatorio";
  if (source === "fiscal_alert") return locale === "en" ? "Tax automation" : "Automatizacion fiscal";
  if (source === "labor_action") return locale === "en" ? "Labor monitor" : "Monitor laboral";
  if (source === "invoice") return locale === "en" ? "Invoicing monitor" : "Monitor de facturacion";
  return source;
}

function formatDate(value: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function GeneralAlertsWorkspace({
  initialAlerts,
  initialReminders,
  locale,
}: GeneralAlertsWorkspaceProps) {
  const [alerts, setAlerts] = useState(sortGeneralAlerts(initialAlerts));
  const [reminders, setReminders] = useState(initialReminders);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    const scoped = filterCategory === "all"
      ? alerts
      : alerts.filter((alert) => alert.category === filterCategory);
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return scoped;
    }
    return scoped.filter((alert) =>
      [alert.title, alert.message ?? "", alert.category, alert.priority]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [alerts, filterCategory, searchQuery]);

  const stats = useMemo(() => ({
    unread: alerts.filter((alert) => !alert.read_at && alert.status === "pending").length,
    pending: alerts.filter((alert) => alert.status === "pending").length,
    reminders: reminders.filter((reminder) => reminder.is_active).length,
    critical: alerts.filter((alert) => alert.priority === "critical" && alert.status === "pending").length,
  }), [alerts, reminders]);

  const upcomingAlerts = useMemo(
    () => filteredAlerts.filter((alert) => alert.status === "pending").slice(0, 3),
    [filteredAlerts],
  );

  const visibleReminders = useMemo(
    () => reminders.slice().sort((left, right) => Number(right.is_active) - Number(left.is_active)),
    [reminders],
  );

  const formMode = form.recurrence === "none"
    ? (locale === "en" ? "One-time alert" : "Alerta puntual")
    : (locale === "en" ? "Recurring reminder" : "Recordatorio recurrente");

  const unreadFilteredAlerts = useMemo(
    () => filteredAlerts.filter((alert) => !alert.read_at && alert.status === "pending"),
    [filteredAlerts],
  );

  const resolvableFilteredAlerts = useMemo(
    () => filteredAlerts.filter((alert) => (alert.source === "manual" || alert.source === "reminder") && alert.status === "pending"),
    [filteredAlerts],
  );

  const selectedVisibleAlerts = useMemo(
    () => filteredAlerts.filter((alert) => selectedAlertIds.includes(alert.id)),
    [filteredAlerts, selectedAlertIds],
  );

  const actionableReadAlerts = useMemo(
    () => (selectedVisibleAlerts.length > 0 ? selectedVisibleAlerts : unreadFilteredAlerts)
      .filter((alert) => !alert.read_at && alert.status === "pending"),
    [selectedVisibleAlerts, unreadFilteredAlerts],
  );

  const actionableResolveAlerts = useMemo(
    () => (selectedVisibleAlerts.length > 0 ? selectedVisibleAlerts : resolvableFilteredAlerts)
      .filter((alert) => (alert.source === "manual" || alert.source === "reminder") && alert.status === "pending"),
    [selectedVisibleAlerts, resolvableFilteredAlerts],
  );

  const allVisibleSelected = filteredAlerts.length > 0 && filteredAlerts.every((alert) => selectedAlertIds.includes(alert.id));

  function loadReminderIntoForm(reminder: GeneralAlertReminderRecord) {
    setForm({
      title: reminder.title,
      message: reminder.message ?? "",
      category: reminder.category as GeneralAlertCategory,
      priority: reminder.priority as GeneralAlertPriority,
      dueDate: reminder.anchor_date,
      recurrence: reminder.recurrence as GeneralAlertReminderRecurrence,
      leadDays: String(reminder.lead_days),
    });
    setEditingReminderId(reminder.id);
    setIsComposerOpen(true);
    setOkMessage(null);
    setError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      if (editingReminderId) {
        const response = await fetch(`/api/general-alert-reminders/${editingReminderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            message: form.message,
            category: form.category,
            priority: form.priority,
            recurrence: form.recurrence === "none" ? "monthly" : form.recurrence,
            anchorDate: form.dueDate || new Date().toISOString().slice(0, 10),
            leadDays: Number.parseInt(form.leadDays, 10),
            isActive: true,
          }),
        });
        const result = (await response.json()) as { success: boolean; reminder?: GeneralAlertReminderRecord; error?: string };
        if (!response.ok || !result.success || !result.reminder) {
          throw new Error(result.error ?? "No se pudo actualizar el recordatorio");
        }
        setReminders((current) => current.map((item) => (item.id === result.reminder!.id ? result.reminder! : item)));
        setOkMessage(locale === "en" ? "Recurring reminder updated." : "Recordatorio recurrente actualizado.");
      } else if (form.recurrence === "none") {
        const response = await fetch("/api/general-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            message: form.message,
            category: form.category,
            priority: form.priority,
            dueDate: form.dueDate || null,
          }),
        });
        const result = (await response.json()) as { success: boolean; alert?: GeneralAlertRecord; error?: string };
        if (!response.ok || !result.success || !result.alert) {
          throw new Error(result.error ?? "No se pudo crear la alerta");
        }
        setAlerts((current) => sortGeneralAlerts([result.alert!, ...current]));
        setOkMessage(locale === "en" ? "Alert created." : "Alerta creada.");
      } else {
        const response = await fetch("/api/general-alert-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            message: form.message,
            category: form.category,
            priority: form.priority,
            recurrence: form.recurrence,
            anchorDate: form.dueDate || new Date().toISOString().slice(0, 10),
            leadDays: Number.parseInt(form.leadDays, 10),
          }),
        });
        const result = (await response.json()) as { success: boolean; reminder?: GeneralAlertReminderRecord; error?: string };
        if (!response.ok || !result.success || !result.reminder) {
          throw new Error(result.error ?? "No se pudo crear el recordatorio");
        }
        setReminders((current) => [result.reminder!, ...current]);
        setOkMessage(locale === "en" ? "Recurring reminder created." : "Recordatorio recurrente creado.");
      }

      setForm(INITIAL_FORM);
      setEditingReminderId(null);
      setIsComposerOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAlertRead(alert: GeneralAlertRecord, read: boolean) {
    setError(null);
    const response = await fetch(`/api/general-alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    const result = (await response.json()) as { success: boolean; alert?: GeneralAlertRecord; error?: string };
    if (!response.ok || !result.success || !result.alert) {
      throw new Error(result.error ?? "No se pudo actualizar la alerta");
    }
    setAlerts((current) => current.map((item) => (item.id === result.alert!.id ? result.alert! : item)));
  }

  async function resolveAlert(alert: GeneralAlertRecord) {
    setError(null);
    const response = await fetch(`/api/general-alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", read: true }),
    });
    const result = (await response.json()) as { success: boolean; alert?: GeneralAlertRecord; error?: string };
    if (!response.ok || !result.success || !result.alert) {
      throw new Error(result.error ?? "No se pudo resolver la alerta");
    }
    setAlerts((current) => current.map((item) => (item.id === result.alert!.id ? result.alert! : item)));
  }

  async function toggleReminder(reminder: GeneralAlertReminderRecord, isActive: boolean) {
    setError(null);
    const response = await fetch(`/api/general-alert-reminders/${reminder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const result = (await response.json()) as { success: boolean; reminder?: GeneralAlertReminderRecord; error?: string };
    if (!response.ok || !result.success || !result.reminder) {
      throw new Error(result.error ?? "No se pudo actualizar el recordatorio");
    }
    setReminders((current) => current.map((item) => (item.id === result.reminder!.id ? result.reminder! : item)));
  }

  function toggleAlertSelection(alertId: string) {
    setSelectedAlertIds((current) => (
      current.includes(alertId)
        ? current.filter((item) => item !== alertId)
        : [...current, alertId]
    ));
  }

  function toggleSelectAllVisible() {
    setSelectedAlertIds((current) => {
      if (allVisibleSelected) {
        return current.filter((item) => !filteredAlerts.some((alert) => alert.id === item));
      }
      const merged = new Set([...current, ...filteredAlerts.map((alert) => alert.id)]);
      return [...merged];
    });
  }

  async function runBulkAction(action: "read" | "resolve") {
    const targets = action === "read" ? actionableReadAlerts : actionableResolveAlerts;
    if (targets.length === 0) {
      return;
    }

    setBulkBusy(true);
    setError(null);
    setOkMessage(null);

    try {
      const updatedAlerts = await Promise.all(targets.map(async (alert) => {
        const response = await fetch(`/api/general-alerts/${alert.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action === "read"
            ? { read: true }
            : { status: "resolved", read: true }),
        });
        const result = (await response.json()) as { success: boolean; alert?: GeneralAlertRecord; error?: string };
        if (!response.ok || !result.success || !result.alert) {
          throw new Error(result.error ?? "No se pudo actualizar la bandeja");
        }
        return result.alert;
      }));

      setAlerts((current) => sortGeneralAlerts(current.map((item) => {
        const updated = updatedAlerts.find((candidate) => candidate.id === item.id);
        return updated ?? item;
      })));
      setSelectedAlertIds((current) => current.filter((id) => !targets.some((alert) => alert.id === id)));
      setOkMessage(
        action === "read"
          ? (locale === "en" ? "Selected tray alerts marked as read." : "Alertas seleccionadas marcadas como leidas.")
          : (locale === "en" ? "Selected tray alerts resolved." : "Alertas seleccionadas resueltas."),
      );
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Error al actualizar la bandeja");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 min-w-0 gap-4 2xl:grid-cols-[24rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 min-w-0 flex-col gap-4">
        <article
          className="advisor-card shrink-0 overflow-hidden"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--advisor-panel) 92%, rgba(22,41,68,0.55)) 0%, var(--advisor-panel) 100%)",
          }}
        >
          <div className="border-b px-4 py-4" style={{ borderColor: "var(--advisor-border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(29,171,137,0.14)", color: "var(--advisor-accent)" }}>
                  {formMode}
                </span>
                <h2 className="advisor-heading mt-3 text-2xl" style={{ color: "var(--text-primary)" }}>
                  {editingReminderId
                    ? (locale === "en" ? "Edit reminder" : "Editar recordatorio")
                    : (locale === "en" ? "Create alert" : "Crear aviso")}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {locale === "en"
                    ? "Register one-off deadlines or automate recurring follow-up for tax, labor, and invoicing."
                    : "Registra hitos puntuales o automatiza seguimientos recurrentes de fiscalidad, laboral y facturacion."}
                </p>
              </div>
              <div className={`rounded-2xl px-3 py-2 text-right text-xs font-semibold ${getCategoryTone(form.category)}`}>
                {getGeneralAlertCategoryLabel(form.category, locale)}
              </div>
            </div>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm font-semibold 2xl:hidden"
              style={{
                borderColor: "var(--advisor-border)",
                background: "color-mix(in srgb, var(--advisor-panel) 92%, transparent)",
                color: "var(--text-primary)",
              }}
              onClick={() => setIsComposerOpen((current) => !current)}
            >
              <span>{isComposerOpen ? (locale === "en" ? "Hide composer" : "Ocultar creador") : (locale === "en" ? "Open composer" : "Abrir creador")}</span>
              <span>{isComposerOpen ? "-" : "+"}</span>
            </button>
          </div>

          <form className={`space-y-4 p-4 ${isComposerOpen ? "block" : "hidden"} 2xl:block`} onSubmit={handleCreate}>
            {editingReminderId && (
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                onClick={() => {
                  setEditingReminderId(null);
                  setForm(INITIAL_FORM);
                  setError(null);
                  setOkMessage(null);
                }}
              >
                {locale === "en" ? "Cancel edit" : "Cancelar edicion"}
              </button>
            )}

            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              <button
                type="button"
                className="rounded-2xl border px-3 py-3 text-left transition"
                style={{
                  borderColor: form.recurrence === "none" ? "var(--advisor-accent)" : "var(--advisor-border)",
                  background: form.recurrence === "none"
                    ? "color-mix(in srgb, var(--advisor-accent) 14%, var(--advisor-panel))"
                    : "color-mix(in srgb, var(--advisor-panel) 94%, transparent)",
                }}
                onClick={() => setForm((current) => ({ ...current, recurrence: "none" }))}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {locale === "en" ? "Immediate alert" : "Alerta inmediata"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {locale === "en" ? "For a single deadline or manual review." : "Para un plazo unico o una revision manual."}
                </p>
              </button>
              <button
                type="button"
                className="rounded-2xl border px-3 py-3 text-left transition"
                style={{
                  borderColor: form.recurrence !== "none" ? "var(--advisor-accent)" : "var(--advisor-border)",
                  background: form.recurrence !== "none"
                    ? "color-mix(in srgb, var(--advisor-accent) 14%, var(--advisor-panel))"
                    : "color-mix(in srgb, var(--advisor-panel) 94%, transparent)",
                }}
                onClick={() => setForm((current) => ({ ...current, recurrence: current.recurrence === "none" ? "monthly" : current.recurrence }))}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {locale === "en" ? "Recurring reminder" : "Recordatorio recurrente"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {locale === "en" ? "For IVA, IRPF, subscriptions, and renewals." : "Para IVA, IRPF, suscripciones y renovaciones."}
                </p>
              </button>
            </div>

            <div>
              <label className="advisor-label" htmlFor="general-alert-title">
                {locale === "en" ? "Title" : "Titulo"}
              </label>
              <input
                id="general-alert-title"
                className="advisor-input"
                value={form.title}
                placeholder={locale === "en" ? "Q2 VAT filing" : "Presentacion IVA 2T"}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>

            <div>
              <label className="advisor-label" htmlFor="general-alert-message">
                {locale === "en" ? "Detail" : "Detalle"}
              </label>
              <textarea
                id="general-alert-message"
                className="advisor-input min-h-24 resize-y"
                value={form.message}
                placeholder={locale === "en" ? "Context, owner, or next action." : "Contexto, responsable o siguiente accion."}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="general-alert-category">
                  {locale === "en" ? "Category" : "Categoria"}
                </label>
              <select
                id="general-alert-category"
                className="advisor-input"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as GeneralAlertCategory }))}
              >
                <option value="fiscal">{getGeneralAlertCategoryLabel("fiscal", locale)}</option>
                <option value="laboral">{getGeneralAlertCategoryLabel("laboral", locale)}</option>
                <option value="facturacion">{getGeneralAlertCategoryLabel("facturacion", locale)}</option>
              </select>
              </div>
              <div>
                <label className="advisor-label" htmlFor="general-alert-priority">
                  {locale === "en" ? "Priority" : "Prioridad"}
                </label>
              <select
                id="general-alert-priority"
                className="advisor-input"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as GeneralAlertPriority }))}
              >
                <option value="low">{getGeneralAlertPriorityLabel("low", locale)}</option>
                <option value="medium">{getGeneralAlertPriorityLabel("medium", locale)}</option>
                <option value="high">{getGeneralAlertPriorityLabel("high", locale)}</option>
                <option value="critical">{getGeneralAlertPriorityLabel("critical", locale)}</option>
              </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="general-alert-recurrence">
                  {locale === "en" ? "Recurrence" : "Recurrencia"}
                </label>
              <select
                id="general-alert-recurrence"
                className="advisor-input"
                value={form.recurrence}
                onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as AlertFormState["recurrence"] }))}
              >
                <option value="none">{locale === "en" ? "One-time alert" : "Alerta puntual"}</option>
                <option value="monthly">{locale === "en" ? "Monthly" : "Mensual"}</option>
                <option value="quarterly">{locale === "en" ? "Quarterly" : "Trimestral"}</option>
                <option value="yearly">{locale === "en" ? "Yearly" : "Anual"}</option>
              </select>
              </div>
              <div>
                <label className="advisor-label" htmlFor="general-alert-lead-days">
                  {locale === "en" ? "Lead days" : "Dias de antelacion"}
                </label>
              <input
                id="general-alert-lead-days"
                type="number"
                min="0"
                max="365"
                className="advisor-input"
                value={form.leadDays}
                placeholder={locale === "en" ? "Days before due date" : "Dias antes del vencimiento"}
                onChange={(event) => setForm((current) => ({ ...current, leadDays: event.target.value }))}
                disabled={form.recurrence === "none"}
              />
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="general-alert-date">
                {locale === "en" ? "Reference date" : "Fecha de referencia"}
              </label>
              <input
                id="general-alert-date"
                type="date"
                className="advisor-input"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting
                ? (locale === "en" ? "Saving..." : "Guardando...")
                : editingReminderId
                  ? (locale === "en" ? "Update reminder" : "Actualizar recordatorio")
                  : (locale === "en" ? "Save alert" : "Guardar aviso")}
            </button>
          </form>
        </article>

        <article className="advisor-card min-h-0 flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--advisor-border)" }}>
            <div>
              <h3 className="advisor-heading text-xl" style={{ color: "var(--text-primary)" }}>
                {locale === "en" ? "Recurring base" : "Base recurrente"}
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {locale === "en" ? "Templates that keep the alert flow alive." : "Plantillas que mantienen vivo el flujo de avisos."}
              </p>
            </div>
            <span className="advisor-chip">{stats.reminders}</span>
          </div>
          <div className="min-h-0 space-y-3 overflow-y-auto p-4">
            {visibleReminders.length === 0 && (
              <div className="advisor-card-muted p-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                {locale === "en" ? "No recurring reminders yet." : "Todavia no hay recordatorios recurrentes."}
              </div>
            )}
            {visibleReminders.map((reminder) => (
              <div key={reminder.id} className="advisor-card-muted min-w-0 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{reminder.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      <span className={`rounded-full px-2 py-1 font-semibold ${getCategoryTone(reminder.category)}`}>
                        {getGeneralAlertCategoryLabel(reminder.category, locale)}
                      </span>
                      <span>{getReminderRecurrenceLabel(reminder.recurrence, locale)}</span>
                      <span>{locale === "en" ? `${reminder.lead_days} day(s) before` : `${reminder.lead_days} dia(s) antes`}</span>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[11px] font-semibold"
                    style={{
                      background: reminder.is_active ? "rgba(29,171,137,0.14)" : "rgba(148,163,184,0.16)",
                      color: reminder.is_active ? "var(--advisor-accent)" : "var(--text-secondary)",
                    }}
                  >
                    {reminder.is_active ? (locale === "en" ? "Active" : "Activo") : (locale === "en" ? "Paused" : "Pausado")}
                  </span>
                </div>
                {reminder.last_generated_for && (
                  <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {locale === "en" ? "Last generated for" : "Ultima generacion para"} {formatDate(reminder.last_generated_for, locale)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                    onClick={() => loadReminderIntoForm(reminder)}
                  >
                    {locale === "en" ? "Edit" : "Editar"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                    onClick={() => void toggleReminder(reminder, !reminder.is_active).catch((toggleError) => setError(toggleError instanceof Error ? toggleError.message : "Error al actualizar recordatorio"))}
                  >
                    {reminder.is_active ? (locale === "en" ? "Pause" : "Pausar") : (locale === "en" ? "Activate" : "Activar")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col gap-4">
        <article
          className="advisor-card shrink-0 overflow-hidden"
          style={{
            background: "radial-gradient(circle at top left, rgba(29,171,137,0.14), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--advisor-panel) 93%, rgba(8,22,44,0.65)) 0%, var(--advisor-panel) 100%)",
          }}
        >
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.9fr)]">
            <div className="min-w-0">
              <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(29,171,137,0.14)", color: "var(--advisor-accent)" }}>
                {locale === "en" ? "Operational tray" : "Bandeja operativa"}
              </span>
              <h2 className="advisor-heading mt-3 text-3xl" style={{ color: "var(--text-primary)" }}>
                {locale === "en" ? "Control deadlines before they turn into issues" : "Controla los plazos antes de que se conviertan en problema"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-secondary)" }}>
                {locale === "en"
                  ? "The center consolidates fiscal, labor, and invoicing warnings, plus the reminders that keep renewals and subscriptions under control."
                  : "El centro consolida avisos fiscales, laborales y de facturacion, junto con los recordatorios que mantienen bajo control renovaciones y suscripciones."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {CATEGORY_ORDER.map((category) => {
                  const active = filterCategory === category;
                  const label = category === "all"
                    ? (locale === "en" ? "All" : "Todas")
                    : getGeneralAlertCategoryLabel(category, locale);
                  return (
                    <button
                      key={category}
                      type="button"
                      className="rounded-full px-3 py-2 text-xs font-semibold transition"
                      style={{
                        border: `1px solid ${active ? "var(--advisor-accent)" : "var(--advisor-border)"}`,
                        background: active
                          ? "color-mix(in srgb, var(--advisor-accent) 16%, var(--advisor-panel))"
                          : "color-mix(in srgb, var(--advisor-panel) 92%, transparent)",
                        color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                      onClick={() => setFilterCategory(category)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <div className="advisor-card-muted p-4">
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Unread" : "Sin leer"}</p>
                <p className="mt-3 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.unread}</p>
              </div>
              <div className="advisor-card-muted p-4">
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Critical open" : "Criticas abiertas"}</p>
                <p className="mt-3 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.critical}</p>
              </div>
              <div className="advisor-card-muted p-4">
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Pending" : "Pendientes"}</p>
                <p className="mt-3 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.pending}</p>
              </div>
              <div className="advisor-card-muted p-4">
                <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Active reminders" : "Recordatorios activos"}</p>
                <p className="mt-3 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.reminders}</p>
              </div>
            </div>
          </div>
        </article>

        <article className="advisor-card min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 border-b px-4 py-4" style={{ borderColor: "var(--advisor-border)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  {locale === "en" ? "Bulk actions" : "Acciones masivas"}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {locale === "en"
                    ? "Apply actions to the currently visible tray."
                    : "Aplica acciones sobre la bandeja visible actual."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                    onClick={toggleSelectAllVisible}
                    disabled={filteredAlerts.length === 0}
                  >
                    {allVisibleSelected
                      ? (locale === "en" ? "Clear visible selection" : "Limpiar visibles")
                      : locale === "en"
                        ? `Select visible (${filteredAlerts.length})`
                        : `Seleccionar visibles (${filteredAlerts.length})`}
                  </button>
                  {selectedVisibleAlerts.length > 0 && (
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                      onClick={() => setSelectedAlertIds((current) => current.filter((id) => !filteredAlerts.some((alert) => alert.id === id)))}
                    >
                      {locale === "en" ? `Selected (${selectedVisibleAlerts.length})` : `Seleccionadas (${selectedVisibleAlerts.length})`}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bulkBusy || actionableReadAlerts.length === 0}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                  onClick={() => void runBulkAction("read")}
                >
                  {bulkBusy
                    ? (locale === "en" ? "Updating..." : "Actualizando...")
                    : locale === "en"
                      ? `Mark read (${actionableReadAlerts.length})`
                      : `Marcar leidas (${actionableReadAlerts.length})`}
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || actionableResolveAlerts.length === 0}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                  onClick={() => void runBulkAction("resolve")}
                >
                  {bulkBusy
                    ? (locale === "en" ? "Updating..." : "Actualizando...")
                    : locale === "en"
                      ? `Resolve (${actionableResolveAlerts.length})`
                      : `Resolver (${actionableResolveAlerts.length})`}
                </button>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <input
                className="advisor-input min-w-0"
                placeholder={locale === "en" ? "Search by title, category, or priority" : "Buscar por titulo, categoria o prioridad"}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <div className="advisor-card-muted flex min-w-0 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Next items" : "Siguientes hitos"}</p>
                  <p className="mt-1 truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {upcomingAlerts[0]?.title ?? (locale === "en" ? "No pending alerts" : "No hay alertas pendientes")}
                  </p>
                </div>
                {upcomingAlerts[0]?.due_date && (
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(29,171,137,0.14)", color: "var(--advisor-accent)" }}>
                    {formatDate(upcomingAlerts[0].due_date, locale)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {upcomingAlerts.map((alert) => (
                <div key={alert.id} className="advisor-card-muted min-w-0 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{alert.title}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {getGeneralAlertCategoryLabel(alert.category, locale)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadgeClass(alert.priority)}`}>
                      {getGeneralAlertPriorityLabel(alert.priority, locale)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {alert.due_date ? formatDate(alert.due_date, locale) : (locale === "en" ? "Without date" : "Sin fecha")}
                  </p>
                </div>
              ))}
              {upcomingAlerts.length === 0 && (
                <div className="advisor-card-muted p-3 text-sm xl:col-span-3" style={{ color: "var(--text-secondary)" }}>
                  {locale === "en" ? "No alerts with the current filter." : "No hay alertas para el filtro actual."}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredAlerts.length === 0 && (
              <div className="advisor-card-muted p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                {locale === "en" ? "No alerts with the current filter." : "No hay alertas para el filtro actual."}
              </div>
            )}
            {filteredAlerts.map((alert) => {
              const dueLabel = getGeneralAlertDueLabel(alert.due_date, locale);
              return (
                <div
                  key={alert.id}
                  className="advisor-card-muted min-w-0 p-4"
                  style={{
                    background: !alert.read_at && alert.status === "pending"
                      ? "linear-gradient(180deg, color-mix(in srgb, var(--advisor-panel-muted) 82%, rgba(29,171,137,0.12)) 0%, var(--advisor-panel-muted) 100%)"
                      : undefined,
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <label className="mt-0.5 flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={selectedAlertIds.includes(alert.id)}
                          onChange={() => toggleAlertSelection(alert.id)}
                          className="h-4 w-4 rounded border"
                          style={{ accentColor: "var(--advisor-accent)" }}
                          aria-label={locale === "en" ? `Select alert ${alert.title}` : `Seleccionar alerta ${alert.title}`}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadgeClass(alert.priority)}`}>
                          {getGeneralAlertPriorityLabel(alert.priority, locale)}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getCategoryTone(alert.category)}`}>
                          {getGeneralAlertCategoryLabel(alert.category, locale)}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
                          {getStatusLabel(alert.status, locale)}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold leading-6" style={{ color: "var(--text-primary)" }}>{alert.title}</p>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                        {alert.message || (locale === "en" ? "No detail." : "Sin detalle.")}
                      </p>
                      </div>
                    </div>
                    {!alert.read_at && alert.status === "pending" && (
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[var(--advisor-accent)] shadow-[0_0_0_6px_rgba(29,171,137,0.14)]" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {alert.due_date && <span className="rounded-full bg-[rgba(148,163,184,0.12)] px-2.5 py-1">{formatDate(alert.due_date, locale)}</span>}
                    {dueLabel && <span className="rounded-full bg-[rgba(148,163,184,0.12)] px-2.5 py-1">{dueLabel}</span>}
                    <span className="rounded-full bg-[rgba(148,163,184,0.12)] px-2.5 py-1">{getSourceLabel(alert.source, locale)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                      onClick={() => void toggleAlertRead(alert, !alert.read_at).catch((toggleError) => setError(toggleError instanceof Error ? toggleError.message : "Error al actualizar lectura"))}
                    >
                      {alert.read_at ? (locale === "en" ? "Mark unread" : "Marcar no leida") : (locale === "en" ? "Mark read" : "Marcar leida")}
                    </button>
                    {(alert.source === "manual" || alert.source === "reminder") && alert.status === "pending" && (
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                        onClick={() => void resolveAlert(alert).catch((resolveError) => setError(resolveError instanceof Error ? resolveError.message : "Error al resolver alerta"))}
                      >
                        {locale === "en" ? "Resolve" : "Resolver"}
                      </button>
                    )}
                    {alert.link_href && (
                      <button
                        type="button"
                        className="advisor-btn advisor-btn-primary px-3 py-2 text-xs"
                        onClick={() => { window.location.href = alert.link_href!; }}
                      >
                        {locale === "en" ? "Open" : "Abrir"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </article>
      </section>
    </div>
  );
}
