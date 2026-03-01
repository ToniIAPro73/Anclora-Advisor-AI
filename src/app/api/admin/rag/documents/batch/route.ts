import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { createAuditLog } from "@/lib/audit/logs";
import { isAdminRole } from "@/lib/auth/roles";
import { createDocumentSnapshot } from "@/lib/rag/admin-document-versions";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

type BatchPayload = {
  action?: "bulk_delete";
  documentIds?: string[];
};

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = (await request.json().catch(() => ({}))) as BatchPayload;
  const documentIds = Array.from(new Set((payload.documentIds ?? []).filter(Boolean)));

  if (payload.action !== "bulk_delete" || documentIds.length === 0) {
    const response = NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (documentIds.length > 100) {
    const response = NextResponse.json({ success: false, error: "Too many documentIds. Max 100." }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createServiceSupabaseClient();
  const deletedDocumentIds: string[] = [];
  const failed: Array<{ documentId: string; error: string }> = [];

  for (const documentId of documentIds) {
    try {
      try {
        await createDocumentSnapshot({
          documentId,
          snapshotReason: "pre_bulk_delete",
          createdBy: appUser.id,
        });
      } catch (snapshotError) {
        log("warn", "api_admin_rag_documents_batch_snapshot_failed", requestId, {
          userId: appUser.id,
          documentId,
          error: snapshotError instanceof Error ? snapshotError.message : "unknown",
        });
      }

      const { error } = await supabase.from("rag_documents").delete().eq("id", documentId);
      if (error) {
        throw new Error(error.message);
      }

      deletedDocumentIds.push(documentId);
      await createAuditLog(supabase, {
        userId: appUser.id,
        domain: "admin_rag",
        entityType: "rag_document",
        entityId: documentId,
        action: "bulk_deleted",
        summary: "Documento RAG eliminado en operacion masiva",
        metadata: {
          requestId,
        },
      });
    } catch (error) {
      failed.push({
        documentId,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const response = NextResponse.json({
    success: failed.length === 0,
    deletedCount: deletedDocumentIds.length,
    deletedDocumentIds,
    failed,
  });
  response.headers.set("x-request-id", requestId);
  return response;
}
