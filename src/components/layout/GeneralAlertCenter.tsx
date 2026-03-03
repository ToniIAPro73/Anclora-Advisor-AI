"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type GeneralAlertCenterProps = {
  locale: "es" | "en";
};

type PermissionState = "default" | "granted" | "denied" | "unsupported";
type AlertCategoryFilter = "all" | GeneralAlertCategory;

type ManualAlertForm = {
  title: string;
  message: string;
  category: GeneralAlertCategory;
  priority: GeneralAlertPriority;
  dueDate: string;
  recurrence: "none" | GeneralAlertReminderRecurrence;
  leadDays: string;
};

const INITIAL_FORM: ManualAlertForm = {
  title: "",
  message: "",
  category: "fiscal",
  priority: "medium",
  dueDate: "",
  recurrence: "none",
  leadDays: "7",
};

function getPermissionState(): PermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

function getPriorityBadgeClass(priority: string): string {
  if (priority === "critical") return "border-red-300 bg-red-50 text-red-700";
  if (priority === "high") return "border-orange-300 bg-orange-50 text-orange-700";
  if (priority === "medium") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function getStatusLabel(status: string, locale: "es" | "en"): string {
  if (status === "resolved") {
    return locale === "en" ? "Resolved" : "Resuelta";
  }
  return locale === "en" ? "Pending" : "Pendiente";
}

function formatDate(value: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getAlertGroupKey(alert: GeneralAlertRecord, now = new Date()): "overdue" | "today" | "week" | "later" | "resolved" {
  if (alert.status === "resolved") {
    return "resolved";
  }

  if (!alert.due_date) {
    return "later";
  }

  const due = startOfDay(new Date(alert.due_date));
  const base = startOfDay(now);
  const diffDays = Math.round((due.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

function getAlertGroupLabel(group: "overdue" | "today" | "week" | "later" | "resolved", locale: "es" | "en"): string {
  if (group === "overdue") return locale === "en" ? "Overdue" : "Vencidas";
  if (group === "today") return locale === "en" ? "Today" : "Hoy";
  if (group === "week") return locale === "en" ? "This week" : "Esta semana";
  if (group === "later") return locale === "en" ? "Later" : "Proximas";
  return locale === "en" ? "Resolved" : "Resueltas";
}

export function GeneralAlertCenter({ locale }: GeneralAlertCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<GeneralAlertRecord[]>([]);
  const [reminders, setReminders] = useState<GeneralAlertReminderRecord[]>([]);
  const [permission, setPermission] = useState<PermissionState>(getPermissionState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<ManualAlertForm>(INITIAL_FORM);
  const [categoryFilter, setCategoryFilter] = useState<AlertCategoryFilter>("all");

  const sortedAlerts = useMemo(() => sortGeneralAlerts(alerts), [alerts]);
  const filteredAlerts = useMemo(
    () => sortedAlerts.filter((alert) => categoryFilter === "all" || alert.category === categoryFilter),
    [categoryFilter, sortedAlerts]
  );
  const groupedAlerts = useMemo(() => {
    const order: Array<"overdue" | "today" | "week" | "later" | "resolved"> = ["overdue", "today", "week", "later", "resolved"];
    return order
      .map((group) => ({
        group,
        items: filteredAlerts.filter((alert) => getAlertGroupKey(alert) === group),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [filteredAlerts]);
  const unreadCount = useMemo(
    () => sortedAlerts.filter((alert) => alert.status === "pending" && !alert.read_at).length,
    [sortedAlerts]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadAlerts(initial = false) {
      try {
        const [alertsResponse, remindersResponse] = await Promise.all([
          fetch("/api/general-alerts?includeResolved=true&limit=24", {
            cache: "no-store",
          }),
          fetch("/api/general-alert-reminders", {
            cache: "no-store",
          }),
        ]);
        const alertsResult = (await alertsResponse.json()) as {
          success: boolean;
          alerts?: GeneralAlertRecord[];
          error?: string;
        };
        const remindersResult = (await remindersResponse.json()) as {
          success: boolean;
          reminders?: GeneralAlertReminderRecord[];
          error?: string;
        };

        if (!alertsResponse.ok || !alertsResult.success || !alertsResult.alerts) {
          throw new Error(alertsResult.error ?? "No se pudieron cargar las alertas");
        }
        if (!remindersResponse.ok || !remindersResult.success || !remindersResult.reminders) {
          throw new Error(remindersResult.error ?? "No se pudieron cargar los recordatorios");
        }

        setAlerts(alertsResult.alerts);
        setReminders(remindersResult.reminders);
        setPermission(getPermissionState());
        if (initial) {
          seenAlertIdsRef.current = new Set(alertsResult.alerts.map((alert) => alert.id));
          return;
        }

        if (permission === "granted") {
          const newAlerts = alertsResult.alerts.filter(
            (alert) => alert.status === "pending" && !alert.read_at && !seenAlertIdsRef.current.has(alert.id)
          );
          for (const alert of newAlerts.slice(0, 3)) {
            const browserNotification = new Notification(alert.title, {
              body: alert.message ?? getGeneralAlertDueLabel(alert.due_date, locale) ?? "",
            });
            browserNotification.onclick = () => {
              window.focus();
              if (alert.link_href) {
                window.location.href = alert.link_href;
              }
            };
          }
        }

        seenAlertIdsRef.current = new Set(alertsResult.alerts.map((alert) => alert.id));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error al cargar alertas");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAlerts(true);
    const intervalId = window.setInterval(() => {
      void loadAlerts();
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadAlerts();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [locale, permission]);

  async function toggleRead(alert: GeneralAlertRecord, read: boolean) {
    const response = await fetch(`/api/general-alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    const result = (await response.json()) as {
      success: boolean;
      alert?: GeneralAlertRecord;
      error?: string;
    };

    if (!response.ok || !result.success || !result.alert) {
      throw new Error(result.error ?? "No se pudo actualizar la alerta");
    }

    setAlerts((current) => current.map((item) => (item.id === result.alert!.id ? result.alert! : item)));
  }

  async function resolveManualAlert(alert: GeneralAlertRecord) {
    const response = await fetch(`/api/general-alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", read: true }),
    });
    const result = (await response.json()) as {
      success: boolean;
      alert?: GeneralAlertRecord;
      error?: string;
    };

    if (!response.ok || !result.success || !result.alert) {
      throw new Error(result.error ?? "No se pudo resolver la alerta");
    }

    setAlerts((current) => current.map((item) => (item.id === result.alert!.id ? result.alert! : item)));
  }

  async function handleCreateAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
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
        const result = (await response.json()) as {
          success: boolean;
          alert?: GeneralAlertRecord;
          error?: string;
        };

        if (!response.ok || !result.success || !result.alert) {
          throw new Error(result.error ?? "No se pudo crear la alerta");
        }

        setAlerts((current) => sortGeneralAlerts([result.alert!, ...current]));
      } else {
        const anchorDate = form.dueDate || new Date().toISOString().slice(0, 10);
        const response = await fetch("/api/general-alert-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            message: form.message,
            category: form.category,
            priority: form.priority,
            recurrence: form.recurrence,
            anchorDate,
            leadDays: Number.parseInt(form.leadDays, 10),
          }),
        });
        const result = (await response.json()) as {
          success: boolean;
          reminder?: GeneralAlertReminderRecord;
          error?: string;
        };

        if (!response.ok || !result.success || !result.reminder) {
          throw new Error(result.error ?? "No se pudo crear el recordatorio recurrente");
        }

        setReminders((current) => [result.reminder!, ...current]);
      }
      setForm(INITIAL_FORM);
      setShowComposer(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al crear alerta");
    } finally {
      setIsSaving(false);
    }
  }

  async function requestBrowserNotifications() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  async function toggleReminder(reminder: GeneralAlertReminderRecord, isActive: boolean) {
    const response = await fetch(`/api/general-alert-reminders/${reminder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const result = (await response.json()) as {
      success: boolean;
      reminder?: GeneralAlertReminderRecord;
      error?: string;
    };

    if (!response.ok || !result.success || !result.reminder) {
      throw new Error(result.error ?? "No se pudo actualizar el recordatorio");
    }

    setReminders((current) => current.map((item) => (item.id === result.reminder!.id ? result.reminder! : item)));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="advisor-icon-toggle relative"
        aria-label={locale === "en" ? "Notifications" : "Notificaciones"}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--advisor-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-30 mt-3 flex max-h-[min(80vh,42rem)] w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--advisor-border)",
            background: "var(--advisor-panel)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--advisor-border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="advisor-heading text-xl" style={{ color: "var(--text-primary)" }}>
                  {locale === "en" ? "Alert center" : "Centro de alertas"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {unreadCount} {locale === "en" ? "unread" : "sin leer"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{
                  borderColor: "var(--advisor-border)",
                  color: "var(--text-secondary)",
                }}
                onClick={() => setShowComposer((current) => !current)}
              >
                {showComposer ? (locale === "en" ? "Close" : "Cerrar") : (locale === "en" ? "New alert" : "Nueva alerta")}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "fiscal", "laboral", "facturacion"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition"
                  style={{
                    borderColor: "var(--advisor-border)",
                    background: categoryFilter === item ? "var(--advisor-accent)" : "transparent",
                    color: categoryFilter === item ? "var(--text-on-accent)" : "var(--text-secondary)",
                  }}
                  onClick={() => setCategoryFilter(item)}
                >
                  {item === "all" ? (locale === "en" ? "All" : "Todas") : getGeneralAlertCategoryLabel(item, locale)}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {permission !== "granted" && permission !== "unsupported" && (
                <button
                  type="button"
                  className="advisor-btn advisor-btn-primary px-3 py-2 text-xs"
                  onClick={() => void requestBrowserNotifications()}
                >
                  {locale === "en" ? "Enable browser notifications" : "Activar notificaciones del navegador"}
                </button>
              )}
              {permission === "granted" && (
                <span className="advisor-chip">{locale === "en" ? "Browser notifications active" : "Notificaciones del navegador activas"}</span>
              )}
              {permission === "denied" && (
                <span className="advisor-chip">{locale === "en" ? "Blocked by browser" : "Bloqueadas por el navegador"}</span>
              )}
            </div>

            {showComposer && (
              <form className="mt-4 space-y-2" onSubmit={handleCreateAlert}>
                <input
                  className="advisor-input"
                  value={form.title}
                  placeholder={locale === "en" ? "Alert title" : "Titulo de la alerta"}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
                <textarea
                  className="advisor-input min-h-20 resize-y"
                  value={form.message}
                  placeholder={locale === "en" ? "Operational detail" : "Detalle operativo"}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="advisor-input"
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as GeneralAlertCategory }))}
                  >
                    <option value="fiscal">{locale === "en" ? "Tax" : "Fiscal"}</option>
                    <option value="laboral">{locale === "en" ? "Labor" : "Laboral"}</option>
                    <option value="facturacion">{locale === "en" ? "Invoicing" : "Facturacion"}</option>
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
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="advisor-input"
                    value={form.recurrence}
                    onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as ManualAlertForm["recurrence"] }))}
                  >
                    <option value="none">{locale === "en" ? "One-time alert" : "Alerta puntual"}</option>
                    <option value="monthly">{locale === "en" ? "Monthly renewal" : "Renovacion mensual"}</option>
                    <option value="quarterly">{locale === "en" ? "Quarterly renewal" : "Renovacion trimestral"}</option>
                    <option value="yearly">{locale === "en" ? "Yearly renewal" : "Renovacion anual"}</option>
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
                <button type="submit" disabled={isSaving} className="advisor-btn advisor-btn-primary w-full">
                  {isSaving
                    ? (locale === "en" ? "Saving..." : "Guardando...")
                    : form.recurrence === "none"
                      ? (locale === "en" ? "Create alert" : "Crear alerta")
                      : (locale === "en" ? "Create recurring reminder" : "Crear recordatorio recurrente")}
                </button>
              </form>
            )}

            {error && <div className="advisor-alert advisor-alert-error mt-3">{error}</div>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {reminders.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  {locale === "en" ? "Recurring reminders" : "Recordatorios recurrentes"}
                </p>
                {reminders.map((reminder) => (
                  <article
                    key={reminder.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: "var(--advisor-border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {reminder.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <span>{getGeneralAlertCategoryLabel(reminder.category, locale)}</span>
                          <span>{getReminderRecurrenceLabel(reminder.recurrence, locale)}</span>
                          <span>{locale === "en" ? `${reminder.lead_days} day(s) before` : `${reminder.lead_days} dia(s) antes`}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                        onClick={() => void toggleReminder(reminder, !reminder.is_active).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al actualizar recordatorio"))}
                      >
                        {reminder.is_active
                          ? (locale === "en" ? "Pause" : "Pausar")
                          : (locale === "en" ? "Activate" : "Activar")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
                <span className="advisor-spinner" />
                {locale === "en" ? "Loading alerts..." : "Cargando alertas..."}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}>
                {locale === "en" ? "No active alerts." : "No hay alertas activas."}
              </div>
            ) : (
              <div className="space-y-3">
                {groupedAlerts.map(({ group, items }) => (
                  <section key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                        {getAlertGroupLabel(group, locale)}
                      </p>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{items.length}</span>
                    </div>
                    {items.map((alert) => {
                      const dueLabel = getGeneralAlertDueLabel(alert.due_date, locale);
                      return (
                        <article
                          key={alert.id}
                          className={`rounded-2xl border p-3 ${!alert.read_at && alert.status === "pending" ? "ring-1 ring-[var(--advisor-accent)]" : ""}`}
                          style={{ borderColor: "var(--advisor-border)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
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
                              <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                {alert.title}
                              </p>
                              {alert.message && (
                                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                                  {alert.message}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                                {alert.due_date && <span>{formatDate(alert.due_date, locale)}</span>}
                                {dueLabel && <span>{dueLabel}</span>}
                                <span>
                                  {alert.source === "manual"
                                    ? (locale === "en" ? "Manual" : "Manual")
                                    : alert.source === "reminder"
                                      ? (locale === "en" ? "Recurring" : "Recurrente")
                                      : (locale === "en" ? "Automatic" : "Automatica")}
                                </span>
                              </div>
                            </div>
                            {!alert.read_at && alert.status === "pending" && (
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--advisor-accent)]" />
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-xl border px-3 py-2 text-xs font-semibold"
                              style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                              onClick={() => void toggleRead(alert, !alert.read_at).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al actualizar lectura"))}
                            >
                              {alert.read_at
                                ? (locale === "en" ? "Mark unread" : "Marcar no leida")
                                : (locale === "en" ? "Mark read" : "Marcar leida")}
                            </button>
                            {(alert.source === "manual" || alert.source === "reminder") && alert.status === "pending" && (
                              <button
                                type="button"
                                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                                style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                                onClick={() => void resolveManualAlert(alert).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al resolver alerta"))}
                              >
                                {locale === "en" ? "Resolve" : "Resolver"}
                              </button>
                            )}
                            {alert.link_href && (
                              <button
                                type="button"
                                className="advisor-btn advisor-btn-primary px-3 py-2 text-xs"
                                onClick={() => {
                                  window.location.href = alert.link_href!;
                                  setIsOpen(false);
                                }}
                              >
                                {locale === "en" ? "Open" : "Abrir"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
