export const LABOR_EVIDENCE_BUCKET = process.env.SUPABASE_LABOR_EVIDENCE_BUCKET ?? "labor-evidence";

export function sanitizeEvidenceFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function buildLaborEvidencePath(userId: string, actionId: string, fileName: string): string {
  const safeName = sanitizeEvidenceFileName(fileName || "evidence.bin");
  return `${userId}/${actionId}/${Date.now()}-${safeName}`;
}

export function buildLaborEvidenceDownloadUrl(actionId: string, storagePath: string): string {
  const params = new URLSearchParams({ path: storagePath });
  return `/api/labor-mitigation-actions/${actionId}/evidence?${params.toString()}`;
}

export function extractStoragePathFromEvidenceUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("path");
  } catch {
    return null;
  }
}
