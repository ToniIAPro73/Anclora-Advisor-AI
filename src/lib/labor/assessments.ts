import { z } from "zod";

export const laborRiskLevelValues = ["low", "medium", "high", "critical"] as const;
export const laborMitigationStatusValues = ["pending", "in_progress", "completed", "blocked"] as const;

export type LaborRiskLevel = (typeof laborRiskLevelValues)[number];
export type LaborMitigationStatus = (typeof laborMitigationStatusValues)[number];

export interface LaborMitigationChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface LaborMitigationEvidenceLink {
  id: string;
  label: string;
  url: string;
  addedAt: string | null;
}

export interface LaborRiskAssessmentRecord {
  id: string;
  scenario_description: string;
  risk_score: number;
  risk_level: string | null;
  recommendations: string[] | null;
  created_at: string;
}

export interface LaborMitigationActionRecord {
  id: string;
  assessment_id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  sla_due_at: string | null;
  owner_name: string | null;
  owner_email: string | null;
  evidence_notes: string | null;
  closure_notes: string | null;
  checklist_items: LaborMitigationChecklistItem[] | null;
  evidence_links: LaborMitigationEvidenceLink[] | null;
  started_at: string | null;
  completed_at: string | null;
  last_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LABOR_MITIGATION_SELECT_FIELDS = [
  "id",
  "assessment_id",
  "title",
  "description",
  "status",
  "due_date",
  "sla_due_at",
  "owner_name",
  "owner_email",
  "evidence_notes",
  "closure_notes",
  "checklist_items",
  "evidence_links",
  "started_at",
  "completed_at",
  "last_follow_up_at",
  "created_at",
  "updated_at",
].join(", ");

function normalizeRecommendations(input: string[] | undefined): string[] | null {
  if (!input) {
    return null;
  }

  const cleaned = input.map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

export const createLaborRiskAssessmentSchema = z.object({
  scenarioDescription: z.string().min(12).max(4000),
  riskScore: z.number().min(0).max(1),
  riskLevel: z.enum(laborRiskLevelValues),
  recommendations: z.array(z.string().max(500)).max(12).optional(),
}).transform((value) => ({
  ...value,
  scenarioDescription: value.scenarioDescription.trim(),
  recommendations: normalizeRecommendations(value.recommendations),
}));

export const updateLaborRiskAssessmentSchema = z.object({
  scenarioDescription: z.string().min(12).max(4000).optional(),
  riskScore: z.number().min(0).max(1).optional(),
  riskLevel: z.enum(laborRiskLevelValues).optional(),
  recommendations: z.array(z.string().max(500)).max(12).optional(),
}).transform((value) => ({
  ...value,
  scenarioDescription: value.scenarioDescription?.trim(),
  recommendations: value.recommendations ? normalizeRecommendations(value.recommendations) : undefined,
})).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one field must be provided",
});

const optionalActionDescription = z.string().max(2000).transform((value) => value.trim()).transform((value) => value || null).nullable().optional();
const optionalActionOwnerName = z.string().max(255).transform((value) => value.trim()).transform((value) => value || null).nullable().optional();
const optionalActionOwnerEmail = z.string().email().max(255).transform((value) => value.trim().toLowerCase()).transform((value) => value || null).nullable().optional();
const optionalDueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const optionalLongNotes = z.string().max(4000).transform((value) => value.trim()).transform((value) => value || null).nullable().optional();
const checklistItemSchema = z.object({
  id: z.string().min(1).max(80).transform((value) => value.trim()),
  label: z.string().min(1).max(255).transform((value) => value.trim()),
  completed: z.boolean().default(false),
  completedAt: z.string().datetime().nullable().optional(),
}).transform((value) => ({
  ...value,
  completedAt: value.completedAt ?? null,
}));
const evidenceLinkSchema = z.object({
  id: z.string().min(1).max(80).transform((value) => value.trim()),
  label: z.string().min(1).max(255).transform((value) => value.trim()),
  url: z.string().url().max(2000).transform((value) => value.trim()),
  addedAt: z.string().datetime().nullable().optional(),
}).transform((value) => ({
  ...value,
  addedAt: value.addedAt ?? null,
}));
const optionalChecklistItems = z.array(checklistItemSchema).max(20).optional();
const optionalEvidenceLinks = z.array(evidenceLinkSchema).max(20).optional();

export const createLaborMitigationActionSchema = z.object({
  title: z.string().min(3).max(255).transform((value) => value.trim()),
  description: optionalActionDescription,
  dueDate: optionalDueDate,
  slaDueAt: optionalDueDate,
  ownerName: optionalActionOwnerName,
  ownerEmail: optionalActionOwnerEmail,
  evidenceNotes: optionalLongNotes,
  closureNotes: optionalLongNotes,
  checklistItems: optionalChecklistItems,
  evidenceLinks: optionalEvidenceLinks,
  status: z.enum(laborMitigationStatusValues).default("pending"),
});

export const updateLaborMitigationActionSchema = z.object({
  title: z.string().min(3).max(255).transform((value) => value.trim()).optional(),
  description: optionalActionDescription,
  dueDate: optionalDueDate,
  slaDueAt: optionalDueDate,
  ownerName: optionalActionOwnerName,
  ownerEmail: optionalActionOwnerEmail,
  evidenceNotes: optionalLongNotes,
  closureNotes: optionalLongNotes,
  checklistItems: optionalChecklistItems,
  evidenceLinks: optionalEvidenceLinks,
  status: z.enum(laborMitigationStatusValues).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one field must be provided",
});

export function clampRiskScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function deriveRiskLevel(score: number, level?: string | null): LaborRiskLevel {
  if (level && laborRiskLevelValues.includes(level as LaborRiskLevel)) {
    return level as LaborRiskLevel;
  }
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}
