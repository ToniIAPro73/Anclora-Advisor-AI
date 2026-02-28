import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    log("warn", "api_admin_rag_status_forbidden", requestId, {
      userId: appUser?.id ?? null,
      role: appUser?.role ?? null,
    });
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createServiceSupabaseClient();
  const [{ count: documentCount }, { count: chunkCount }, { data: recentDocuments, error }] = await Promise.all([
    supabase.from("rag_documents").select("id", { count: "exact", head: true }),
    supabase.from("rag_chunks").select("id", { count: "exact", head: true }),
    supabase
      .from("rag_documents")
      .select("id, title, category, created_at, doc_metadata")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (error) {
    log("error", "api_admin_rag_status_failed", requestId, { error: error.message });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    counts: {
      documents: documentCount ?? 0,
      chunks: chunkCount ?? 0,
    },
    recentDocuments: recentDocuments ?? [],
  });
  response.headers.set("x-request-id", requestId);
  log("info", "api_admin_rag_status_succeeded", requestId, {
    userId: appUser.id,
    documents: documentCount ?? 0,
    chunks: chunkCount ?? 0,
  });
  return response;
}
