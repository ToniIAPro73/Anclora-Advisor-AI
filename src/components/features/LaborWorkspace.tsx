"use client";

import { useMemo, useState } from "react";
import { AuditTimeline } from "@/components/features/AuditTimeline";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import type { AuditLogRecord } from "@/lib/audit/logs";
import {
  clampRiskScore,
  deriveRiskLevel,
  laborMitigationStatusValues,
  laborRiskLevelValues,
  type LaborMitigationChecklistItem,
  type LaborMitigationEvidenceLink,
  type LaborMitigationActionRecord,
  type LaborMitigationStatus,
  type LaborRiskAssessmentRecord,
  type LaborRiskLevel,
} from "@/lib/labor/assessments";

interface LaborWorkspaceProps {
  initialAssessments: LaborRiskAssessmentRecord[];
  initialMitigationActions: LaborMitigationActionRecord[];
  initialAuditLogs: AuditLogRecord[];
  initialFilters?: Partial<AssessmentFilters>;
  initialSelectedAssessmentId?: string | null;
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
  slaDueAt: string;
  ownerName: string;
  ownerEmail: string;
  evidenceNotes: string;
  closureNotes: string;
  checklistText: string;
  evidenceLinksText: string;
  status: LaborMitigationStatus;
};

type AssessmentFilters = {
  scenarioQuery: string;
  ownerQuery: string;
  actionStatus: "all" | LaborMitigationStatus;
  slaState: "all" | "ok" | "warning" | "breached";
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
  slaDueAt: "",
  ownerName: "",
  ownerEmail: "",
  evidenceNotes: "",
  closureNotes: "",
  checklistText: "",
  evidenceLinksText: "",
  status: "pending",
};

const INITIAL_FILTERS: AssessmentFilters = {
  scenarioQuery: "",
  ownerQuery: "",
  actionStatus: "all",
  slaState: "all",
};

function formatDate(date: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDateOnly(date: string | null, locale: "es" | "en"): string {
  if (!date) return locale === "en" ? "No date" : "Sin fecha";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatBytes(sizeBytes: number | null | undefined, locale: "es" | "en"): string {
  if (!sizeBytes || sizeBytes <= 0) return locale === "en" ? "N/A" : "N/D";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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

function getRiskLabel(level: LaborRiskLevel | string, locale: "es" | "en"): string {
  if (level === "critical") return locale === "en" ? "Critical" : "Critico";
  if (level === "high") return locale === "en" ? "High" : "Alto";
  if (level === "medium") return locale === "en" ? "Medium" : "Medio";
  return locale === "en" ? "Low" : "Bajo";
}

function getMitigationStatusLabel(status: LaborMitigationStatus | string, locale: "es" | "en"): string {
  if (status === "in_progress") return locale === "en" ? "In progress" : "En curso";
  if (status === "completed") return locale === "en" ? "Completed" : "Completada";
  if (status === "blocked") return locale === "en" ? "Blocked" : "Bloqueada";
  return locale === "en" ? "Pending" : "Pendiente";
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

function createClientId(prefix: string, index: number): string {
  return `${prefix}_${index + 1}`;
}

function parseChecklistText(value: string): LaborMitigationChecklistItem[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: createClientId("check", index),
      label,
      completed: false,
      completedAt: null,
    }));
}

function formatChecklistText(items: LaborMitigationChecklistItem[] | null | undefined): string {
  return (items ?? []).map((item) => item.label).join("\n");
}

function parseEvidenceLinksText(value: string): LaborMitigationEvidenceLink[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [maybeLabel, maybeUrl] = line.includes("|")
        ? line.split("|").map((segment) => segment.trim())
        : [line, line];
      const url = maybeUrl || maybeLabel;
      const label = maybeUrl ? maybeLabel : `Evidencia ${index + 1}`;
      return {
        id: createClientId("evidence", index),
        label,
        url,
        addedAt: null,
      };
    })
    .filter((item) => /^https?:\/\//i.test(item.url));
}

function formatEvidenceLinksText(items: LaborMitigationEvidenceLink[] | null | undefined): string {
  return (items ?? []).map((item) => `${item.label} | ${item.url}`).join("\n");
}

function getChecklistProgress(items: LaborMitigationChecklistItem[] | null | undefined): { done: number; total: number } {
  const total = items?.length ?? 0;
  const done = (items ?? []).filter((item) => item.completed).length;
  return { done, total };
}

function getSlaState(action: LaborMitigationActionRecord): "ok" | "warning" | "breached" | "none" {
  if (!action.sla_due_at) return "none";
  if (action.status === "completed") return "ok";
  const slaDate = new Date(action.sla_due_at);
  const now = new Date();
  if (slaDate < now) return "breached";
  if (slaDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) return "warning";
  return "ok";
}

function getSlaClass(state: ReturnType<typeof getSlaState>): string {
  if (state === "breached") return "bg-red-100 text-red-700 border-red-200";
  if (state === "warning") return "bg-amber-100 text-amber-700 border-amber-200";
  if (state === "ok") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function toFormState(assessment: LaborRiskAssessmentRecord): LaborFormState {
  return {
    scenarioDescription: assessment.scenario_description,
    riskScore: assessment.risk_score.toFixed(2),
    riskLevel: deriveRiskLevel(assessment.risk_score, assessment.risk_level),
    recommendationsText: (assessment.recommendations ?? []).join("\n"),
  };
}

export function LaborWorkspace({
  initialAssessments,
  initialMitigationActions,
  initialAuditLogs,
  initialFilters,
  initialSelectedAssessmentId,
}: LaborWorkspaceProps) {
  const { locale } = useAppPreferences();
  const isEn = locale === "en";
  const [assessments, setAssessments] = useState<LaborRiskAssessmentRecord[]>(initialAssessments);
  const [mitigationActions, setMitigationActions] = useState<LaborMitigationActionRecord[]>(initialMitigationActions);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(initialAuditLogs);
  const [form, setForm] = useState<LaborFormState>(INITIAL_FORM);
  const [mitigationForm, setMitigationForm] = useState<MitigationFormState>(INITIAL_MITIGATION_FORM);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(initialSelectedAssessmentId ?? initialAssessments[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [mitigationSubmitting, setMitigationSubmitting] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [updatingAssessmentId, setUpdatingAssessmentId] = useState<string | null>(null);
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [filters, setFilters] = useState<AssessmentFilters>({ ...INITIAL_FILTERS, ...initialFilters });
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
  const filteredAssessments = useMemo(() => {
    const scenarioNeedle = filters.scenarioQuery.trim().toLowerCase();
    return assessments.filter((assessment) => {
      if (!scenarioNeedle) {
        return true;
      }
      return assessment.scenario_description.toLowerCase().includes(scenarioNeedle);
    });
  }, [assessments, filters.scenarioQuery]);
  const filteredActions = useMemo(() => {
    const ownerNeedle = filters.ownerQuery.trim().toLowerCase();
    return selectedActions.filter((action) => {
      if (filters.actionStatus !== "all" && action.status !== filters.actionStatus) {
        return false;
      }
      if (filters.slaState !== "all" && getSlaState(action) !== filters.slaState) {
        return false;
      }
      if (ownerNeedle) {
        const haystack = `${action.owner_name ?? ""} ${action.owner_email ?? ""}`.toLowerCase();
        if (!haystack.includes(ownerNeedle)) {
          return false;
        }
      }
      return true;
    });
  }, [selectedActions, filters.actionStatus, filters.ownerQuery, filters.slaState]);
  const pendingActions = filteredActions.filter((item) => item.status === "pending").length;
  const inProgressActions = filteredActions.filter((item) => item.status === "in_progress").length;
  const completedActions = filteredActions.filter((item) => item.status === "completed").length;
  const overdueActions = filteredActions.filter(
    (item) => item.status !== "completed" && item.due_date && new Date(item.due_date) < new Date()
  ).length;
  const slaBreachedActions = filteredActions.filter((item) => getSlaState(item) === "breached").length;
  const ownerStats = useMemo(() => {
    const stats = new Map<string, { owner: string; total: number; breached: number; warning: number; completed: number }>();
    for (const action of mitigationActions) {
      const owner = action.owner_name?.trim() || action.owner_email?.trim() || (locale === "en" ? "Unassigned" : "Sin asignar");
      const current = stats.get(owner) ?? { owner, total: 0, breached: 0, warning: 0, completed: 0 };
      current.total += 1;
      const slaState = getSlaState(action);
      current.breached += slaState === "breached" ? 1 : 0;
      current.warning += slaState === "warning" ? 1 : 0;
      current.completed += action.status === "completed" ? 1 : 0;
      stats.set(owner, current);
    }
    return Array.from(stats.values()).sort((left, right) => right.total - left.total).slice(0, 6);
  }, [mitigationActions]);

  async function refreshAuditLogs() {
    try {
      const response = await fetch("/api/audit-logs?domain=labor&limit=8", { cache: "no-store" });
      const result = (await response.json()) as { success: boolean; logs?: AuditLogRecord[] };
      if (response.ok && result.success && result.logs) {
        setAuditLogs(result.logs);
      }
    } catch {
      // Ignore audit refresh errors in UI.
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingAssessmentId(null);
  }

  function resetMitigationForm() {
    setMitigationForm(INITIAL_MITIGATION_FORM);
    setEditingActionId(null);
    setEvidenceLabel("");
    setEvidenceFile(null);
  }

  function startMitigationEditing(action: LaborMitigationActionRecord) {
    setEditingActionId(action.id);
    setMitigationForm({
      title: action.title,
      description: action.description ?? "",
      dueDate: action.due_date ?? "",
      slaDueAt: action.sla_due_at ?? "",
      ownerName: action.owner_name ?? "",
      ownerEmail: action.owner_email ?? "",
      evidenceNotes: action.evidence_notes ?? "",
      closureNotes: action.closure_notes ?? "",
      checklistText: formatChecklistText(action.checklist_items),
      evidenceLinksText: formatEvidenceLinksText(action.evidence_links),
      status: action.status as LaborMitigationStatus,
    });
    setEvidenceLabel("");
    setEvidenceFile(null);
    setError(null);
    setOkMessage(null);
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
      await refreshAuditLogs();
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
      await refreshAuditLogs();
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
      const isEditing = Boolean(editingActionId);
      const response = await fetch(
        isEditing ? `/api/labor-mitigation-actions/${editingActionId}` : `/api/labor-risk-assessments/${selectedAssessment.id}/actions`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: mitigationForm.title.trim(),
            description: mitigationForm.description.trim() || null,
            dueDate: mitigationForm.dueDate || null,
            slaDueAt: mitigationForm.slaDueAt || null,
            ownerName: mitigationForm.ownerName.trim() || null,
            ownerEmail: mitigationForm.ownerEmail.trim() || null,
            evidenceNotes: mitigationForm.evidenceNotes.trim() || null,
            closureNotes: mitigationForm.closureNotes.trim() || null,
            checklistItems: parseChecklistText(mitigationForm.checklistText),
            evidenceLinks: parseEvidenceLinksText(mitigationForm.evidenceLinksText),
            status: mitigationForm.status,
          }),
        }
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };

      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo guardar la mitigacion");
      }

      const savedAction = result.action as LaborMitigationActionRecord;
      setMitigationActions((previous) => {
        if (isEditing) {
          return previous.map((item) => (item.id === savedAction.id ? savedAction : item));
        }
        return [savedAction, ...previous];
      });
      resetMitigationForm();
      setOkMessage(isEditing ? "Accion de mitigacion actualizada." : "Accion de mitigacion creada.");
      await refreshAuditLogs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error al guardar mitigacion");
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
      await refreshAuditLogs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Error al actualizar mitigacion");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleChecklistToggle(action: LaborMitigationActionRecord, itemId: string) {
    setUpdatingActionId(action.id);
    setError(null);
    setOkMessage(null);
    try {
      const nextChecklist = (action.checklist_items ?? []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: !item.completed,
              completedAt: item.completed ? null : new Date().toISOString(),
            }
          : item
      );
      const response = await fetch(`/api/labor-mitigation-actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItems: nextChecklist }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };
      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo actualizar el checklist");
      }
      setMitigationActions((previous) =>
        previous.map((item) => (item.id === result.action?.id ? result.action : item))
      );
      setOkMessage("Checklist actualizado.");
      await refreshAuditLogs();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Error al actualizar checklist");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleEvidenceUpload() {
    if (!editingActionId || !evidenceFile) {
      setError("Selecciona una mitigacion y un archivo antes de subir evidencia.");
      return;
    }

    setUpdatingActionId(editingActionId);
    setError(null);
    setOkMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", evidenceFile);
      if (evidenceLabel.trim()) {
        formData.append("label", evidenceLabel.trim());
      }
      const response = await fetch(`/api/labor-mitigation-actions/${editingActionId}/evidence`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };
      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo subir la evidencia");
      }
      setMitigationActions((previous) => previous.map((item) => (item.id === result.action?.id ? result.action : item)));
      startMitigationEditing(result.action);
      setEvidenceLabel("");
      setEvidenceFile(null);
      setOkMessage("Evidencia subida correctamente.");
      await refreshAuditLogs();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Error al subir evidencia");
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleEvidenceDelete(action: LaborMitigationActionRecord, url: string) {
    setUpdatingActionId(action.id);
    setError(null);
    setOkMessage(null);
    try {
      const response = await fetch(`/api/labor-mitigation-actions/${action.id}/evidence`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        action?: LaborMitigationActionRecord;
      };
      if (!response.ok || !result.success || !result.action) {
        throw new Error(result.error ?? "No se pudo eliminar la evidencia");
      }
      setMitigationActions((previous) => previous.map((item) => (item.id === result.action?.id ? result.action : item)));
      if (editingActionId === action.id) {
        startMitigationEditing(result.action);
      }
      setOkMessage("Evidencia eliminada.");
      await refreshAuditLogs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar evidencia");
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
      await refreshAuditLogs();
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
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto pr-1 lg:col-span-2">
        <article className="advisor-card shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">
                {isEn ? (editingAssessmentId ? "Edit labor assessment" : "New labor assessment") : (editingAssessmentId ? "Editar evaluacion laboral" : "Nueva evaluacion laboral")}
              </h2>
              <p className="mt-1 text-sm text-[#3a4f67]">
                {isEn
                  ? "Register multi-activity scenarios, estimate risk, and define trackable mitigations."
                  : "Registra escenarios de pluriactividad, estima riesgo y fija mitigaciones seguibles."}
              </p>
            </div>
            {editingAssessmentId && (
              <button
                type="button"
                className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                onClick={resetForm}
              >
                      {isEn ? "Cancel" : "Cancelar"}
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="advisor-label" htmlFor="laborScenarioDescription">{isEn ? "Scenario" : "Escenario"}</label>
              <textarea
                id="laborScenarioDescription"
                className="advisor-input min-h-28 resize-y"
                value={form.scenarioDescription}
                onChange={(event) => setForm((current) => ({ ...current, scenarioDescription: event.target.value }))}
                placeholder={isEn ? "E.g. I keep salaried employment while starting a self-employed activity and publishing sector content." : "Ej. Mantengo empleo por cuenta ajena mientras inicio actividad como autonomo y publico contenido sectorial."}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="advisor-label" htmlFor="laborRiskScore">{isEn ? "Risk score (0-1)" : "Nivel de riesgo (0-1)"}</label>
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
                <label className="advisor-label" htmlFor="laborRiskLevel">{isEn ? "Level" : "Nivel"}</label>
                <select
                  id="laborRiskLevel"
                  className="advisor-input"
                  value={form.riskLevel}
                  onChange={(event) => setForm((current) => ({ ...current, riskLevel: event.target.value as LaborRiskLevel }))}
                >
                  {laborRiskLevelValues.map((level) => (
                    <option key={level} value={level}>{getRiskLabel(level, locale)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="advisor-card-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Preview" : "Preview"}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xl font-semibold text-[#162944]">{previewScore}%</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(previewLevel)}`}>{previewLevel}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                <div className={`h-2 rounded-full ${getRiskBarClass(previewLevel)}`} style={{ width: `${previewScore}%` }} />
              </div>
            </div>
            <div>
              <label className="advisor-label" htmlFor="laborRecommendations">{isEn ? "Recommendations (one per line)" : "Recomendaciones (una por linea)"}</label>
              <textarea
                id="laborRecommendations"
                className="advisor-input min-h-32 resize-y"
                value={form.recommendationsText}
                onChange={(event) => setForm((current) => ({ ...current, recommendationsText: event.target.value }))}
                placeholder={isEn ? "Separate commercial activity from the personal brand&#10;Review exclusivity clauses&#10;Document schedule compatibility" : "Separar actividad comercial de la marca personal&#10;Revisar clausulas de exclusividad&#10;Documentar compatibilidad horaria"}
              />
            </div>
            {error && <div className="advisor-alert advisor-alert-error">{error}</div>}
            {okMessage && <div className="advisor-alert advisor-alert-success">{okMessage}</div>}
            <button type="submit" disabled={submitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
              {submitting ? (isEn ? "Saving..." : "Guardando...") : editingAssessmentId ? (isEn ? "Update assessment" : "Actualizar evaluacion") : (isEn ? "Register assessment" : "Registrar evaluacion")}
            </button>
          </form>
        </article>

        <article className="advisor-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Risk summary" : "Resumen de riesgo"}</p>
          {!latest ? (
            <div className="mt-3 advisor-card-muted p-3 text-sm text-[#3a4f67]">{isEn ? "No labor assessments recorded." : "No hay evaluaciones laborales registradas."}</div>
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="advisor-card-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Latest assessment" : "Ultima evaluacion"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-2xl font-semibold text-[#162944]">{latestScore}%</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(latestLevel)}`}>{getRiskLabel(latestLevel, locale)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#3a4f67]">{formatDate(latest.created_at, locale)}</p>
                </div>
                <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">
                  <p>{isEn ? "Total assessments" : "Evaluaciones totales"}: <strong className="text-[#162944]">{assessments.length}</strong></p>
                  <p className="mt-1">{isEn ? "Medium/high/critical risk" : "Riesgo medio/alto/critico"}: <strong className="text-[#162944]">{highRiskCount}</strong></p>
                  <p className="mt-1">{isEn ? "Critical" : "Criticas"}: <strong className="text-[#162944]">{criticalCount}</strong></p>
                </div>
              </div>
              <div className="mt-4 advisor-card-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Current scenario" : "Escenario actual"}</p>
                <p className="mt-2 text-sm text-[#162944]">{latest.scenario_description}</p>
              </div>
            </>
          )}
        </article>

        <AuditTimeline title={isEn ? "Labor audit" : "Auditoria laboral"} logs={auditLogs} />
      </div>

      <article className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-3">
        <div className="shrink-0 border-b border-[#d2dceb] px-4 py-3">
          <h3 className="advisor-heading text-2xl text-[#162944]">{isEn ? "Labor tracking" : "Seguimiento laboral"}</h3>
          <p className="mt-1 text-sm text-[#3a4f67]">{isEn ? "Select an assessment and manage its mitigations." : "Selecciona una evaluacion y gestiona sus mitigaciones."}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
            <input
              className="advisor-input min-w-0 w-full"
              placeholder={isEn ? "Scenario" : "Escenario"}
              value={filters.scenarioQuery}
              onChange={(event) => setFilters((current) => ({ ...current, scenarioQuery: event.target.value }))}
            />
            <input
              className="advisor-input min-w-0 w-full"
              placeholder={isEn ? "Owner/email" : "Resp./email"}
              value={filters.ownerQuery}
              onChange={(event) => setFilters((current) => ({ ...current, ownerQuery: event.target.value }))}
            />
            <select
              className="advisor-input min-w-0 w-full"
              value={filters.actionStatus}
              onChange={(event) => setFilters((current) => ({ ...current, actionStatus: event.target.value as AssessmentFilters["actionStatus"] }))}
            >
              <option value="all">{isEn ? "Status" : "Estado"}</option>
              {laborMitigationStatusValues.map((status) => (
                <option key={status} value={status}>{getMitigationStatusLabel(status, locale)}</option>
              ))}
            </select>
            <select
              className="advisor-input min-w-0 w-full"
              value={filters.slaState}
              onChange={(event) => setFilters((current) => ({ ...current, slaState: event.target.value as AssessmentFilters["slaState"] }))}
            >
              <option value="all">SLA</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="breached">{isEn ? "Breached" : "SLA roto"}</option>
            </select>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-h-0 overflow-y-auto space-y-3 pr-1">
            {filteredAssessments.length === 0 ? (
              <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">{isEn ? "No labor history available." : "Sin historial laboral disponible."}</div>
            ) : (
              filteredAssessments.map((assessment) => {
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
                        <p className="mt-1 text-xs text-[#3a4f67]">{formatDate(assessment.created_at, locale)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#162944]">{score}%</p>
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(level)}`}>{getRiskLabel(level, locale)}</span>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-[#dce4f4]">
                      <div className={`h-2 rounded-full ${getRiskBarClass(level)}`} style={{ width: `${score}%` }} />
                    </div>
                    <p className="mt-3 text-xs text-[#3a4f67]">{isEn ? "Mitigations" : "Mitigaciones"}: {actionCount}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={(event) => { event.stopPropagation(); startEditing(assessment); }}>
                        {isEn ? "Edit" : "Editar"}
                      </button>
                      <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={(event) => { event.stopPropagation(); handleDeleteAssessment(assessment.id); }}>
                        {isEn ? "Delete" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="min-h-0 overflow-y-auto space-y-3">
            {!selectedAssessment ? (
              <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">{isEn ? "Select an assessment to manage mitigations." : "Selecciona una evaluacion para gestionar mitigaciones."}</div>
            ) : (
              <>
                <article className="advisor-card-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Active mitigation" : "Mitigacion activa"}</p>
                  <p className="mt-2 text-sm font-semibold text-[#162944]">{selectedAssessment.scenario_description}</p>
                  <div className="mt-3 grid gap-2 text-sm text-[#3a4f67] sm:grid-cols-3">
                    <p>{isEn ? "Pending" : "Pendientes"}: <strong className="text-[#162944]">{pendingActions}</strong></p>
                    <p>{isEn ? "In progress" : "En curso"}: <strong className="text-[#162944]">{inProgressActions}</strong></p>
                    <p>{isEn ? "Completed" : "Completadas"}: <strong className="text-[#162944]">{completedActions}</strong></p>
                    <p>{isEn ? "Overdue" : "Vencidas"}: <strong className="text-[#162944]">{overdueActions}</strong></p>
                    <p>{isEn ? "Breached SLA" : "SLA roto"}: <strong className="text-[#162944]">{slaBreachedActions}</strong></p>
                  </div>
                  <p className="mt-2 text-xs text-[#3a4f67]">
                    Filtros activos: {filteredActions.length} accion(es) visible(s) de {selectedActions.length}.
                  </p>
                </article>

                <article className="advisor-card-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Owners and SLA" : "Responsables y SLA"}</p>
                      <p className="mt-1 text-sm text-[#162944]">{isEn ? "Aggregated operational load by owner." : "Carga operativa agregada por responsable."}</p>
                    </div>
                    <button
                      type="button"
                      className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-xs font-semibold text-[#162944]"
                      onClick={() => setFilters((current) => ({ ...current, ownerQuery: "", slaState: "all" }))}
                    >
                      Limpiar foco
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {ownerStats.length === 0 ? (
                      <div className="rounded-xl border border-[#d2dceb] bg-white p-3 text-sm text-[#3a4f67]">
                        {isEn ? "No owners assigned yet." : "Sin responsables asignados todavia."}
                      </div>
                    ) : (
                      ownerStats.map((owner) => (
                        <button
                          key={owner.owner}
                          type="button"
                          className="w-full rounded-xl border border-[#d2dceb] bg-white p-3 text-left"
                          onClick={() => setFilters((current) => ({ ...current, ownerQuery: owner.owner }))}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="break-words text-sm font-semibold text-[#162944]">{owner.owner}</p>
                            <span className="text-xs text-[#3a4f67]">{owner.total} {isEn ? "action(s)" : "accion(es)"}</span>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-[#3a4f67] sm:grid-cols-3">
                            <p>{isEn ? "Completed" : "Completadas"}: <strong className="text-[#162944]">{owner.completed}</strong></p>
                            <p>SLA {isEn ? "warning" : "warning"}: <strong className="text-[#162944]">{owner.warning}</strong></p>
                            <p>{isEn ? "Breached SLA" : "SLA roto"}: <strong className="text-[#162944]">{owner.breached}</strong></p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </article>

                <article className="advisor-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="advisor-heading text-xl text-[#162944]">
                        {isEn ? (editingActionId ? "Mitigation follow-up" : "New mitigation") : (editingActionId ? "Seguimiento de mitigacion" : "Nueva mitigacion")}
                      </h4>
                      <p className="mt-1 text-sm text-[#3a4f67]">
                        {isEn ? "Assign an owner, document follow-up, and record operational closure." : "Asigna responsable, documenta seguimiento y registra el cierre operativo."}
                      </p>
                    </div>
                    {editingActionId && (
                      <button
                        type="button"
                        className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]"
                        onClick={resetMitigationForm}
                      >
                        {isEn ? "Cancel" : "Cancelar"}
                      </button>
                    )}
                  </div>
                  <form className="mt-3 space-y-3" onSubmit={handleCreateMitigation}>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationTitle">{isEn ? "Title" : "Titulo"}</label>
                      <input id="mitigationTitle" className="advisor-input" value={mitigationForm.title} onChange={(event) => setMitigationForm((current) => ({ ...current, title: event.target.value }))} required />
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationDescription">{isEn ? "Description" : "Descripcion"}</label>
                      <textarea id="mitigationDescription" className="advisor-input min-h-24 resize-y" value={mitigationForm.description} onChange={(event) => setMitigationForm((current) => ({ ...current, description: event.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="advisor-label" htmlFor="mitigationOwnerName">{isEn ? "Owner" : "Responsable"}</label>
                        <input id="mitigationOwnerName" className="advisor-input" value={mitigationForm.ownerName} onChange={(event) => setMitigationForm((current) => ({ ...current, ownerName: event.target.value }))} placeholder={isEn ? "Owner name" : "Nombre del responsable"} />
                      </div>
                      <div>
                        <label className="advisor-label" htmlFor="mitigationOwnerEmail">{isEn ? "Owner email" : "Email responsable"}</label>
                        <input id="mitigationOwnerEmail" type="email" className="advisor-input" value={mitigationForm.ownerEmail} onChange={(event) => setMitigationForm((current) => ({ ...current, ownerEmail: event.target.value }))} placeholder="responsable@empresa.com" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="advisor-label" htmlFor="mitigationDueDate">{isEn ? "Target date" : "Fecha objetivo"}</label>
                        <input id="mitigationDueDate" type="date" className="advisor-input" value={mitigationForm.dueDate} onChange={(event) => setMitigationForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      </div>
                      <div>
                        <label className="advisor-label" htmlFor="mitigationSlaDueAt">{isEn ? "SLA due date" : "SLA compromiso"}</label>
                        <input id="mitigationSlaDueAt" type="date" className="advisor-input" value={mitigationForm.slaDueAt} onChange={(event) => setMitigationForm((current) => ({ ...current, slaDueAt: event.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationStatus">{isEn ? "Status" : "Estado"}</label>
                      <select id="mitigationStatus" className="advisor-input" value={mitigationForm.status} onChange={(event) => setMitigationForm((current) => ({ ...current, status: event.target.value as LaborMitigationStatus }))}>
                        {laborMitigationStatusValues.map((status) => (
                          <option key={status} value={status}>{getMitigationStatusLabel(status, locale)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationEvidenceNotes">{isEn ? "Follow-up / evidence" : "Seguimiento / evidencias"}</label>
                      <textarea id="mitigationEvidenceNotes" className="advisor-input min-h-24 resize-y" value={mitigationForm.evidenceNotes} onChange={(event) => setMitigationForm((current) => ({ ...current, evidenceNotes: event.target.value }))} placeholder={isEn ? "Executed actions, blockers, evidence, or follow-up notes." : "Acciones ejecutadas, bloqueos, evidencias o notas de seguimiento."} />
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationClosureNotes">{isEn ? "Closure notes" : "Notas de cierre"}</label>
                      <textarea id="mitigationClosureNotes" className="advisor-input min-h-20 resize-y" value={mitigationForm.closureNotes} onChange={(event) => setMitigationForm((current) => ({ ...current, closureNotes: event.target.value }))} placeholder={isEn ? "Closure reason, final validation, or decision taken." : "Motivo de cierre, validacion final o decision tomada."} />
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationChecklist">{isEn ? "Checklist (one task per line)" : "Checklist (una tarea por linea)"}</label>
                      <textarea id="mitigationChecklist" className="advisor-input min-h-24 resize-y" value={mitigationForm.checklistText} onChange={(event) => setMitigationForm((current) => ({ ...current, checklistText: event.target.value }))} placeholder={isEn ? "Review exclusivity clause&#10;Request legal opinion&#10;Document schedule compatibility" : "Revisar clausula de exclusividad&#10;Solicitar criterio legal&#10;Documentar compatibilidad horaria"} />
                    </div>
                    <div>
                      <label className="advisor-label" htmlFor="mitigationEvidenceLinks">{isEn ? "Linked evidence (Label | URL)" : "Evidencias enlazadas (Etiqueta | URL)"}</label>
                      <textarea id="mitigationEvidenceLinks" className="advisor-input min-h-20 resize-y" value={mitigationForm.evidenceLinksText} onChange={(event) => setMitigationForm((current) => ({ ...current, evidenceLinksText: event.target.value }))} placeholder={isEn ? "Signed contract | https://...&#10;External opinion | https://..." : "Contrato firmado | https://...&#10;Dictamen externo | https://..."} />
                    </div>
                    {editingActionId && (
                      <div className="rounded-xl border border-[#d2dceb] bg-[#f8fbff] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Upload evidence to storage" : "Subir evidencia a storage"}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input
                            className="advisor-input"
                            value={evidenceLabel}
                            onChange={(event) => setEvidenceLabel(event.target.value)}
                            placeholder={isEn ? "Evidence label" : "Etiqueta de la evidencia"}
                          />
                          <input
                            type="file"
                            className="advisor-input"
                            onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                          />
                        </div>
                        <button type="button" disabled={!evidenceFile || updatingActionId === editingActionId} className="advisor-btn mt-3 border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => void handleEvidenceUpload()}>
                          {updatingActionId === editingActionId ? (isEn ? "Uploading..." : "Subiendo...") : (isEn ? "Upload evidence" : "Subir evidencia")}
                        </button>
                      </div>
                    )}
                    <button type="submit" disabled={mitigationSubmitting} className="advisor-btn advisor-btn-primary advisor-btn-full">
                      {mitigationSubmitting ? (isEn ? "Saving..." : "Guardando...") : editingActionId ? (isEn ? "Update mitigation" : "Actualizar mitigacion") : (isEn ? "Create mitigation" : "Crear mitigacion")}
                    </button>
                  </form>
                </article>

                <article className="advisor-card p-4">
                  <h4 className="advisor-heading text-xl text-[#162944]">{isEn ? "Actions" : "Acciones"}</h4>
                  <div className="mt-3 space-y-3">
                    {filteredActions.length === 0 ? (
                      <div className="advisor-card-muted p-3 text-sm text-[#3a4f67]">{isEn ? "No mitigations recorded for this assessment." : "No hay mitigaciones registradas para esta evaluacion."}</div>
                    ) : (
                      filteredActions.map((action) => {
                        const isBusy = updatingActionId === action.id;
                        const checklist = action.checklist_items ?? [];
                        const evidenceLinks = action.evidence_links ?? [];
                        const checklistProgress = getChecklistProgress(checklist);
                        const slaState = getSlaState(action);
                        return (
                          <div key={action.id} className="advisor-card-muted p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="break-words text-sm font-semibold text-[#162944]">{action.title}</p>
                                <p className="mt-1 break-words text-sm text-[#3a4f67]">{action.description || (isEn ? "No operational description." : "Sin descripcion operativa.")}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getMitigationStatusClass(action.status)}`}>
                                {getMitigationStatusLabel(action.status, locale)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[#3a4f67]">{isEn ? "Target" : "Objetivo"}: {formatDateOnly(action.due_date, locale)}</p>
                            <p className="mt-1 text-xs text-[#3a4f67]">
                              SLA:{" "}
                              <span className={`rounded-full border px-2 py-0.5 font-semibold ${getSlaClass(slaState)}`}>
                                {action.sla_due_at ? formatDateOnly(action.sla_due_at, locale) : (isEn ? "No SLA" : "Sin SLA")}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-[#3a4f67]">
                              {isEn ? "Owner" : "Responsable"}: <strong className="text-[#162944]">{action.owner_name || (isEn ? "Unassigned" : "Sin asignar")}</strong>
                              {action.owner_email ? ` (${action.owner_email})` : ""}
                            </p>
                            <p className="mt-1 text-xs text-[#3a4f67]">
                              {isEn ? "Start" : "Inicio"}: {formatDateOnly(action.started_at, locale)} · {isEn ? "Last follow-up" : "Ultimo seguimiento"}: {formatDateOnly(action.last_follow_up_at, locale)} · {isEn ? "Closure" : "Cierre"}: {formatDateOnly(action.completed_at, locale)}
                            </p>
                            {checklist.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">
                                  {isEn ? "Checklist" : "Checklist"} {checklistProgress.done}/{checklistProgress.total}
                                </p>
                                <div className="mt-2 space-y-2">
                                  {checklist.map((item) => (
                                    <label key={item.id} className="flex items-start gap-2 text-sm text-[#3a4f67]">
                                      <input
                                        type="checkbox"
                                        checked={item.completed}
                                        disabled={isBusy}
                                        onChange={() => void handleChecklistToggle(action, item.id)}
                                        className="mt-1 h-4 w-4 rounded border-[#b8c8de] text-[#1dab89] focus:ring-[#1dab89]"
                                      />
                                      <span className={item.completed ? "line-through text-[#6b7f94]" : ""}>
                                        <span className="break-words">{item.label}</span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(action.evidence_notes || action.closure_notes) && (
                              <div className="mt-3 space-y-2 text-sm text-[#3a4f67]">
                                {action.evidence_notes && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Follow-up" : "Seguimiento"}</p>
                                    <p className="mt-1 break-words">{action.evidence_notes}</p>
                                  </div>
                                )}
                                {action.closure_notes && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Closure" : "Cierre"}</p>
                                    <p className="mt-1 break-words">{action.closure_notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            {evidenceLinks.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">{isEn ? "Linked evidence" : "Evidencias enlazadas"}</p>
                                <div className="mt-2 space-y-1">
                                  {evidenceLinks.map((item) => (
                                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d2dceb] bg-white px-3 py-2">
                                      <div className="min-w-0">
                                        <a href={item.url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-[#1dab89] hover:underline">
                                          <span className="break-words">{item.label}</span>
                                        </a>
                                        <p className="mt-1 text-xs text-[#3a4f67]">
                                          {item.fileName ?? (isEn ? "No name" : "Sin nombre")} · {item.mimeType ?? (isEn ? "unknown type" : "tipo desconocido")} · {formatBytes(item.sizeBytes, locale)}
                                        </p>
                                        <p className="mt-1 break-all text-[11px] text-[#6b7f94]">
                                          {item.addedAt ? `${isEn ? "Uploaded" : "Subida"} ${formatDate(item.addedAt, locale)}` : (isEn ? "No date" : "Sin fecha")}{item.storagePath ? ` · ${item.storagePath}` : ""}
                                        </p>
                                      </div>
                                      <button type="button" disabled={isBusy} className="text-xs font-semibold text-red-700 hover:underline" onClick={() => void handleEvidenceDelete(action, item.url)}>
                                        {isEn ? "Delete" : "Eliminar"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" disabled={isBusy} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => startMitigationEditing(action)}>
                                {isEn ? "Manage" : "Gestionar"}
                              </button>
                              {action.status !== "in_progress" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "in_progress")}>
                                  {isEn ? "In progress" : "En curso"}
                                </button>
                              )}
                              {action.status !== "completed" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "completed")}>
                                  {isEn ? "Complete" : "Completar"}
                                </button>
                              )}
                              {action.status !== "blocked" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "blocked")}>
                                  {isEn ? "Block" : "Bloquear"}
                                </button>
                              )}
                              {action.status !== "pending" && (
                                <button type="button" disabled={isBusy} className="advisor-btn bg-slate-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => handleMitigationStatusChange(action.id, "pending")}>
                                  {isEn ? "Reopen" : "Reabrir"}
                                </button>
                              )}
                              <button type="button" disabled={isBusy} className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-sm font-semibold text-[#162944]" onClick={() => handleDeleteMitigation(action.id)}>
                                {isEn ? "Delete" : "Eliminar"}
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
