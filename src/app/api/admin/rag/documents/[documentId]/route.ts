import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

interface RouteContext {
  params: Promise<{ documentId: string }>;
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
  return response;
}
