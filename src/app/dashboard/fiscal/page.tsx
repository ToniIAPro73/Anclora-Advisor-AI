import { redirect } from "next/navigation";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import { buildProactiveFiscalAlerts } from "@/lib/alerts/proactive-alerts";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type FiscalAlert = {
  id: string;
  alert_type: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
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

function computeQuotaCeroState(alerts: FiscalAlert[]) {
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

export default async function DashboardFiscalPage() {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();

  if (!user || !accessToken) {
    redirect("/login");
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("fiscal_alerts")
    .select("id, alert_type, description, due_date, priority, status")
    .order("due_date", { ascending: true })
    .limit(40);

  const alerts = (data ?? []) as FiscalAlert[];
  const quotaCero = computeQuotaCeroState(alerts);
  const timelineItems = alerts.filter((alert) => alert.alert_type === "iva" || alert.alert_type === "irpf");
  const proactiveAlerts = buildProactiveFiscalAlerts(alerts);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="advisor-card p-6 lg:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Panel Fiscal</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Seguimiento operativo de Cuota Cero y obligaciones de IVA/IRPF con datos del usuario autenticado.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Cuota Cero</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">{quotaCero.label}</p>
            <p className="mt-1 text-sm text-[#3a4f67]">{quotaCero.detail}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
              <div className="h-2 rounded-full bg-[#1dab89]" style={{ width: `${quotaCero.progress}%` }} />
            </div>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Timeline fiscal</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">
              {timelineItems.length > 0 ? `${timelineItems.length} vencimiento(s)` : "Sin vencimientos"}
            </p>
            <p className="mt-1 text-sm text-[#3a4f67]">Modelos 303 (IVA) y 130 (IRPF) ordenados por fecha.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Alertas proactivas</p>
          {proactiveAlerts.length === 0 && (
            <div className="rounded-xl border border-[#d2dceb] bg-[#f6f9ff] p-4 text-sm text-[#3a4f67]">
              No hay alertas proactivas pendientes en este momento.
            </div>
          )}
          {proactiveAlerts.map((item) => (
            <div key={item.id} className="advisor-card-muted p-4">
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
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Proximos vencimientos</p>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No se pudieron cargar alertas fiscales: {error.message}
            </div>
          )}
          {!error && timelineItems.length === 0 && (
            <div className="rounded-xl border border-[#d2dceb] bg-[#f6f9ff] p-4 text-sm text-[#3a4f67]">
              No hay alertas fiscales (IVA/IRPF) registradas actualmente.
            </div>
          )}
          {!error &&
            timelineItems.map((item) => (
              <div key={item.id} className="advisor-card-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#162944]">
                      {item.alert_type === "iva" ? "Modelo 303 (IVA)" : "Modelo 130 (IRPF)"}
                    </p>
                    <p className="mt-1 text-sm text-[#3a4f67]">{item.description || "Sin descripcion"}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1c2b3c]">{formatDate(item.due_date)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getPriorityClass(item.priority)}`}>
                    prioridad: {item.priority}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(item.status)}`}>
                    estado: {item.status}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Resumen fiscal</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">{alerts.length} alerta(s) totales</p>
        <p className="mt-2 text-sm text-[#3a4f67]">{proactiveAlerts.length} alerta(s) proactivas priorizadas.</p>
        <p className="mt-3 text-sm text-[#3a4f67]">Vista filtrada por RLS para el usuario autenticado.</p>
      </aside>
    </section>
  );
}
