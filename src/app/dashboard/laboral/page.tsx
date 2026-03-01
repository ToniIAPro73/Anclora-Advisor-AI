import { redirect } from "next/navigation";
import type { AuditLogRecord } from "@/lib/audit/logs";
import { LaborWorkspace } from "@/components/features/LaborWorkspace";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import {
  LABOR_MITIGATION_SELECT_FIELDS,
  type LaborMitigationActionRecord,
  type LaborRiskAssessmentRecord,
} from "@/lib/labor/assessments";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

interface DashboardLaboralPageProps {
  searchParams?: Promise<{
    scenario?: string;
    owner?: string;
    actionStatus?: string;
    slaState?: string;
    assessmentId?: string;
  }>;
}

export default async function DashboardLaboralPage({ searchParams }: DashboardLaboralPageProps) {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();

  if (!user || !accessToken) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("labor_risk_assessments")
    .select("id, scenario_description, risk_score, risk_level, recommendations, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: mitigationData, error: mitigationError } = await supabase
    .from("labor_mitigation_actions")
    .select(LABOR_MITIGATION_SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(120);

  const { data: auditData, error: auditError } = await supabase
    .from("app_audit_logs")
    .select("id, user_id, domain, entity_type, entity_id, action, summary, metadata, created_at")
    .eq("domain", "labor")
    .order("created_at", { ascending: false })
    .limit(8);

  const assessments = (data ?? []) as LaborRiskAssessmentRecord[];
  const mitigationActions = (mitigationData ?? []) as unknown as LaborMitigationActionRecord[];
  const auditLogs = (auditData ?? []) as unknown as AuditLogRecord[];
  const combinedError = error?.message ?? mitigationError?.message ?? auditError?.message ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Monitor Laboral</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Workspace operativo para registrar escenarios de pluriactividad, estimar riesgo y seguir mitigaciones con SLA, checklist y evidencias.
        </p>
        {combinedError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se pudieron cargar datos laborales: {combinedError}
          </div>
        )}
      </article>
      <LaborWorkspace
        initialAssessments={assessments}
        initialMitigationActions={mitigationActions}
        initialAuditLogs={auditLogs}
        initialFilters={{
          scenarioQuery: params.scenario ?? "",
          ownerQuery: params.owner ?? "",
          actionStatus:
            params.actionStatus === "pending" ||
            params.actionStatus === "in_progress" ||
            params.actionStatus === "completed" ||
            params.actionStatus === "blocked"
              ? params.actionStatus
              : "all",
          slaState:
            params.slaState === "ok" ||
            params.slaState === "warning" ||
            params.slaState === "breached"
              ? params.slaState
              : "all",
        }}
        initialSelectedAssessmentId={params.assessmentId ?? null}
      />
    </section>
  );
}
