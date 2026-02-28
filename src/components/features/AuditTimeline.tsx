"use client";

import type { AuditLogRecord } from "@/lib/audit/logs";

interface AuditTimelineProps {
  title: string;
  logs: AuditLogRecord[];
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function AuditTimeline({ title, logs }: AuditTimelineProps) {
  return (
    <article className="advisor-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="advisor-heading text-xl text-[#162944]">{title}</h3>
          <p className="mt-1 text-sm text-[#3a4f67]">Actividad reciente registrada para este modulo.</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {logs.length === 0 ? (
          <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">Sin actividad auditada todavia.</div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="advisor-card-muted p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#162944]">{entry.summary}</p>
                <span className="rounded-full border border-[#d2dceb] bg-white px-2 py-0.5 text-xs font-semibold text-[#3a4f67]">
                  {entry.action}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-[#3a4f67]">
                {entry.entity_type}
                {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}
              </p>
              <p className="mt-2 text-xs text-[#3a4f67]">{formatDateTime(entry.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

