import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { createLaborMitigationActionSchema, LABOR_MITIGATION_SELECT_FIELDS } from "@/lib/labor/assessments";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

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

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = createLaborMitigationActionSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { assessmentId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("labor_mitigation_actions")
    .insert({
      assessment_id: assessmentId,
      user_id: auth.userId,
      title: payload.data.title,
      description: payload.data.description ?? null,
      status: payload.data.status,
      due_date: payload.data.dueDate ?? null,
      owner_name: payload.data.ownerName ?? null,
      owner_email: payload.data.ownerEmail ?? null,
      evidence_notes: payload.data.evidenceNotes ?? null,
      closure_notes: payload.data.closureNotes ?? null,
      started_at: payload.data.status === "in_progress" ? new Date().toISOString() : null,
      completed_at: payload.data.status === "completed" ? new Date().toISOString() : null,
      last_follow_up_at:
        payload.data.evidenceNotes || payload.data.closureNotes || payload.data.status !== "pending"
          ? new Date().toISOString()
          : null,
    })
    .select(LABOR_MITIGATION_SELECT_FIELDS)
    .single();

  if (error) {
    log("error", "api_labor_mitigation_post_failed", requestId, { assessmentId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, action: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
