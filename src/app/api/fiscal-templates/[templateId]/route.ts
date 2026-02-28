import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { normalizeFiscalTemplatePatch, updateFiscalTemplateSchema } from "@/lib/fiscal/templates";
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
  params: Promise<{ templateId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateFiscalTemplateSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.fiscal_alerts.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { templateId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("fiscal_alert_templates")
    .update(normalizeFiscalTemplatePatch(payload.data))
    .eq("id", templateId)
    .select("id, alert_type, description, priority, recurrence, due_day, due_month, start_date, is_active, created_at, updated_at")
    .single();

  if (error) {
    log("error", "api_fiscal_template_patch_failed", requestId, { error: error.message, templateId });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, template: data });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken) {
    const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { templateId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { error } = await supabase.from("fiscal_alert_templates").delete().eq("id", templateId);

  if (error) {
    log("error", "api_fiscal_template_delete_failed", requestId, { error: error.message, templateId });
    const response = NextResponse.json({ success: false, error: error.message }, { status: 500 });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("x-request-id", requestId);
  return response;
}
