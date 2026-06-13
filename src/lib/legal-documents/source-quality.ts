import type { RAGChunk } from "@/lib/rag/retrieval";
import type {
  LegalFinding,
  LegalSource,
  LegalSourceValidityStatus,
} from "@/types/legal-document-validation";

export interface SourceQualityResult {
  sources: LegalSource[];
  findings: LegalFinding[];
  confidencePenalty: number;
  canApprove: boolean;
}

const BLOCKING_STATUSES: LegalSourceValidityStatus[] = ["superseded"];

export function evaluateLegalSources(
  chunks: RAGChunk[],
  jurisdiction: string,
  now: Date,
): SourceQualityResult {
  const sources = chunks.map((chunk) => normalizeSource(chunk, jurisdiction, now));
  const findings: LegalFinding[] = [];
  let confidencePenalty = 0;
  let canApprove = true;

  if (sources.length === 0) {
    return {
      sources,
      confidencePenalty: 0.45,
      canApprove: false,
      findings: [
        {
          severity: "high",
          category: "source_quality",
          title: "No legal sources available",
          description: "The legal validation could not cite applicable RAG sources.",
          recommendation: "Route the document to legal review before approving signature.",
          block_signing: true,
        },
      ],
    };
  }

  for (const source of sources) {
    if (source.status === "expired") {
      confidencePenalty += 0.18;
      canApprove = false;
      findings.push(sourceFinding(source, "medium", "Legal source is expired", false));
    }
    if (source.status === "uncertain") {
      confidencePenalty += 0.12;
      canApprove = false;
      findings.push(sourceFinding(source, "medium", "Legal source validity is uncertain", false));
    }
    if (BLOCKING_STATUSES.includes(source.status)) {
      confidencePenalty += 0.35;
      canApprove = false;
      findings.push(sourceFinding(source, "high", "Legal source has been superseded", true));
    }
    if (!isJurisdictionCompatible(source.jurisdiction, jurisdiction)) {
      confidencePenalty += 0.2;
      canApprove = false;
      findings.push(sourceFinding(source, "high", "Legal source jurisdiction does not apply", true));
    }
    if (source.confidence < 0.6) {
      confidencePenalty += 0.1;
      canApprove = false;
      findings.push(sourceFinding(source, "medium", "Legal source confidence is low", false));
    }
  }

  return {
    sources,
    findings,
    confidencePenalty: Math.min(0.6, confidencePenalty),
    canApprove,
  };
}

function normalizeSource(chunk: RAGChunk, requestedJurisdiction: string, now: Date): LegalSource {
  const baseMetadata = chunk.metadata ?? {};
  const docMetadata =
    baseMetadata.doc_metadata && typeof baseMetadata.doc_metadata === "object"
      ? baseMetadata.doc_metadata
      : {};
  const metadata = { ...baseMetadata, ...docMetadata } as Record<string, unknown>;
  const status = normalizeStatus(metadata.status ?? metadata.validity_status, metadata.effective_until, now);
  return {
    title: stringValue(metadata.title) || "Untitled legal source",
    source: stringValue(metadata.source_url ?? metadata.url ?? metadata.identifier),
    url: stringValue(metadata.source_url ?? metadata.url),
    identifier: stringValue(metadata.identifier ?? chunk.document_id),
    type: stringValue(metadata.source_type ?? metadata.type ?? metadata.category),
    authority: stringValue(metadata.authority ?? metadata.publisher),
    jurisdiction: stringValue(metadata.jurisdiction) || requestedJurisdiction,
    effective_date: stringValue(metadata.effective_date ?? metadata.valid_from),
    reviewed_at: stringValue(metadata.reviewed_at ?? metadata.last_reviewed_at),
    status,
    confidence: numberValue(metadata.confidence, chunk.similarity ?? 0.65),
    excerpt: chunk.content.slice(0, 240),
  };
}

function normalizeStatus(raw: unknown, effectiveUntil: unknown, now: Date): LegalSourceValidityStatus {
  if (raw === "current" || raw === "superseded" || raw === "expired" || raw === "uncertain") {
    return raw;
  }
  const until = stringValue(effectiveUntil);
  if (until) {
    const parsed = Date.parse(until);
    if (Number.isFinite(parsed) && parsed < now.getTime()) return "expired";
  }
  return "uncertain";
}

function sourceFinding(
  source: LegalSource,
  severity: "medium" | "high",
  title: string,
  blockSigning: boolean,
): LegalFinding {
  return {
    severity,
    category: "source_quality",
    title,
    description: `Source "${source.title}" has status "${source.status}" for jurisdiction "${source.jurisdiction ?? "unknown"}".`,
    recommendation: "Use only current, applicable legal sources before approving the document.",
    block_signing: blockSigning,
    source_reference: source.identifier ?? source.url ?? source.source,
  };
}

function isJurisdictionCompatible(sourceJurisdiction: string | undefined, requested: string): boolean {
  if (!sourceJurisdiction) return false;
  const source = sourceJurisdiction.toLowerCase();
  const target = requested.toLowerCase();
  return source === target || source.includes(target) || target.includes(source) || source === "es" || source === "españa";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}
