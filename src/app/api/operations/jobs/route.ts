import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { listRecentAppJobsForUser, listRecentEmailOutboxForUser } from "@/lib/operations/jobs";
import { processPendingAppJobs } from "@/lib/operations/processors";
import { getRequestId, log } from "@/lib/observability/logger";

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { userId: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { userId: null, error: error ?? "Invalid session token" };
  }

  return { userId: user.id, error: null };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();

  if (!auth.userId) {
    log("warn", "api_operations_jobs_get_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const [jobs, emailOutbox] = await Promise.all([
      listRecentAppJobsForUser(auth.userId, 10),
      listRecentEmailOutboxForUser(auth.userId, 10),
    ]);

    const response = NextResponse.json({
      success: true,
      jobs,
      emailOutbox,
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown operations error";
    log("error", "api_operations_jobs_get_failed", requestId, { error: message, userId: auth.userId });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();

  if (!auth.userId) {
    log("warn", "api_operations_jobs_post_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const result = await processPendingAppJobs({
      userId: auth.userId,
      limit: Math.max(1, Math.min(25, body.limit ?? 10)),
    });

    const response = NextResponse.json({
      success: true,
      result,
    });
    response.headers.set("x-request-id", requestId);
    log("info", "api_operations_jobs_post_succeeded", requestId, { userId: auth.userId, ...result });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown operations processing error";
    log("error", "api_operations_jobs_post_failed", requestId, { error: message, userId: auth.userId });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
