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

function getPriorityBadgeClass(priority: string): string {
  if (priority === "critical") return "border-red-300 bg-red-50 text-red-700";
  if (priority === "high") return "border-orange-300 bg-orange-50 text-orange-700";
  if (priority === "medium") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function getStatusLabel(status: string, locale: "es" | "en"): string {
  if (status === "resolved") return locale === "en" ? "Resolved" : "Resuelta";
  return locale === "en" ? "Pending" : "Pendiente";
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
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
  }), [alerts, reminders]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      if (form.recurrence === "none") {
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

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        <article className="advisor-card p-4">
          <h2 className="advisor-heading text-2xl" style={{ color: "var(--text-primary)" }}>
            {locale === "en" ? "New alert or reminder" : "Nueva alerta o recordatorio"}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {locale === "en"
              ? "Create one-time alerts or recurring reminders for deadlines, renewals, and subscriptions."
              : "Crea alertas puntuales o recordatorios recurrentes para plazos, renovaciones y suscripciones."}
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <input
              className="advisor-input"
              value={form.title}
              placeholder={locale === "en" ? "Title" : "Titulo"}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              className="advisor-input min-h-24 resize-y"
              value={form.message}
              placeholder={locale === "en" ? "Detail" : "Detalle"}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="advisor-input"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as GeneralAlertCategory }))}
              >
                <option value="fiscal">{getGeneralAlertCategoryLabel("fiscal", locale)}</option>
                <option value="laboral">{getGeneralAlertCategoryLabel("laboral", locale)}</option>
                <option value="facturacion">{getGeneralAlertCategoryLabel("facturacion", locale)}</option>
              </select>
              <select
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
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="advisor-input"
                value={form.recurrence}
                onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as AlertFormState["recurrence"] }))}
              >
                <option value="none">{locale === "en" ? "One-time alert" : "Alerta puntual"}</option>
                <option value="monthly">{locale === "en" ? "Monthly" : "Mensual"}</option>
                <option value="quarterly">{locale === "en" ? "Quarterly" : "Trimestral"}</option>
                <option value="yearly">{locale === "en" ? "Yearly" : "Anual"}</option>
              </select>
              <input
                type="number"
                min="0"
                max="365"
                className="advisor-input"
                value={form.leadDays}
                placeholder={locale === "en" ? "Lead days" : "Dias de antelacion"}
                onChange={(event) => setForm((current) => ({ ...current, leadDays: event.target.value }))}
                disabled={form.recurrence === "none"}
              />
            </div>
            <input
              type="date"
              className="advisor-input"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? (locale === "en" ? "Saving..." : "Guardando...") : (locale === "en" ? "Save" : "Guardar")}
            </button>
          </form>
        </article>

        <article className="advisor-card p-4">
          <h3 className="advisor-heading text-xl" style={{ color: "var(--text-primary)" }}>
            {locale === "en" ? "Recurring reminders" : "Recordatorios recurrentes"}
          </h3>
          <div className="mt-3 space-y-2">
            {reminders.length === 0 && (
              <div className="advisor-card-muted p-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                {locale === "en" ? "No recurring reminders yet." : "Todavia no hay recordatorios recurrentes."}
              </div>
            )}
            {reminders.map((reminder) => (
              <div key={reminder.id} className="advisor-card-muted p-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{reminder.title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{getGeneralAlertCategoryLabel(reminder.category, locale)}</span>
                  <span>{getReminderRecurrenceLabel(reminder.recurrence, locale)}</span>
                  <span>{locale === "en" ? `${reminder.lead_days} day(s) before` : `${reminder.lead_days} dia(s) antes`}</span>
                  <span>{reminder.is_active ? (locale === "en" ? "Active" : "Activo") : (locale === "en" ? "Paused" : "Pausado")}</span>
                </div>
                {reminder.last_generated_for && (
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {locale === "en" ? "Last generated for" : "Ultima generacion para"} {formatDate(reminder.last_generated_for, locale)}
                  </p>
                )}
                <div className="mt-3">
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
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--advisor-border)" }}>
          <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
            <div className="advisor-card-muted p-3">
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Unread" : "Sin leer"}</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.unread}</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Pending" : "Pendientes"}</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.pending}</p>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{locale === "en" ? "Active reminders" : "Recordatorios activos"}</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{stats.reminders}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="advisor-input"
              placeholder={locale === "en" ? "Search alert" : "Buscar alerta"}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select className="advisor-input" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value as FilterCategory)}>
              <option value="all">{locale === "en" ? "All categories" : "Todas las categorias"}</option>
              <option value="fiscal">{getGeneralAlertCategoryLabel("fiscal", locale)}</option>
              <option value="laboral">{getGeneralAlertCategoryLabel("laboral", locale)}</option>
              <option value="facturacion">{getGeneralAlertCategoryLabel("facturacion", locale)}</option>
            </select>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {filteredAlerts.length === 0 && (
              <div className="advisor-card-muted p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                {locale === "en" ? "No alerts with the current filter." : "No hay alertas para el filtro actual."}
              </div>
            )}
            {filteredAlerts.map((alert) => {
              const dueLabel = getGeneralAlertDueLabel(alert.due_date, locale);
              return (
                <div key={alert.id} className="advisor-card-muted p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadgeClass(alert.priority)}`}>
                          {getGeneralAlertPriorityLabel(alert.priority, locale)}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
                          {getGeneralAlertCategoryLabel(alert.category, locale)}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
                          {getStatusLabel(alert.status, locale)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{alert.title}</p>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {alert.message || (locale === "en" ? "No detail." : "Sin detalle.")}
                      </p>
                    </div>
                    {!alert.read_at && alert.status === "pending" && (
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--advisor-accent)]" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {alert.due_date && <span>{formatDate(alert.due_date, locale)}</span>}
                    {dueLabel && <span>{dueLabel}</span>}
                    <span>{alert.source}</span>
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
    </div>
  );
}
