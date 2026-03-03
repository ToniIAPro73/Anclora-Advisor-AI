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
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";

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
const ALERTS_PER_PAGE = 4;

function getPermissionState(): PermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

function getStatusLabel(status: string, locale: "es" | "en"): string {
  if (status === "resolved") {
    return locale === "en" ? "Resolved" : "Resuelta";
  }
  return locale === "en" ? "Pending" : "Pendiente";
}

function getCategoryAccent(category: GeneralAlertCategory): { icon: string; color: string; bg: string } {
  if (category === "fiscal") {
    return { icon: "▲", color: "#f5c542", bg: "rgba(245, 197, 66, 0.14)" };
  }
  if (category === "laboral") {
    return { icon: "●", color: "#8ab4ff", bg: "rgba(138, 180, 255, 0.14)" };
  }
  return { icon: "■", color: "#48d597", bg: "rgba(72, 213, 151, 0.14)" };
}

function formatDate(value: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function GeneralAlertCenter({ locale }: GeneralAlertCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const { sidebarCollapsed } = useAppPreferences();
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
  const [currentPage, setCurrentPage] = useState(1);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; right: number } | null>(null);

  const sortedAlerts = useMemo(() => sortGeneralAlerts(alerts), [alerts]);
  const filteredAlerts = useMemo(
    () => sortedAlerts.filter((alert) => categoryFilter === "all" || alert.category === categoryFilter),
    [categoryFilter, sortedAlerts]
  );
  const unreadCount = useMemo(
    () => sortedAlerts.filter((alert) => alert.status === "pending" && !alert.read_at).length,
    [sortedAlerts]
  );
  const activeReminders = useMemo(() => reminders.filter((reminder) => reminder.is_active), [reminders]);
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ALERTS_PER_PAGE));
  const pagedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * ALERTS_PER_PAGE;
    return filteredAlerts.slice(startIndex, startIndex + ALERTS_PER_PAGE);
  }, [currentPage, filteredAlerts]);
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
    setCurrentPage(1);
  }, [categoryFilter, isOpen]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePanelStyle() {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const isDesktop = window.innerWidth >= 768;
      const left = isDesktop ? (sidebarCollapsed ? 108 : 306) : 16;
      setPanelStyle({
        top: Math.round(triggerRect.bottom + 12),
        left,
        right: 16,
      });
    }

    updatePanelStyle();
    window.addEventListener("resize", updatePanelStyle);
    window.addEventListener("scroll", updatePanelStyle, true);

    return () => {
      window.removeEventListener("resize", updatePanelStyle);
      window.removeEventListener("scroll", updatePanelStyle, true);
    };
  }, [isOpen, sidebarCollapsed]);

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

  async function markCurrentPageAsRead() {
    const unreadAlerts = pagedAlerts.filter((alert) => alert.status === "pending" && !alert.read_at);
    if (unreadAlerts.length === 0) {
      return;
    }

    await Promise.all(unreadAlerts.map((alert) => toggleRead(alert, true)));
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
        ref={triggerRef}
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

      {isOpen && panelStyle && (
        <div
          className="fixed z-[120] flex w-auto max-w-none flex-col overflow-hidden rounded-[28px] border"
          style={{
            top: panelStyle.top,
            left: panelStyle.left,
            right: panelStyle.right,
            borderColor: "var(--advisor-border)",
            background: "var(--advisor-panel)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--advisor-border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {locale === "en" ? "Notifications" : "Notificaciones"}
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {unreadCount} {locale === "en" ? "unread" : "sin leer"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 text-sm font-semibold"
                  style={{ color: "#e8c547" }}
                  onClick={() => void markCurrentPageAsRead().catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al marcar alertas"))}
                >
                  {locale === "en" ? "Mark page" : "Marcar página"}
                </button>
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
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "fiscal", "laboral", "facturacion"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border px-4 py-2 text-xs font-semibold transition"
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

          <div className="flex flex-col gap-4 px-4 py-4">
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
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--advisor-border)" }}>
                {pagedAlerts.map((alert, index) => {
                  const dueLabel = getGeneralAlertDueLabel(alert.due_date, locale);
                  const accent = getCategoryAccent(alert.category as GeneralAlertCategory);
                  return (
                    <article
                      key={alert.id}
                      className={`flex min-h-[132px] items-start gap-4 px-5 py-4 ${index !== pagedAlerts.length - 1 ? "border-b" : ""}`}
                      style={{
                        borderColor: "var(--advisor-border)",
                        background: !alert.read_at && alert.status === "pending"
                          ? "color-mix(in srgb, var(--advisor-panel) 84%, #22306b)"
                          : "transparent",
                      }}
                    >
                      <div
                        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                        style={{ color: accent.color, background: accent.bg }}
                      >
                        {accent.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                              {getGeneralAlertCategoryLabel(alert.category, locale)}
                            </p>
                            <p className="mt-2 text-lg font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                              {alert.title}
                            </p>
                            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                              {alert.message || dueLabel || (locale === "en" ? "Operational alert" : "Aviso operativo")}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                              <span>{alert.due_date ? formatDate(alert.due_date, locale) : getStatusLabel(alert.status, locale)}</span>
                              {dueLabel && <span>{dueLabel}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-3">
                            {!alert.read_at && alert.status === "pending" && (
                              <span className="mt-1 h-3 w-3 rounded-full bg-[#e8c547]" />
                            )}
                            <div className="flex flex-wrap justify-end gap-2">
                              {!alert.read_at && (
                                <button
                                  type="button"
                                  className="rounded-xl border px-3 py-2 text-xs font-semibold"
                                  style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                                  onClick={() => void toggleRead(alert, true).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al actualizar lectura"))}
                                >
                                  {locale === "en" ? "Mark read" : "Marcar leída"}
                                </button>
                              )}
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
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {filteredAlerts.length > ALERTS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition"
                    style={{
                      background: currentPage === page ? "#e8c547" : "transparent",
                      color: currentPage === page ? "#18243d" : "var(--text-secondary)",
                      border: currentPage === page ? "none" : "1px solid var(--advisor-border)",
                    }}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--advisor-border)" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  {locale === "en" ? "Recurring reminders" : "Recordatorios recurrentes"}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {activeReminders.length > 0
                    ? locale === "en"
                      ? `${activeReminders.length} active reminders ready in the alerts center`
                      : `${activeReminders.length} recordatorios activos listos en el centro de alertas`
                    : locale === "en"
                      ? "No active recurring reminders"
                      : "No hay recordatorios recurrentes activos"}
                </p>
                {activeReminders[0] && (
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {activeReminders[0].title} · {getReminderRecurrenceLabel(activeReminders[0].recurrence, locale)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeReminders[0] && (
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--advisor-border)", color: "var(--text-secondary)" }}
                    onClick={() => void toggleReminder(activeReminders[0], !activeReminders[0].is_active).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Error al actualizar recordatorio"))}
                  >
                    {activeReminders[0].is_active
                      ? (locale === "en" ? "Pause next" : "Pausar siguiente")
                      : (locale === "en" ? "Activate next" : "Activar siguiente")}
                  </button>
                )}
                <button
                  type="button"
                  className="advisor-btn advisor-btn-primary px-3 py-2 text-xs"
                  onClick={() => {
                    window.location.href = "/dashboard/alertas";
                    setIsOpen(false);
                  }}
                >
                  {locale === "en" ? "Open alerts center" : "Abrir centro de alertas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
