import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { createAuditLog } from "@/lib/audit/logs";
import { isAdminRole } from "@/lib/auth/roles";
import { createDocumentSnapshot, listDocumentVersions, rollbackDocumentVersion } from "@/lib/rag/admin-document-versions";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { documentId } = await context.params;
  try {
    const versions = await listDocumentVersions(documentId, 10);
    const response = NextResponse.json({ success: true, versions });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load document versions";
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { documentId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { action?: string; versionId?: string };
  if (payload.action !== "rollback" || !payload.versionId) {
    const response = NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const result = await rollbackDocumentVersion({
      documentId,
      versionId: payload.versionId,
      requestedBy: appUser.id,
    });
    const supabase = createServiceSupabaseClient();
    await createAuditLog(supabase, {
      userId: appUser.id,
      domain: "admin_rag",
      entityType: "rag_document",
      entityId: documentId,
      action: "rolled_back",
      summary: `Documento RAG restaurado a v${result.restoredVersion.version_number}`,
      metadata: {
        versionId: payload.versionId,
        restoredVersion: result.restoredVersion.version_number,
        insertedChunks: result.insertedChunks,
      },
    });
    const response = NextResponse.json({
      success: true,
      documentId,
      restoredVersion: result.restoredVersion.version_number,
      insertedChunks: result.insertedChunks,
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rollback document";
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    log("warn", "api_admin_rag_document_delete_forbidden", requestId, {
      userId: appUser?.id ?? null,
      role: appUser?.role ?? null,
    });
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { documentId } = await context.params;
  if (!documentId) {
    const response = NextResponse.json({ success: false, error: "Missing documentId" }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createServiceSupabaseClient();
  try {
    await createDocumentSnapshot({
      documentId,
      snapshotReason: "pre_delete",
      createdBy: appUser.id,
    });
  } catch (snapshotError) {
    log("warn", "api_admin_rag_document_delete_snapshot_failed", requestId, {
      userId: appUser.id,
      documentId,
      error: snapshotError instanceof Error ? snapshotError.message : "unknown",
    });
  }
  const { error } = await supabase.from("rag_documents").delete().eq("id", documentId);

  if (error) {
    log("error", "api_admin_rag_document_delete_failed", requestId, {
      userId: appUser.id,
      documentId,
      error: error.message,
    });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, documentId });
  response.headers.set("x-request-id", requestId);
  log("info", "api_admin_rag_document_delete_succeeded", requestId, {
    userId: appUser.id,
    documentId,
  });
  try {
    await createAuditLog(supabase, {
      userId: appUser.id,
      domain: "admin_rag",
      entityType: "rag_document",
      entityId: documentId,
      action: "deleted",
      summary: "Documento RAG eliminado desde admin",
    });
  } catch (auditError) {
    log("warn", "api_admin_rag_document_delete_audit_failed", requestId, {
      userId: appUser.id,
      documentId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}
