import type {
  LegalDifference,
  LegalDocumentCompareResponse,
  LegalReviewRequirement,
  NormalizedLegalDocumentCompareRequest,
} from "@/types/legal-document-validation";
import { runDeterministicRules, computeRiskLevel } from "./deterministic-rules";

const LEGAL_DISCLAIMER =
  "Este análisis comparativo es orientativo y no sustituye el asesoramiento legal profesional. " +
  "Consulte con un abogado antes de firmar cualquier documento.";

export function normalizeLegalCompareRequest(
  raw: Record<string, unknown>,
): NormalizedLegalDocumentCompareRequest {
  const submittedText =
    (raw.submittedText as string | undefined) ??
    (raw.submitted_text as string | undefined) ??
    "";
  const canonicalText =
    (raw.canonicalText as string | undefined) ??
    (raw.canonical_text as string | undefined) ??
    "";
  const documentType =
    (raw.documentType as string | undefined) ??
    (raw.document_type as string | undefined) ??
    "generico";
  const language =
    (raw.language as string | undefined) ?? "es";

  return { submittedText, canonicalText, documentType, language };
}

export function compareDocuments(
  req: NormalizedLegalDocumentCompareRequest,
): LegalDocumentCompareResponse {
  const result = runDeterministicRules(
    req.submittedText,
    req.documentType,
    req.canonicalText,
  );

  const differences = deduplicateDifferences(result.differences);
  const riskLevel = computeRiskLevel(differences);
  const reviewRequirement = deriveReviewRequirement(riskLevel, differences);
  const blockSigning = riskLevel === "critical" || riskLevel === "high";

  return {
    differences,
    risk_level: riskLevel,
    review_requirement: reviewRequirement,
    summary: buildCompareSummary(differences, riskLevel),
    block_signing: blockSigning,
    legal_disclaimer: LEGAL_DISCLAIMER,
  };
}

function deduplicateDifferences(diffs: LegalDifference[]): LegalDifference[] {
  const seen = new Set<string>();
  return diffs.filter((d) => {
    const key = `${d.type}|${d.field ?? ""}|${d.description.slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveReviewRequirement(
  riskLevel: string,
  differences: LegalDifference[],
): LegalReviewRequirement {
  if (riskLevel === "critical") return "urgent";
  if (riskLevel === "high") return "required";
  if (riskLevel === "medium") return "recommended";
  if (differences.length > 0) return "recommended";
  return "none";
}

function buildCompareSummary(
  differences: LegalDifference[],
  riskLevel: string,
): string {
  if (differences.length === 0) {
    return "El documento enviado es compatible con la plantilla canónica. No se detectaron diferencias significativas.";
  }
  const critical = differences.filter((d) => d.severity === "critical").length;
  const high = differences.filter((d) => d.severity === "high").length;
  const total = differences.length;
  const parts: string[] = [
    `Se detectaron ${total} diferencia${total !== 1 ? "s" : ""} respecto a la plantilla canónica`,
  ];
  if (critical > 0) parts.push(`${critical} crítica${critical !== 1 ? "s" : ""}`);
  if (high > 0) parts.push(`${high} de nivel alto`);
  parts.push(`Nivel de riesgo: ${riskLevel}.`);
  return parts.join(". ") + ".";
}
