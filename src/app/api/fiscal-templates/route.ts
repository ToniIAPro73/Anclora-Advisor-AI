import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import { createFiscalTemplateSchema } from "@/lib/fiscal/templates";
import { getDefaultFiscalModel, getDefaultFiscalRegime } from "@/lib/fiscal/alerts";
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
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alert_templates")
    .select("id, alert_type, description, priority, recurrence, due_day, due_month, start_date, is_active, tax_regime, tax_model, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    log("error", "api_fiscal_templates_get_failed", requestId, { error: error.message, userId: auth.userId });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, templates: data ?? [] });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = createFiscalTemplateSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alert_templates")
    .insert({
      user_id: auth.userId,
      alert_type: payload.data.alertType,
      description: payload.data.description ?? null,
      priority: payload.data.priority,
      recurrence: payload.data.recurrence,
      due_day: payload.data.dueDay,
      due_month: payload.data.dueMonth ?? null,
      start_date: payload.data.startDate,
      is_active: payload.data.isActive ?? true,
      tax_regime: payload.data.taxRegime ?? getDefaultFiscalRegime(payload.data.alertType),
      tax_model: payload.data.taxModel ?? getDefaultFiscalModel(payload.data.alertType),
    })
    .select("id, alert_type, description, priority, recurrence, due_day, due_month, start_date, is_active, tax_regime, tax_model, created_at, updated_at")
    .single();

  if (error) {
    log("error", "api_fiscal_templates_post_failed", requestId, { error: error.message, userId: auth.userId });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, template: data });
  response.headers.set("x-request-id", requestId);
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "fiscal",
      entityType: "fiscal_template",
      entityId: data?.id ?? null,
      action: "created",
      summary: "Plantilla fiscal creada",
      metadata: {
        recurrence: payload.data.recurrence,
        dueDay: payload.data.dueDay,
        taxRegime: payload.data.taxRegime ?? getDefaultFiscalRegime(payload.data.alertType),
        taxModel: payload.data.taxModel ?? getDefaultFiscalModel(payload.data.alertType),
      },
    });
  } catch (auditError) {
    log("warn", "api_fiscal_templates_post_audit_failed", requestId, {
      templateId: data?.id ?? null,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}
