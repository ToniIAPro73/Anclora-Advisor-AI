import { redirect } from "next/navigation";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type LaborRiskAssessment = {
  id: string;
  scenario_description: string;
  risk_score: number;
  risk_level: string | null;
  recommendations: string[] | null;
  created_at: string;
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getRiskLevel(score: number, level?: string | null): string {
  if (level) return level.toLowerCase();
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function getRiskClass(level: string): string {
  if (level === "critical") return "bg-red-100 text-red-700 border-red-200";
  if (level === "high") return "bg-orange-100 text-orange-700 border-orange-200";
  if (level === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function getRiskBarClass(level: string): string {
  if (level === "critical") return "bg-red-500";
  if (level === "high") return "bg-orange-500";
  if (level === "medium") return "bg-amber-500";
  return "bg-emerald-500";
}

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
    .limit(30);

  const assessments = (data ?? []) as LaborRiskAssessment[];
  const latest = assessments[0] ?? null;
  const latestScore = latest ? Math.round(Math.max(0, Math.min(1, latest.risk_score)) * 100) : 0;
  const latestLevel = latest ? getRiskLevel(latest.risk_score, latest.risk_level) : "low";
  const recommendations = latest?.recommendations?.slice(0, 4) ?? [];
  const highRiskCount = assessments.filter((item) => getRiskLevel(item.risk_score, item.risk_level) !== "low").length;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="advisor-card p-6 lg:col-span-2">
        <h1 className="advisor-heading text-3xl text-[#162944]">Monitor Laboral</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Seguimiento de riesgo de pluriactividad y recomendaciones para minimizar conflicto laboral y reputacional.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No se pudieron cargar evaluaciones laborales: {error.message}
          </div>
        )}

        {!error && !latest && (
          <div className="mt-5 rounded-xl border border-[#d2dceb] bg-[#f6f9ff] p-4 text-sm text-[#3a4f67]">
            Aun no hay evaluaciones de riesgo laboral registradas para este usuario.
          </div>
        )}

        {!error && latest && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="advisor-card-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Risk score</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-2xl font-semibold text-[#162944]">{latestScore}%</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(latestLevel)}`}>
                    {latestLevel}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                  <div className={`h-2 rounded-full ${getRiskBarClass(latestLevel)}`} style={{ width: `${latestScore}%` }} />
                </div>
                <p className="mt-2 text-sm text-[#3a4f67]">Ultima evaluacion: {formatDate(latest.created_at)}</p>
              </div>
              <div className="advisor-card-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Escenario actual</p>
                <p className="mt-1 text-sm font-semibold text-[#162944]">{latest.scenario_description}</p>
                <p className="mt-2 text-sm text-[#3a4f67]">
                  {highRiskCount} evaluacion(es) en riesgo medio/alto/critico sobre {assessments.length} total(es).
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Recomendaciones clave</p>
              {recommendations.length === 0 ? (
                <p className="mt-2 text-sm text-[#3a4f67]">Sin recomendaciones asociadas en la ultima evaluacion.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recommendations.map((item, index) => (
                    <li key={`${latest.id}-rec-${index}`} className="advisor-card-muted p-3 text-sm text-[#162944]">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </article>
      <aside className="advisor-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Historial reciente</p>
        <p className="mt-1 text-xl font-semibold text-[#162944]">{assessments.length} evaluacion(es)</p>
        <div className="mt-4 space-y-3">
          {!error &&
            assessments.slice(0, 5).map((item) => {
              const level = getRiskLevel(item.risk_score, item.risk_level);
              const score = Math.round(Math.max(0, Math.min(1, item.risk_score)) * 100);
              return (
                <div key={item.id} className="advisor-card-muted p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#162944]">{score}%</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(level)}`}>
                      {level}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#3a4f67]">{formatDate(item.created_at)}</p>
                </div>
              );
            })}
          {!error && assessments.length === 0 && <p className="text-sm text-[#3a4f67]">Sin historial disponible.</p>}
        </div>
      </aside>
    </section>
  );
}
