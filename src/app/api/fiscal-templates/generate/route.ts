import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { createAppJob } from "@/lib/operations/jobs";
import { getRequestId, log } from "@/lib/observability/logger";

const generateTemplatesSchema = z.object({
  horizonMonths: z.number().int().min(1).max(12).optional(),
  templateIds: z.array(z.string().uuid()).max(30).optional(),
});

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

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();

  if (!auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = generateTemplatesSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    const response = NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    const job = await createAppJob({
      userId: auth.userId,
      jobKind: "fiscal_template_generation",
      payload: {
        horizonMonths: payload.data.horizonMonths ?? 6,
        templateIds: payload.data.templateIds ?? [],
      },
      maxAttempts: 2,
    });

    const response = NextResponse.json({
      success: true,
      jobId: job.id,
      status: "queued",
    });
    response.headers.set("x-request-id", requestId);
    log("info", "api_fiscal_templates_generate_enqueued", requestId, { userId: auth.userId, jobId: job.id });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enqueue fiscal generation";
    log("error", "api_fiscal_templates_generate_failed", requestId, { userId: auth.userId, error: message });
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
