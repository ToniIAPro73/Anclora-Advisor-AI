import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { updateFiscalAlertSchema } from "@/lib/fiscal/alerts";
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
  params: Promise<{ alertId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_fiscal_alert_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateFiscalAlertSchema.safeParse(await request.json());
  if (!payload.success) {
    log("warn", "api_fiscal_alert_patch_invalid", requestId, { issues: payload.error.issues.length });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { alertId } = await context.params;
  const patch = payload.data;
  const updatePayload: Record<string, string | null> = {};
  if (patch.alertType !== undefined) updatePayload.alert_type = patch.alertType;
  if (patch.description !== undefined) updatePayload.description = patch.description;
  if (patch.dueDate !== undefined) updatePayload.due_date = patch.dueDate;
  if (patch.priority !== undefined) updatePayload.priority = patch.priority;
  if (patch.status !== undefined) updatePayload.status = patch.status;

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alerts")
    .update(updatePayload)
    .eq("id", alertId)
    .select("id, alert_type, description, due_date, priority, status, created_at")
    .single();

  if (error) {
    log("error", "api_fiscal_alert_patch_failed", requestId, { alertId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, alert: data });
  response.headers.set("x-request-id", requestId);
  log("info", "api_fiscal_alert_patch_succeeded", requestId, { alertId });
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    log("warn", "api_fiscal_alert_auth_failed", requestId, { reason: auth.error ?? "unauthorized" });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { alertId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { error } = await supabase.from("fiscal_alerts").delete().eq("id", alertId);

  if (error) {
    log("error", "api_fiscal_alert_delete_failed", requestId, { alertId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("x-request-id", requestId);
  log("info", "api_fiscal_alert_delete_succeeded", requestId, { alertId });
  return response;
}
