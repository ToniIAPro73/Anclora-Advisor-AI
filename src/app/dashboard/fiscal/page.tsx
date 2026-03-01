import { redirect } from "next/navigation";
import type { AuditLogRecord } from "@/lib/audit/logs";
import { FiscalWorkspace } from "@/components/features/FiscalWorkspace";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import type { FiscalAlertRecord } from "@/lib/fiscal/alerts";
import type { FiscalAlertTemplateRecord } from "@/lib/fiscal/templates";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

export default async function DashboardFiscalPage() {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();

  if (!user || !accessToken) {
    redirect("/login");
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("fiscal_alerts")
    .select("id, alert_type, description, due_date, priority, status, workflow_status, presented_at, template_id, period_key, source, created_at")
    .order("due_date", { ascending: true })
    .limit(60);

  const { data: templateData, error: templateError } = await supabase
    .from("fiscal_alert_templates")
    .select("id, alert_type, description, priority, recurrence, due_day, due_month, start_date, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  const { data: auditData, error: auditError } = await supabase
    .from("app_audit_logs")
    .select("id, user_id, domain, entity_type, entity_id, action, summary, metadata, created_at")
    .eq("domain", "fiscal")
    .order("created_at", { ascending: false })
    .limit(8);

  const alerts = (data ?? []) as FiscalAlertRecord[];
  const templates = (templateData ?? []) as FiscalAlertTemplateRecord[];
  const auditLogs = (auditData ?? []) as unknown as AuditLogRecord[];
  const combinedError = error?.message ?? templateError?.message ?? auditError?.message ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Panel Fiscal</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Workspace operativo para crear, priorizar y cerrar alertas fiscales del usuario autenticado.
        </p>
        {combinedError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se pudieron cargar datos fiscales: {combinedError}
          </div>
        )}
      </article>
      <FiscalWorkspace initialAlerts={alerts} initialTemplates={templates} initialAuditLogs={auditLogs} />
    </section>
  );
}
