import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { parseAdminStatusFilters } from "@/lib/rag/admin-status-filters";
import { getAdminStatusData } from "@/lib/rag/admin-status-service";
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

  try {
    const payload = await getAdminStatusData({
      supabase: createServiceSupabaseClient(),
      filters: parseAdminStatusFilters(searchParams),
      listRecentJobs: listRecentAdminIngestJobs,
    });

    const response = NextResponse.json({
      success: true,
      ...payload,
    });
    response.headers.set("x-request-id", requestId);
    log("info", "api_admin_rag_status_succeeded", requestId, {
      userId: appUser.id,
      documents: payload.counts.documents,
      chunks: payload.counts.chunks,
      filteredDocuments: payload.counts.filteredDocuments,
      offset: payload.filters.offset,
      limit: payload.filters.limit,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status error";
    log("error", "api_admin_rag_status_failed", requestId, { error: message });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
