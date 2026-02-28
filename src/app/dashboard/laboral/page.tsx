import { redirect } from "next/navigation";
import { LaborWorkspace } from "@/components/features/LaborWorkspace";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import type { LaborRiskAssessmentRecord } from "@/lib/labor/assessments";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

export default async function DashboardLaboralPage() {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();

  if (!user || !accessToken) {
    redirect("/login");
  }

  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("labor_risk_assessments")
    .select("id, scenario_description, risk_score, risk_level, recommendations, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const assessments = (data ?? []) as LaborRiskAssessmentRecord[];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Monitor Laboral</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Workspace operativo para registrar escenarios de pluriactividad, estimar riesgo y fijar mitigaciones.
        </p>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se pudieron cargar evaluaciones laborales: {error.message}
          </div>
        )}
      </article>
      <LaborWorkspace initialAssessments={assessments} />
    </section>
  );
}
