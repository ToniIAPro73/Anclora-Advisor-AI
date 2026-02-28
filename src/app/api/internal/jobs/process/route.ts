import { NextRequest, NextResponse } from "next/server";
import { processPendingAppJobsForAllUsers } from "@/lib/operations/processors";
import { getRequestId, log } from "@/lib/observability/logger";

function getCronSecret(): string | null {
  return process.env.APP_JOBS_CRON_SECRET?.trim() || null;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-app-jobs-secret");
  if (headerSecret && headerSecret === secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));

  if (!getCronSecret()) {
    log("error", "api_internal_jobs_process_secret_missing", requestId);
    const response = NextResponse.json(
      { success: false, error: "APP_JOBS_CRON_SECRET_NOT_CONFIGURED" },
      { status: 503 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!isAuthorized(request)) {
    log("warn", "api_internal_jobs_process_unauthorized", requestId);
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      userLimit?: number;
      jobsPerUserLimit?: number;
    };
    const result = await processPendingAppJobsForAllUsers({
      userLimit: Math.max(1, Math.min(500, body.userLimit ?? 100)),
      jobsPerUserLimit: Math.max(1, Math.min(50, body.jobsPerUserLimit ?? 25)),
    });
    const response = NextResponse.json({ success: true, result });
    response.headers.set("x-request-id", requestId);
    log("info", "api_internal_jobs_process_succeeded", requestId, result);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cron processing error";
    log("error", "api_internal_jobs_process_failed", requestId, { error: message });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
