import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { listRecentAdminIngestJobs } from "@/lib/rag/admin-jobs";
import { getRequestId, log } from "@/lib/observability/logger";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();
  const { searchParams } = new URL(request.url);

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
  const domain = searchParams.get("domain")?.trim().toLowerCase() ?? "all";
  const topic = searchParams.get("topic")?.trim() ?? "";
  const query = searchParams.get("query")?.trim() ?? "";
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;

  let documentsQuery = supabase
    .from("rag_documents")
    .select("id, title, category, created_at, doc_metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (domain === "fiscal") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%FISCAL%");
  } else if (domain === "laboral") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%RIESGO_LABORAL%");
  } else if (domain === "mercado") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%MARCA_POSICIONAMIENTO%");
  }

  if (topic.length > 0) {
    documentsQuery = documentsQuery.ilike("doc_metadata->>topic", `%${topic}%`);
  }

  if (query.length > 0) {
    const escaped = query.replace(/[%_,]/g, " ").trim();
    documentsQuery = documentsQuery.or(
      [
        `title.ilike.%${escaped}%`,
        `doc_metadata->>notebook_title.ilike.%${escaped}%`,
        `doc_metadata->>topic.ilike.%${escaped}%`,
        `doc_metadata->>reason_for_fit.ilike.%${escaped}%`,
      ].join(",")
    );
  }

  const [{ count: documentCount }, { count: chunkCount }, { data: recentDocuments, error }, recentJobs] = await Promise.all([
    supabase.from("rag_documents").select("id", { count: "exact", head: true }),
    supabase.from("rag_chunks").select("id", { count: "exact", head: true }),
    documentsQuery,
    listRecentAdminIngestJobs(8),
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
    filters: {
      domain,
      topic,
      query,
      limit,
    },
    recentDocuments: recentDocuments ?? [],
    recentJobs,
  });
  response.headers.set("x-request-id", requestId);
  log("info", "api_admin_rag_status_succeeded", requestId, {
    userId: appUser.id,
    documents: documentCount ?? 0,
    chunks: chunkCount ?? 0,
  });
  return response;
}
