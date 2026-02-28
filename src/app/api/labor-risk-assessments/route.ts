import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { createLaborRiskAssessmentSchema } from "@/lib/labor/assessments";
import { resolveLocale, t } from "@/lib/i18n/messages";
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
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_labor_assessments_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("labor_risk_assessments")
    .select("id, scenario_description, risk_score, risk_level, recommendations, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    log("error", "api_labor_assessments_get_failed", requestId, { error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, assessments: data ?? [] });
  response.headers.set("x-request-id", requestId);
  log("info", "api_labor_assessments_get_succeeded", requestId, { count: (data ?? []).length });
  return response;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_labor_assessments_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = createLaborRiskAssessmentSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_labor_assessments_payload_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("labor_risk_assessments")
    .insert({
      user_id: auth.userId,
      scenario_description: payload.data.scenarioDescription,
      risk_score: payload.data.riskScore,
      risk_level: payload.data.riskLevel,
      recommendations: payload.data.recommendations,
    })
    .select("id, scenario_description, risk_score, risk_level, recommendations, created_at")
    .single();

  if (error) {
    log("error", "api_labor_assessments_post_failed", requestId, { error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, assessment: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_labor_assessments_post_succeeded", requestId, { assessmentId: data?.id ?? null });
  return response;
}
