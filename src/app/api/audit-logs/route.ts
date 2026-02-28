import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { AUDIT_DOMAIN_VALUES, AUDIT_LOG_SELECT_FIELDS } from "@/lib/audit/logs";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

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

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const domain = request.nextUrl.searchParams.get("domain");
  const limit = Math.max(1, Math.min(20, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10) || 8));
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  let query = supabase
    .from("app_audit_logs")
    .select(AUDIT_LOG_SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (domain && AUDIT_DOMAIN_VALUES.includes(domain as (typeof AUDIT_DOMAIN_VALUES)[number])) {
    query = query.eq("domain", domain);
  }

  const { data, error } = await query;
  if (error) {
    log("error", "api_audit_logs_get_failed", requestId, { error: error.message, userId: auth.userId, domain });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, logs: data ?? [] });
  response.headers.set("x-request-id", requestId);
  return response;
}

