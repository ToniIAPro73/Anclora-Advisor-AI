import type { LegalDifference, LegalRiskLevel } from "@/types/legal-document-validation";

// Placeholders that indicate an unfilled template field
const PLACEHOLDER_PATTERNS = [
  /\[.*?\]/g,
  /\{.*?\}/g,
  /__+/g,
  /<<<.*?>>>/g,
  /\bXXXX+\b/gi,
  /\bPENDIENTE\b/gi,
  /\bPOR DETERMINAR\b/gi,
  /\bA COMPLETAR\b/gi,
  /\bTO BE COMPLETED\b/gi,
  /\bTBD\b/gi,
];

// Required clauses by document type
const REQUIRED_CLAUSES: Record<string, string[]> = {
  compraventa: [
    "precio",
    "forma de pago",
    "descripción del inmueble",
    "cargas y gravámenes",
    "notaría",
    "impuestos",
    "fecha de entrega",
    "arras",
  ],
  alquiler_temporada: [
    "renta",
    "duración",
    "fianza",
    "inventario",
    "suministros",
    "rescisión",
  ],
  alquiler_turistico: [
    "precio por noche",
    "capacidad máxima",
    "número de licencia",
    "limpieza",
    "cancelación",
    "fianza",
  ],
  arras: [
    "cantidad",
    "plazo",
    "penalización",
    "descripción del inmueble",
    "partes",
  ],
  kyc: [
    "identidad",
    "titular real",
    "origen de fondos",
    "documento identificativo",
    "pep",
    "sanciones",
  ],
  mandato: [
    "mandante",
    "mandatario",
    "facultades",
    "vigencia",
    "honorarios",
    "revocación",
  ],
  reserva: [
    "partes",
    "inmueble",
    "precio",
    "cantidad reservada",
    "plazo",
    "penalización",
  ],
  inventario: [
    "inmueble",
    "estado",
    "mobiliario",
    "electrodomésticos",
    "fecha",
    "firma",
  ],
  entrega_llaves: [
    "partes",
    "inmueble",
    "fecha",
    "llaves",
    "estado",
    "firma",
  ],
};

const DEFAULT_REQUIRED_CLAUSES = [
  "partes",
  "objeto",
  "precio",
  "plazo",
  "firma",
];

// Date-like patterns (loose — for anomaly detection, not parsing)
const DATE_PATTERN =
  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g;

// Amount patterns: 1.000,00 € / 1,000.00 EUR / $1000
const AMOUNT_PATTERN =
  /(?:€|\$|EUR|USD|GBP)\s*[\d.,]+|[\d.,]+\s*(?:€|EUR|USD|GBP)/gi;

export interface DeterministicRuleResult {
  differences: LegalDifference[];
  missingClauses: string[];
  placeholdersFound: number;
}

export function runDeterministicRules(
  text: string,
  documentType: string,
  canonicalText?: string,
  variableSnapshot: Record<string, unknown> = {},
): DeterministicRuleResult {
  const differences: LegalDifference[] = [];

  const placeholderDiffs = detectPlaceholders(text);
  differences.push(...placeholderDiffs);

  const missingClauses = detectMissingClauses(text, documentType);
  for (const clause of missingClauses) {
    differences.push({
      type: "missing_clause",
      field: clause,
      description: `Cláusula requerida no encontrada: "${clause}"`,
      severity: "high",
    });
  }

  if (canonicalText) {
    const canonicalDiffs = detectCanonicalDeviations(text, canonicalText);
    differences.push(...canonicalDiffs);
  }

  const dateAnomalies = detectDateAnomalies(text);
  differences.push(...dateAnomalies);

  const amountAnomalies = detectAmountAnomalies(text, canonicalText);
  differences.push(...amountAnomalies);

  differences.push(...detectVariableSnapshotInconsistencies(text, variableSnapshot));
  differences.push(...detectRealEstateCriticalRules(text, documentType));

  return {
    differences,
    missingClauses,
    placeholdersFound: placeholderDiffs.length,
  };
}

function detectPlaceholders(text: string): LegalDifference[] {
  const found: LegalDifference[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    if (matches) {
      for (const match of matches) {
        found.push({
          type: "placeholder_detected",
          submitted_value: match,
          description: `Marcador de posición sin completar detectado: "${match}"`,
          severity: "critical",
        });
      }
    }
  }
  return found;
}

function detectMissingClauses(text: string, documentType: string): string[] {
  const required =
    REQUIRED_CLAUSES[documentType.toLowerCase()] ?? DEFAULT_REQUIRED_CLAUSES;
  const lower = text.toLowerCase();
  return required.filter((clause) => !lower.includes(clause.toLowerCase()));
}

function detectCanonicalDeviations(
  submitted: string,
  canonical: string,
): LegalDifference[] {
  const differences: LegalDifference[] = [];

  // Split into rough sections by double newline or numbered heading
  const canonicalSections = splitSections(canonical);
  const submittedLower = submitted.toLowerCase();

  for (const section of canonicalSections) {
    const sectionLower = section.toLowerCase().trim();
    if (sectionLower.length < 20) continue;

    // Check first 60 chars of each section as a heading fingerprint
    const fingerprint = sectionLower.slice(0, 60);
    if (!submittedLower.includes(fingerprint)) {
      differences.push({
        type: "missing_clause",
        canonical_value: section.slice(0, 120),
        description: `Sección del contrato canónico no encontrada en el documento enviado`,
        severity: "high",
      });
    }
  }

  return differences;
}

function detectDateAnomalies(text: string): LegalDifference[] {
  const dates: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(DATE_PATTERN.source, DATE_PATTERN.flags);
  while ((match = pattern.exec(text)) !== null) {
    dates.push(match[0]);
  }

  // Flag if any detected date is clearly in the past (year < current year - 1)
  const currentYear = new Date().getFullYear();
  const anomalies: LegalDifference[] = [];
  for (const dateStr of dates) {
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      if (year < currentYear - 1) {
        anomalies.push({
          type: "date_anomaly",
          submitted_value: dateStr,
          description: `Fecha posiblemente desactualizada detectada: "${dateStr}"`,
          severity: "medium",
        });
      }
    }
  }
  return anomalies;
}

function detectAmountAnomalies(
  submitted: string,
  canonical?: string,
): LegalDifference[] {
  if (!canonical) return [];

  const submittedAmounts = extractAmounts(submitted);
  const canonicalAmounts = extractAmounts(canonical);

  if (canonicalAmounts.length === 0) return [];

  const differences: LegalDifference[] = [];
  for (const canonicalAmount of canonicalAmounts) {
    const found = submittedAmounts.some((a) =>
      normalizeAmount(a) === normalizeAmount(canonicalAmount),
    );
    if (!found) {
      differences.push({
        type: "amount_anomaly",
        canonical_value: canonicalAmount,
        description: `Importe del contrato canónico no encontrado en el documento enviado: "${canonicalAmount}"`,
        severity: "high",
      });
    }
  }
  return differences;
}

function detectVariableSnapshotInconsistencies(
  submitted: string,
  variableSnapshot: Record<string, unknown>,
): LegalDifference[] {
  const differences: LegalDifference[] = [];
  const lower = submitted.toLowerCase();
  for (const [field, value] of Object.entries(variableSnapshot)) {
    if (value === undefined || value === null) continue;
    if (!isTrackedSnapshotField(field)) continue;
    const normalizedValue = normalizeSnapshotValue(value);
    if (!normalizedValue || normalizedValue.length < 2) continue;
    if (!lower.includes(normalizedValue.toLowerCase())) {
      differences.push({
        type: field.toLowerCase().includes("jurisdiction") ? "field_inconsistency" : "amount_anomaly",
        field,
        canonical_value: normalizedValue,
        description: `Snapshot value for "${field}" was not found in the submitted document.`,
        severity: field.toLowerCase().includes("price") || field.toLowerCase().includes("jurisdiction")
          ? "critical"
          : "high",
      });
    }
  }
  return differences;
}

function detectRealEstateCriticalRules(text: string, documentType: string): LegalDifference[] {
  const lower = text.toLowerCase();
  const normalizedType = documentType.toLowerCase();
  const differences: LegalDifference[] = [];

  if (!isRealEstateDocumentType(normalizedType)) {
    return differences;
  }

  if (!containsAny(lower, ["dni", "nie", "pasaporte", "cif", "identidad"])) {
    differences.push({
      type: "missing_clause",
      field: "identity",
      description: "Party identity details are missing or insufficient.",
      severity: "critical",
    });
  }

  if (requiresTemporalCause(normalizedType) && !containsAny(lower, ["causa de temporalidad", "uso temporal", "motivo temporal", "estancia laboral", "estancia por estudios", "vacaciones"])) {
    differences.push({
      type: "missing_clause",
      field: "temporal_cause",
      description: "Seasonal/temporary rental lacks an explicit temporal cause.",
      severity: "critical",
    });
  }

  if (["compraventa", "arras", "reserva"].includes(normalizedType) && !containsAny(lower, ["cargas", "gravámenes", "registro", "nota simple"])) {
    differences.push({
      type: "missing_clause",
      field: "encumbrances",
      description: "Real-estate sale document lacks encumbrance or registry verification language.",
      severity: "high",
    });
  }

  if (["inventario", "entrega_llaves"].includes(normalizedType) && !containsAny(lower, ["estado", "anexo", "fotograf", "inventario"])) {
    differences.push({
      type: "missing_clause",
      field: "annexes",
      description: "Inventory/key-handover document lacks condition evidence or annex references.",
      severity: "high",
    });
  }

  return differences;
}

function extractAmounts(text: string): string[] {
  return text.match(new RegExp(AMOUNT_PATTERN.source, AMOUNT_PATTERN.flags)) ?? [];
}

function normalizeAmount(amount: string): string {
  return amount.replace(/\s/g, "").replace(/,/g, ".").toLowerCase();
}

function normalizeSnapshotValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function isTrackedSnapshotField(field: string): boolean {
  const normalized = field.toLowerCase();
  return [
    "price",
    "precio",
    "amount",
    "jurisdiction",
    "object",
    "objeto",
    "property",
    "inmueble",
    "templateversion",
    "template_version",
  ].some((part) => normalized.includes(part));
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function requiresTemporalCause(documentType: string): boolean {
  return documentType === "alquiler_temporada" || documentType === "alquiler_turistico";
}

function isRealEstateDocumentType(documentType: string): boolean {
  return [
    "compraventa",
    "alquiler_temporada",
    "alquiler_turistico",
    "arras",
    "kyc",
    "mandato",
    "reserva",
    "inventario",
    "entrega_llaves",
  ].includes(documentType);
}

function splitSections(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function computeRiskLevel(differences: LegalDifference[]): LegalRiskLevel {
  if (differences.some((d) => d.severity === "critical")) return "critical";
  if (differences.some((d) => d.severity === "high")) return "high";
  if (differences.some((d) => d.severity === "medium")) return "medium";
  return "low";
}
