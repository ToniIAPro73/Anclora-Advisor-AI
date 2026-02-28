"use client";

import { useMemo, useState } from "react";
import {
  clampRiskScore,
  deriveRiskLevel,
  laborRiskLevelValues,
  type LaborRiskAssessmentRecord,
  type LaborRiskLevel,
} from "@/lib/labor/assessments";

interface LaborWorkspaceProps {
  initialAssessments: LaborRiskAssessmentRecord[];
}

type LaborFormState = {
  scenarioDescription: string;
  riskScore: string;
  riskLevel: LaborRiskLevel;
  recommendationsText: string;
};

const INITIAL_FORM: LaborFormState = {
  scenarioDescription: "",
  riskScore: "0.35",
  riskLevel: "medium",
  recommendationsText: "",
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

function toPercentage(score: number): number {
  return Math.round(clampRiskScore(score) * 100);
}

function parseRecommendations(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toFormState(assessment: LaborRiskAssessmentRecord): LaborFormState {
  return {
    scenarioDescription: assessment.scenario_description,
    riskScore: assessment.risk_score.toFixed(2),
    riskLevel: deriveRiskLevel(assessment.risk_score, assessment.risk_level),
    recommendationsText: (assessment.recommendations ?? []).join("\n"),
  };
}

export function LaborWorkspace({ initialAssessments }: LaborWorkspaceProps) {
  const [assessments, setAssessments] = useState<LaborRiskAssessmentRecord[]>(initialAssessments);
  const [form, setForm] = useState<LaborFormState>(INITIAL_FORM);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingAssessmentId, setUpdatingAssessmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const latest = assessments[0] ?? null;
  const latestScore = latest ? toPercentage(latest.risk_score) : 0;
  const latestLevel = latest ? deriveRiskLevel(latest.risk_score, latest.risk_level) : "low";
  const highRiskCount = useMemo(
    () => assessments.filter((item) => deriveRiskLevel(item.risk_score, item.risk_level) !== "low").length,
    [assessments]
  );
  const criticalCount = useMemo(
    () => assessments.filter((item) => deriveRiskLevel(item.risk_score, item.risk_level) === "critical").length,
    [assessments]
  );

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingAssessmentId(null);
  }

  function startEditing(assessment: LaborRiskAssessmentRecord) {
    setForm(toFormState(assessment));
    setEditingAssessmentId(assessment.id);
    setError(null);
    setOkMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);

    try {
      const isEditing = Boolean(editingAssessmentId);
      const riskScore = clampRiskScore(Number.parseFloat(form.riskScore));
      const response = await fetch(
        isEditing ? `/api/labor-risk-assessments/${editingAssessmentId}` : "/api/labor-risk-assessments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioDescription: form.scenarioDescription.trim(),
            riskScore,
            riskLevel: form.riskLevel,
            recommendations: parseRecommendations(form.recommendationsText),
          }),
        }
      );

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        assessment?: LaborRiskAssessmentRecord;
      };

      if (!response.ok || !result.success || !result.assessment) {
        throw new Error(result.error ?? "No se pudo guardar la evaluacion laboral");
      }

      const savedAssessment = result.assessment;
      setAssessments((previous) => {
        const next = isEditing
          ? previous.map((item) => (item.id === savedAssessment.id ? savedAssessment : item))
          : [savedAssessment, ...previous];
        return [...next].sort((left, right) => right.created_at.localeCompare(left.created_at));
      });
      setOkMessage(isEditing ? "Evaluacion laboral actualizada." : "Evaluacion laboral registrada.");
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar evaluacion laboral");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(assessmentId: string) {
    if (!window.confirm("Se eliminara la evaluacion laboral. Esta accion no se puede deshacer.")) {
      return;
    }

    setUpdatingAssessmentId(assessmentId);
    setError(null);
    setOkMessage(null);

    try {
      const response = await fetch(`/api/labor-risk-assessments/${assessmentId}`, { method: "DELETE" });
      const result = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo eliminar la evaluacion laboral");
      }
      setAssessments((previous) => previous.filter((item) => item.id !== assessmentId));
      if (editingAssessmentId === assessmentId) {
        resetForm();
      }
      setOkMessage("Evaluacion laboral eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar evaluacion laboral");
    } finally {
      setUpdatingAssessmentId(null);
    }
  }

  const previewLevel = deriveRiskLevel(clampRiskScore(Number.parseFloat(form.riskScore)), form.riskLevel);
  const previewScore = toPercentage(Number.parseFloat(form.riskScore) || 0);

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
        <article className="advisor-card shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {editingAssessmentId ? "Editar evaluacion laboral" : "Nueva evaluacion laboral"}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">
                Registra escenarios de pluriactividad, estima riesgo y fija acciones de mitigacion.
              </p>
            </div>
            {editingAssessmentId && (
              <button
                type="button"
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="advisor-label" htmlFor="laborScenarioDescription">Escenario</label>
              <textarea
                id="laborScenarioDescription"
                className="advisor-input min-h-28 resize-y"
                value={form.scenarioDescription}
                onChange={(event) => setForm((current) => ({ ...current, scenarioDescription: event.target.value }))}
                placeholder="Ej. Mantengo empleo por cuenta ajena mientras inicio actividad como autonomo y publico contenido sectorial."
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="laborRiskScore">Risk score (0-1)</label>
                <input
                  id="laborRiskScore"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  className="advisor-input"
                  value={form.riskScore}
                  onChange={(event) => setForm((current) => ({ ...current, riskScore: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="advisor-label" htmlFor="laborRiskLevel">Nivel</label>
                <select
                  id="laborRiskLevel"
                  className="advisor-input"
                  value={form.riskLevel}
                  onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as LaborRiskLevel }))}
                >
                  {laborRiskLevelValues.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Preview</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xl font-semibold text-[#162944]">{previewScore}%</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(previewLevel)}`}>{previewLevel}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                <div className={`h-2 rounded-full ${getRiskBarClass(previewLevel)}`} style={{ width: `${previewScore}%` }} />
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="laborRecommendations">Recomendaciones (una por linea)</label>
              <textarea
                id="laborRecommendations"
                className="advisor-input min-h-32 resize-y"
                value={form.recommendationsText}
                onChange={(event) => setForm((current) => ({ ...current, recommendationsText: event.target.value }))}
                placeholder="Separar actividad comercial de la marca personal&#10;Revisar clausulas de exclusividad&#10;Documentar compatibilidad horaria"
              />
            </div>
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? "Guardando..." : editingAssessmentId ? "Actualizar evaluacion" : "Registrar evaluacion"}
            </button>
          </form>
        </article>

        <article className="advisor-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Resumen de riesgo</p>
          {!latest ? (
            <div className="mt-3 advisor-card-muted p-3 text-sm text-[#3a4f67]">No hay evaluaciones laborales registradas.</div>
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="advisor-card-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Ultima evaluacion</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-2xl font-semibold text-[#162944]">{latestScore}%</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(latestLevel)}`}>{latestLevel}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#3a4f67]">{formatDate(latest.created_at)}</p>
                </div>
                <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
                  <p>Evaluaciones totales: <strong className="text-[#162944]">{assessments.length}</strong></p>
                  <p className="mt-1">Riesgo medio/alto/critico: <strong className="text-[#162944]">{highRiskCount}</strong></p>
                  <p className="mt-1">Criticas: <strong className="text-[#162944]">{criticalCount}</strong></p>
                </div>
              </div>
              <div className="mt-4 advisor-card-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Escenario actual</p>
                <p className="mt-2 text-sm text-[#162944]">{latest.scenario_description}</p>
              </div>
            </>
          )}
        </article>
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <h3 className="advisor-heading text-2xl text-[#162944]">Historial laboral</h3>
          <p className="mt-1 text-sm text-[#3a4f67]">{assessments.length} evaluacion(es) registradas.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {assessments.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">Sin historial laboral disponible.</div>
          ) : (
            <div className="space-y-3">
              {assessments.map((assessment) => {
                const level = deriveRiskLevel(assessment.risk_score, assessment.risk_level);
                const score = toPercentage(assessment.risk_score);
                const isBusy = updatingAssessmentId === assessment.id;
                return (
                  <div key={assessment.id} className="advisor-card-muted p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#162944]">{assessment.scenario_description}</p>
                        <p className="mt-1 text-xs text-[#3a4f67]">{formatDate(assessment.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#162944]">{score}%</p>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(level)}`}>{level}</span>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                      <div className={`h-2 rounded-full ${getRiskBarClass(level)}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Recomendaciones</p>
                      {(assessment.recommendations ?? []).length === 0 ? (
                        <p className="text-sm text-[#3a4f67]">Sin recomendaciones registradas.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(assessment.recommendations ?? []).map((item, index) => (
                            <li key={`${assessment.id}-rec-${index}`} className="rounded-xl border border-[#d2dceb] bg-white px-3 py-2 text-sm text-[#162944]">{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => startEditing(assessment)}>
                        Editar
                      </button>
                      <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleDelete(assessment.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
