export const CANONICAL_PROJECT_REF = "lvpplnqbyvscpuljnzqf";

export type NotebookDomain = "fiscal" | "laboral" | "mercado";

interface NotebookScope {
  notebookTitle: string;
  domain: NotebookDomain;
  keywords: string[];
  rejectKeywords: string[];
}

const NOTEBOOK_SCOPES: Record<string, NotebookScope> = {
  ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL: {
    notebookTitle: "ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL",
    domain: "fiscal",
    keywords: [
      "autonomo",
      "autónomo",
      "iva",
      "irpf",
      "reta",
      "deduccion",
      "deducción",
      "cuota cero",
      "inspeccion",
      "inspección",
      "facturacion",
      "facturación",
      "tribut",
      "baleares",
      "balears",
    ],
    rejectKeywords: [
      "despido",
      "pluriactividad",
      "contrato laboral",
      "marca personal",
      "posicionamiento",
      "linkedin",
      "inmobiliario",
      "proptech",
    ],
  },
  ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL: {
    notebookTitle: "ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL",
    domain: "laboral",
    keywords: [
      "pluriactividad",
      "compatibilidad",
      "contrato",
      "despido",
      "buena fe",
      "excedencia",
      "laboral",
      "transicion",
      "transición",
      "conflicto",
      "reputacional",
      "riesgo",
    ],
    rejectKeywords: [
      "iva",
      "irpf",
      "reta",
      "cuota cero",
      "deduccion",
      "deducción",
      "marca personal",
      "posicionamiento",
      "inmobiliario",
      "proptech",
    ],
  },
  ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO: {
    notebookTitle: "ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO",
    domain: "mercado",
    keywords: [
      "marca",
      "posicionamiento",
      "premium",
      "usp",
      "narrativa",
      "autoridad",
      "conversion",
      "conversión",
      "comercial",
      "linkedin",
      "inmobiliario",
      "inmobiliaria",
      "proptech",
    ],
    rejectKeywords: [
      "despido",
      "pluriactividad",
      "contrato laboral",
      "iva",
      "irpf",
      "reta",
      "cuota cero",
      "deduccion",
      "deducción",
    ],
  },
};

export interface IngestSourcePayload {
  title: string;
  url: string | null;
  content: string;
  reason_for_fit: string;
  source_type?: string | null;
}

export interface GovernanceValidationIssue {
  code: "ENV_MISMATCH" | "SOURCE_SCOPE_MISMATCH" | "INVALID_NOTEBOOK_SCOPE";
  message: string;
}

export interface GovernanceValidationResult {
  ok: boolean;
  decision: "GO" | "NO-GO";
  issues: GovernanceValidationIssue[];
}

export function extractProjectRef(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function validateProjectRefCoherence(): GovernanceValidationResult {
  const publicRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serverRef = extractProjectRef(process.env.SUPABASE_URL);
  const issues: GovernanceValidationIssue[] = [];

  if (!publicRef || !serverRef || publicRef !== serverRef || publicRef !== CANONICAL_PROJECT_REF) {
    issues.push({
      code: "ENV_MISMATCH",
      message: `Expected canonical project_ref=${CANONICAL_PROJECT_REF}; got public=${publicRef ?? "missing"}, server=${serverRef ?? "missing"}.`,
    });
  }

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? "GO" : "NO-GO",
    issues,
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function countKeywordHits(haystack: string, keywords: string[]): number {
  return keywords.filter((keyword) => haystack.includes(normalizeText(keyword))).length;
}

function inferNotebookScope(notebookTitle: string): NotebookScope | null {
  return NOTEBOOK_SCOPES[notebookTitle] ?? null;
}

export function validateNotebookScope(
  notebookTitle: string,
  domain: string,
  sources: IngestSourcePayload[]
): GovernanceValidationResult {
  const issues: GovernanceValidationIssue[] = [];
  const scope = inferNotebookScope(notebookTitle);

  if (!scope) {
    issues.push({
      code: "INVALID_NOTEBOOK_SCOPE",
      message: `Notebook title not recognized: ${notebookTitle}.`,
    });
  } else if (scope.domain !== domain) {
    issues.push({
      code: "SOURCE_SCOPE_MISMATCH",
      message: `Notebook ${notebookTitle} only accepts domain=${scope.domain}, got domain=${domain}.`,
    });
  }

  if (scope) {
    for (const source of sources) {
      const haystack = normalizeText(
        `${source.title} ${source.content.slice(0, 2500)} ${source.reason_for_fit}`
      );
      const keywordHits = countKeywordHits(haystack, scope.keywords);
      const rejectHits = countKeywordHits(haystack, scope.rejectKeywords);

      if (!source.reason_for_fit || source.reason_for_fit.trim().length < 24) {
        issues.push({
          code: "SOURCE_SCOPE_MISMATCH",
          message: `Source "${source.title}" is missing a meaningful reason_for_fit.`,
        });
        continue;
      }

      if (keywordHits < 2) {
        issues.push({
          code: "SOURCE_SCOPE_MISMATCH",
          message: `Source "${source.title}" does not provide enough evidence for the thematic scope of ${notebookTitle}.`,
        });
      }

      if (rejectHits >= Math.max(4, keywordHits * 2)) {
        issues.push({
          code: "SOURCE_SCOPE_MISMATCH",
          message: `Source "${source.title}" appears closer to another notebook scope than to ${notebookTitle}.`,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? "GO" : "NO-GO",
    issues,
  };
}
