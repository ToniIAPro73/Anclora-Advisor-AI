import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { updateLaborRiskAssessmentSchema } from "@/lib/labor/assessments";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, error: null };
}

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_labor_assessment_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateLaborRiskAssessmentSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_labor_assessment_patch_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { assessmentId } = await context.params;
  const patch = payload.data;
  const updatePayload: Record<string, string | number | string[] | null> = {};
  if (patch.scenarioDescription !== undefined) updatePayload.scenario_description = patch.scenarioDescription;
  if (patch.riskScore !== undefined) updatePayload.risk_score = patch.riskScore;
  if (patch.riskLevel !== undefined) updatePayload.risk_level = patch.riskLevel;
  if (patch.recommendations !== undefined) updatePayload.recommendations = patch.recommendations;

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("labor_risk_assessments")
    .update(updatePayload)
    .eq("id", assessmentId)
    .select("id, scenario_description, risk_score, risk_level, recommendations, created_at")
    .single();

  if (error) {
    log("error", "api_labor_assessment_patch_failed", requestId, { assessmentId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, assessment: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_labor_assessment_patch_succeeded", requestId, { assessmentId });
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_labor_assessment_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { assessmentId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { error } = await supabase.from("labor_risk_assessments").delete().eq("id", assessmentId);

  if (error) {
    log("error", "api_labor_assessment_delete_failed", requestId, { assessmentId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("x-request-id", requestId);
  log("info", "api_labor_assessment_delete_succeeded", requestId, { assessmentId });
  return response;
}
