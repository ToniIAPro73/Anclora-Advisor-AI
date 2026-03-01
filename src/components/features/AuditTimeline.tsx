"use client";

import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import type { AuditLogRecord } from "@/lib/audit/logs";
import { uiText } from "@/lib/i18n/ui";

interface AuditTimelineProps {
  title: string;
  logs: AuditLogRecord[];
}

function formatDateTime(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function AuditTimeline({ title, logs }: AuditTimelineProps) {
  const { locale } = useAppPreferences();

  return (
    <article className="advisor-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="advisor-heading text-xl" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{uiText(locale, "audit.subtitle")}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {logs.length === 0 ? (
          <div className="advisor-card-muted p-3 text-sm" style={{ color: "var(--text-secondary)" }}>{uiText(locale, "audit.empty")}</div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="advisor-card-muted p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{entry.summary}</p>
                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)", color: "var(--text-secondary)" }}>
                  {entry.action}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                {entry.entity_type}
                {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{formatDateTime(entry.created_at, locale)}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
