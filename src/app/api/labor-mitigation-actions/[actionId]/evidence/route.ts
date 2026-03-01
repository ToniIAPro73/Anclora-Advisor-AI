import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import { getRequestId, log } from "@/lib/observability/logger";
import { LABOR_MITIGATION_SELECT_FIELDS, type LaborMitigationActionRecord } from "@/lib/labor/assessments";
import {
  buildLaborEvidenceDownloadUrl,
  buildLaborEvidencePath,
  extractStoragePathFromEvidenceUrl,
  LABOR_EVIDENCE_BUCKET,
} from "@/lib/labor/evidence";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ actionId: string }>;
};

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, userId: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, userId: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, userId: user.id, error: null };
}

async function loadUserAction(accessToken: string, actionId: string): Promise<LaborMitigationActionRecord> {
  const supabase = createUserScopedSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("labor_mitigation_actions")
    .select(LABOR_MITIGATION_SELECT_FIELDS)
    .eq("id", actionId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "LABOR_ACTION_NOT_FOUND");
  }

  return data as unknown as LaborMitigationActionRecord;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { actionId } = await context.params;
  const storagePath = request.nextUrl.searchParams.get("path");
  if (!storagePath) {
    return NextResponse.json({ success: false, error: "Missing path" }, { status: 400 });
  }

  try {
    await loadUserAction(auth.accessToken, actionId);
    const admin = createServiceSupabaseClient();
    const { data, error } = await admin.storage.from(LABOR_EVIDENCE_BUCKET).createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "SIGNED_URL_FAILED");
    }
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    log("error", "api_labor_evidence_get_failed", requestId, {
      actionId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "EVIDENCE_NOT_AVAILABLE" }, { status: 404 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { actionId } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const labelInput = formData.get("label");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing file" }, { status: 400 });
    }

    const action = await loadUserAction(auth.accessToken, actionId);
    const storagePath = buildLaborEvidencePath(auth.userId, actionId, file.name);
    const arrayBuffer = await file.arrayBuffer();
    const admin = createServiceSupabaseClient();

    const { error: uploadError } = await admin.storage.from(LABOR_EVIDENCE_BUCKET).upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const label = typeof labelInput === "string" && labelInput.trim().length > 0 ? labelInput.trim() : file.name;
    const nextEvidenceLinks = [
      ...(action.evidence_links ?? []),
      {
        id: crypto.randomUUID(),
        label,
        url: buildLaborEvidenceDownloadUrl(actionId, storagePath),
        addedAt: new Date().toISOString(),
      },
    ];

    const userScoped = createUserScopedSupabaseClient(auth.accessToken);
    const { data, error } = await userScoped
      .from("labor_mitigation_actions")
      .update({
        evidence_links: nextEvidenceLinks,
        last_follow_up_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .select(LABOR_MITIGATION_SELECT_FIELDS)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "EVIDENCE_UPDATE_FAILED");
    }

    try {
      await createAuditLog(admin, {
        userId: auth.userId,
        domain: "labor",
        entityType: "labor_mitigation_evidence",
        entityId: actionId,
        action: "uploaded",
        summary: `Evidencia subida: ${label}`,
        metadata: {
          fileName: file.name,
          mimeType: file.type,
          storagePath,
        },
      });
    } catch {
      // Upload should not fail because of audit logging.
    }

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    log("error", "api_labor_evidence_post_failed", requestId, {
      actionId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "EVIDENCE_UPLOAD_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { actionId } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string; path?: string };
    const storagePath = body.path ?? (body.url ? extractStoragePathFromEvidenceUrl(body.url) : null);
    if (!storagePath) {
      return NextResponse.json({ success: false, error: "Missing evidence path" }, { status: 400 });
    }

    const action = await loadUserAction(auth.accessToken, actionId);
    const nextEvidenceLinks = (action.evidence_links ?? []).filter((item) => {
      const itemPath = extractStoragePathFromEvidenceUrl(item.url);
      return itemPath !== storagePath;
    });

    const admin = createServiceSupabaseClient();
    await admin.storage.from(LABOR_EVIDENCE_BUCKET).remove([storagePath]);

    const userScoped = createUserScopedSupabaseClient(auth.accessToken);
    const { data, error } = await userScoped
      .from("labor_mitigation_actions")
      .update({
        evidence_links: nextEvidenceLinks,
        last_follow_up_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .select(LABOR_MITIGATION_SELECT_FIELDS)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "EVIDENCE_DELETE_FAILED");
    }

    try {
      await createAuditLog(admin, {
        userId: auth.userId,
        domain: "labor",
        entityType: "labor_mitigation_evidence",
        entityId: actionId,
        action: "deleted",
        summary: "Evidencia eliminada",
        metadata: { storagePath },
      });
    } catch {
      // Delete should not fail because of audit logging.
    }

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    log("error", "api_labor_evidence_delete_failed", requestId, {
      actionId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ success: false, error: "EVIDENCE_DELETE_FAILED" }, { status: 500 });
  }
}
