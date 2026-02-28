import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { getRequestId, log } from "@/lib/observability/logger";
import { listRagTraces, summarizeRagTraces } from "@/lib/observability/rag-traces";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    log("warn", "api_admin_observability_rag_forbidden", requestId, {
      userId: appUser?.id ?? null,
      role: appUser?.role ?? null,
    });
    const response = NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    summary: summarizeRagTraces(100),
    traces: listRagTraces(25),
  });
  response.headers.set("x-request-id", requestId);
  return response;
}
