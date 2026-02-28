import { z } from "zod";

export const laborRiskLevelValues = ["low", "medium", "high", "critical"] as const;

export type LaborRiskLevel = (typeof laborRiskLevelValues)[number];

export interface LaborRiskAssessmentRecord {
  id: string;
  scenario_description: string;
  risk_score: number;
  risk_level: string | null;
  recommendations: string[] | null;
  created_at: string;
}

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
