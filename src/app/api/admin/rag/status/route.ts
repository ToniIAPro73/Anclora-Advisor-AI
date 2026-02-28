import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { escapeIlikeValue, parseAdminStatusFilters } from "@/lib/rag/admin-status-filters";
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
  const { domain, topic, query, limit, offset } = parseAdminStatusFilters(searchParams);

  let documentsQuery = supabase.from("rag_documents").select("id, title, category, created_at, doc_metadata").order("created_at", { ascending: false });
  let filteredCountQuery = supabase.from("rag_documents").select("id", { count: "exact", head: true });

  if (domain === "fiscal") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%FISCAL%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%FISCAL%");
  } else if (domain === "laboral") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%RIESGO_LABORAL%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%RIESGO_LABORAL%");
  } else if (domain === "mercado") {
    documentsQuery = documentsQuery.ilike("doc_metadata->>notebook_title", "%MARCA_POSICIONAMIENTO%");
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>notebook_title", "%MARCA_POSICIONAMIENTO%");
  }

  if (topic.length > 0) {
    documentsQuery = documentsQuery.ilike("doc_metadata->>topic", `%${topic}%`);
    filteredCountQuery = filteredCountQuery.ilike("doc_metadata->>topic", `%${topic}%`);
  }

  if (query.length > 0) {
    const escaped = escapeIlikeValue(query);
    const orClause = [
      `title.ilike.%${escaped}%`,
      `doc_metadata->>notebook_title.ilike.%${escaped}%`,
      `doc_metadata->>topic.ilike.%${escaped}%`,
      `doc_metadata->>reason_for_fit.ilike.%${escaped}%`,
    ].join(",");
    documentsQuery = documentsQuery.or(orClause);
    filteredCountQuery = filteredCountQuery.or(orClause);
  }

  documentsQuery = documentsQuery.range(offset, offset + limit - 1);

  const [{ count: documentCount }, { count: chunkCount }, { count: filteredDocumentCount, error: filteredCountError }, { data: recentDocuments, error }, recentJobs] = await Promise.all([
    supabase.from("rag_documents").select("id", { count: "exact", head: true }),
    supabase.from("rag_chunks").select("id", { count: "exact", head: true }),
    filteredCountQuery,
    documentsQuery,
    listRecentAdminIngestJobs(8),
  ]);

  if (error || filteredCountError) {
    const message = error?.message ?? filteredCountError?.message ?? "Unknown status error";
    log("error", "api_admin_rag_status_failed", requestId, { error: message });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    counts: {
      documents: documentCount ?? 0,
      chunks: chunkCount ?? 0,
      filteredDocuments: filteredDocumentCount ?? 0,
    },
    filters: {
      domain,
      topic,
      query,
      limit,
      offset,
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
