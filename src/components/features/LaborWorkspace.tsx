"use client";

import { useMemo, useState } from "react";
import {
  clampRiskScore,
  deriveRiskLevel,
  laborMitigationStatusValues,
  laborRiskLevelValues,
  type LaborMitigationActionRecord,
  type LaborMitigationStatus,
  type LaborRiskAssessmentRecord,
  type LaborRiskLevel,
} from "@/lib/labor/assessments";

interface LaborWorkspaceProps {
  initialAssessments: LaborRiskAssessmentRecord[];
  initialMitigationActions: LaborMitigationActionRecord[];
}

type LaborFormState = {
  scenarioDescription: string;
  riskScore: string;
  riskLevel: LaborRiskLevel;
  recommendationsText: string;
};

type MitigationFormState = {
  title: string;
  description: string;
  dueDate: string;
  status: LaborMitigationStatus;
};

const INITIAL_FORM: LaborFormState = {
  scenarioDescription: "",
  riskScore: "0.35",
  riskLevel: "medium",
  recommendationsText: "",
};

const INITIAL_MITIGATION_FORM: MitigationFormState = {
  title: "",
  description: "",
  dueDate: "",
  status: "pending",
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

function formatDateOnly(date: string | null): string {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function getMitigationStatusClass(status: string): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "in_progress") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "blocked") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
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

export function LaborWorkspace({ initialAssessments, initialMitigationActions }: LaborWorkspaceProps) {
  const [assessments, setAssessments] = useState<LaborRiskAssessmentRecord[]>(initialAssessments);
  const [mitigationActions, setMitigationActions] = useState<LaborMitigationActionRecord[]>(initialMitigationActions);
  const [form, setForm] = useState<LaborFormState>(INITIAL_FORM);
  const [mitigationForm, setMitigationForm] = useState<MitigationFormState>(INITIAL_MITIGATION_FORM);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(initialAssessments[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [mitigationSubmitting, setMitigationSubmitting] = useState(false);
  const [updatingAssessmentId, setUpdatingAssessmentId] = useState<string | null>(null);
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
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

  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId) ?? latest ?? null;
  const selectedActions = useMemo(
    () => mitigationActions.filter((item) => item.assessment_id === selectedAssessment?.id),
    [mitigationActions, selectedAssessment]
  );
  const pendingActions = selectedActions.filter((item) => item.status === "pending").length;
  const inProgressActions = selectedActions.filter((item) => item.status === "in_progress").length;
  const completedActions = selectedActions.filter((item) => item.status === "completed").length;

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingAssessmentId(null);
  }

  function resetMitigationForm() {
    setMitigationForm(INITIAL_MITIGATION_FORM);
  }

  function startEditing(assessment: LaborRiskAssessmentRecord) {
    setForm(toFormState(assessment));
    setEditingAssessmentId(assessment.id);
    setSelectedAssessmentId(assessment.id);
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
      setSelectedAssessmentId(savedAssessment.id);
      setOkMessage(isEditing ? "Evaluacion laboral actualizada." : "Evaluacion laboral registrada.");
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar evaluacion laboral");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAssessment(assessmentId: string) {
    if (!window.confirm("Se eliminara la evaluacion laboral y sus mitigaciones asociadas. Esta accion no se puede deshacer.")) {
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
      setMitigationActions((previous) => previous.filter((item) => item.assessment_id !== assessmentId));
      if (editingAssessmentId === assessmentId) {
        resetForm();
      }
      if (selectedAssessmentId === assessmentId) {
        const nextAssessment = assessments.find((item) => item.id !== assessmentId) ?? null;
        setSelectedAssessmentId(nextAssessment?.id ?? null);
      }
      setOkMessage("Evaluacion laboral eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar evaluacion laboral");
    } finally {
      setUpdatingAssessmentId(null);
    }
  }

  async function handleCreateMitigation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssessment) {
      setError("Selecciona una evaluacion antes de crear mitigaciones.");
      return;
    }

    setMitigationSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/labor-risk-assessments/${selectedAssessment.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mitigationForm.title.trim(),
          description: mitigationForm.description.trim() || null,
          dueDate: mitigationForm.dueDate || null,
          status: mitigationForm.status,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };

      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo crear la mitigacion");
      }

      setMitigationActions((previous) => [result.action as LaborMitigationActionRecord, ...previous]);
      resetMitigationForm();
      setOkMessage("Accion de mitigacion creada.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al crear mitigacion");
    } finally {
      setMitigationSubmitting(false);
    }
  }

  async function handleMitigationStatusChange(actionId: string, status: LaborMitigationStatus) {
    setUpdatingActionId(actionId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/labor-mitigation-actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };
      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo actualizar la mitigacion");
      }
      const savedAction = result.action;
      setMitigationActions((previous) => previous.map((item) => (item.id === savedAction.id ? savedAction : item)));
      setOkMessage(`Mitigacion marcada como ${status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar mitigacion");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleDeleteMitigation(actionId: string) {
    if (!window.confirm("Se eliminara la accion de mitigacion. Esta accion no se puede deshacer.")) {
      return;
    }

    setUpdatingActionId(actionId);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/labor-mitigation-actions/${actionId}`, { method: "DELETE" });
      const result = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo eliminar la mitigacion");
      }
      setMitigationActions((previous) => previous.filter((item) => item.id !== actionId));
      setOkMessage("Mitigacion eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar mitigacion");
    } finally {
      setUpdatingActionId(null);
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
                Registra escenarios de pluriactividad, estima riesgo y fija mitigaciones seguibles.
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
          <h3 className="advisor-heading text-2xl text-[#162944]">Seguimiento laboral</h3>
          <p className="mt-1 text-sm text-[#3a4f67]">Selecciona una evaluacion y gestiona sus mitigaciones.</p>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-h-0 overflow-y-auto space-y-3 pr-1">
            {assessments.length === 0 ? (
              <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">Sin historial laboral disponible.</div>
            ) : (
              assessments.map((assessment) => {
                const level = deriveRiskLevel(assessment.risk_score, assessment.risk_level);
                const score = toPercentage(assessment.risk_score);
                const isBusy = updatingAssessmentId === assessment.id;
                const isSelected = selectedAssessment?.id === assessment.id;
                const actionCount = mitigationActions.filter((item) => item.assessment_id === assessment.id).length;
                return (
                  <div
                    key={assessment.id}
                    className={`advisor-card-muted p-4 cursor-pointer ${isSelected ? "ring-2 ring-[#1dab89]" : ""}`}
                    onClick={() => setSelectedAssessmentId(assessment.id)}
                  >
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
                    <p className="mt-3 text-xs text-[#3a4f67]">Mitigaciones: {actionCount}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={(event) => { event.stopPropagation(); startEditing(assessment); }}>
                        Editar
                      </button>
                      <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={(event) => { event.stopPropagation(); handleDeleteAssessment(assessment.id); }}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="min-h-0 overflow-y-auto space-y-3">
            {!selectedAssessment ? (
              <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">Selecciona una evaluacion para gestionar mitigaciones.</div>
            ) : (
              <>
                <article className="advisor-card-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Mitigacion activa</p>
                  <p className="mt-2 text-sm font-semibold text-[#162944]">{selectedAssessment.scenario_description}</p>
                  <div className="mt-3 grid gap-2 text-sm text-[#3a4f67] sm:grid-cols-3">
                    <p>Pendientes: <strong className="text-[#162944]">{pendingActions}</strong></p>
                    <p>En curso: <strong className="text-[#162944]">{inProgressActions}</strong></p>
                    <p>Completadas: <strong className="text-[#162944]">{completedActions}</strong></p>
                  </div>
                </article>

                <article className="advisor-card p-4">
                  <h4 className="advisor-heading text-xl text-[#162944]">Nueva mitigacion</h4>
                  <form className="mt-3 space-y-3" onSubmit={handleCreateMitigation}>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationTitle">Titulo</label>
                      <input id="mitigationTitle" className="advisor-input" value={mitigationForm.title} onChange={(event) => setMitigationForm((current) => ({ ...current, title: event.target.value }))} required />
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationDescription">Descripcion</label>
                      <textarea id="mitigationDescription" className="advisor-input min-h-24 resize-y" value={mitigationForm.description} onChange={(event) => setMitigationForm((current) => ({ ...current, description: event.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="advisor-label" htmlFor="mitigationDueDate">Fecha objetivo</label>
                        <input id="mitigationDueDate" type="date" className="advisor-input" value={mitigationForm.dueDate} onChange={(event) => setMitigationForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      </div>
                      <div>
                        <label className="advisor-label" htmlFor="mitigationStatus">Estado</label>
                        <select id="mitigationStatus" className="advisor-input" value={mitigationForm.status} onChange={(event) => setMitigationForm((current) => ({ ...current, status: event.target.value as LaborMitigationStatus }))}>
                          {laborMitigationStatusValues.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button type="submit" disabled={mitigationSubmitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
                      {mitigationSubmitting ? "Guardando..." : "Crear mitigacion"}
                    </button>
                  </form>
                </article>

                <article className="advisor-card p-4">
                  <h4 className="advisor-heading text-xl text-[#162944]">Acciones</h4>
                  <div className="mt-3 space-y-3">
                    {selectedActions.length === 0 ? (
                      <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">No hay mitigaciones registradas para esta evaluacion.</div>
                    ) : (
                      selectedActions.map((action) => {
                        const isBusy = updatingActionId === action.id;
                        return (
                          <div key={action.id} className="advisor-card-muted p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[#162944]">{action.title}</p>
                                <p className="mt-1 text-sm text-[#3a4f67]">{action.description || "Sin descripcion operativa."}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getMitigationStatusClass(action.status)}`}>
                                {action.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[#3a4f67]">Objetivo: {formatDateOnly(action.due_date)}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {action.status !== "in_progress" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "in_progress")}>
                                  En curso
                                </button>
                              )}
                              {action.status !== "completed" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "completed")}>
                                  Completar
                                </button>
                              )}
                              {action.status !== "blocked" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "blocked")}>
                                  Bloquear
                                </button>
                              )}
                              {action.status !== "pending" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "pending")}>
                                  Reabrir
                                </button>
                              )}
                              <button type="button" disabled={isBusy} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => handleDeleteMitigation(action.id)}>
                                Eliminar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
