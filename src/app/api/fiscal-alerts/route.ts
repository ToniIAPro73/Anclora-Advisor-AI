import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";
import { createFiscalAlertSchema } from "@/lib/fiscal/alerts";

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
    log("warn", "api_fiscal_alerts_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alerts")
    .select("id, alert_type, description, due_date, priority, status, created_at")
    .order("due_date", { ascending: true })
    .limit(60);

  if (error) {
    log("error", "api_fiscal_alerts_get_failed", requestId, { error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, alerts: data ?? [] });
  response.headers.set("x-request-id", requestId);
  log("info", "api_fiscal_alerts_get_succeeded", requestId, { count: (data ?? []).length });
  return response;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    log("warn", "api_fiscal_alerts_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = createFiscalAlertSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_fiscal_alerts_payload_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alerts")
    .insert({
      user_id: auth.userId,
      alert_type: payload.data.alertType,
      description: payload.data.description ?? null,
      due_date: payload.data.dueDate,
      priority: payload.data.priority,
      status: "pending",
    })
    .select("id, alert_type, description, due_date, priority, status, created_at")
    .single();

  if (error) {
    log("error", "api_fiscal_alerts_post_failed", requestId, { error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, alert: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_fiscal_alerts_post_succeeded", requestId, { alertId: data?.id ?? null });
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "fiscal",
      entityType: "fiscal_alert",
      entityId: data?.id ?? null,
      action: "created",
      summary: `Alerta fiscal creada: ${payload.data.alertType}`,
      metadata: {
        priority: payload.data.priority,
        dueDate: payload.data.dueDate,
      },
    });
  } catch (auditError) {
    log("warn", "api_fiscal_alerts_post_audit_failed", requestId, {
      alertId: data?.id ?? null,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}
