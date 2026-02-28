import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { ingestAdminSources } from "@/lib/rag/admin-ingest";
import {
  CANONICAL_PROJECT_REF,
  validateNotebookScope,
  validateProjectRefCoherence,
} from "@/lib/rag/governance";
import { getRequestId, log } from "@/lib/observability/logger";

const sourceSchema = z.object({
  title: z.string().min(5).max(500),
  url: z.string().url().nullable().optional(),
  content: z.string().min(200),
  reason_for_fit: z.string().min(24),
  source_type: z.string().min(3).max(50).nullable().optional(),
});

const ingestSchema = z.object({
  project_ref: z.string().min(4),
  notebook_id: z.string().uuid(),
  notebook_title: z.string().min(10),
  domain: z.enum(["fiscal", "laboral", "mercado"]),
  replace_existing: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  sources: z.array(sourceSchema).min(1).max(10),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    log("warn", "api_admin_rag_ingest_forbidden", requestId, {
      userId: appUser?.id ?? null,
      role: appUser?.role ?? null,
    });
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = ingestSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_admin_rag_ingest_invalid_payload", requestId, {
      issues: payload.error.issues.length,
      userId: appUser.id,
    });
    const response = NextResponse.json(
      { success: false, decision: "NO-GO", code: "INVALID_PAYLOAD", error: payload.error.flatten() },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const normalizedSources = payload.success
    ? payload.data.sources.map((source) => ({
        ...source,
        url: source.url ?? null,
        source_type: source.source_type ?? null,
      }))
    : [];

  if (payload.data.project_ref !== CANONICAL_PROJECT_REF) {
    const response = NextResponse.json(
      {
        success: false,
        decision: "NO-GO",
        code: "ENV_MISMATCH",
        error: `project_ref must be ${CANONICAL_PROJECT_REF}`,
      },
      { status: 409 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const envValidation = validateProjectRefCoherence();
  if (!envValidation.ok) {
    log("error", "api_admin_rag_ingest_env_mismatch", requestId, {
      userId: appUser.id,
      issues: envValidation.issues.map((issue) => issue.code).join(","),
    });
    const response = NextResponse.json(
      {
        success: false,
        decision: envValidation.decision,
        code: "ENV_MISMATCH",
        issues: envValidation.issues,
      },
      { status: 409 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const scopeValidation = validateNotebookScope(
    payload.data.notebook_title,
    payload.data.domain,
    normalizedSources
  );
  if (!scopeValidation.ok) {
    log("warn", "api_admin_rag_ingest_scope_rejected", requestId, {
      userId: appUser.id,
      issues: scopeValidation.issues.map((issue) => issue.code).join(","),
    });
    const response = NextResponse.json(
      {
        success: false,
        decision: scopeValidation.decision,
        code: "SOURCE_SCOPE_MISMATCH",
        issues: scopeValidation.issues,
      },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (payload.data.dry_run) {
    const response = NextResponse.json({
      success: true,
      decision: "GO",
      dry_run: true,
      summary: {
        sources: normalizedSources.length,
        notebook_title: payload.data.notebook_title,
        domain: payload.data.domain,
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const result = await ingestAdminSources({
      ...payload.data,
      sources: normalizedSources,
    });
    const response = NextResponse.json({
      success: true,
      decision: "GO",
      result,
    });
    response.headers.set("x-request-id", requestId);
    log("info", "api_admin_rag_ingest_succeeded", requestId, {
      userId: appUser.id,
      documentsProcessed: result.documentsProcessed,
      chunksInserted: result.chunksInserted,
      replacedDocuments: result.replacedDocuments,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    log("error", "api_admin_rag_ingest_failed", requestId, {
      userId: appUser.id,
      error: message,
    });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
