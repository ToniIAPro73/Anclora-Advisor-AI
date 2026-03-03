import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { updateGeneralAlertSchema } from "@/lib/alerts/general-alerts";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
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

function getLocale(request: NextRequest): "es" | "en" {
  return request.headers.get("accept-language")?.toLowerCase().startsWith("en") ? "en" : "es";
}

function translate(locale: "es" | "en", es: string, en: string): string {
  return locale === "en" ? en : es;
}

function getAuditDomain(category: string): "fiscal" | "labor" | "invoices" {
  if (category === "fiscal") return "fiscal";
  if (category === "laboral") return "labor";
  return "invoices";
}

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = getLocale(request);
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Sesion invalida", "Invalid session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateGeneralAlertSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Payload invalido", "Invalid payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { alertId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: existing, error: existingError } = await supabase
    .from("general_alerts")
    .select("id, source, category")
    .eq("id", alertId)
    .single();

  if (existingError || !existing) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Alerta no encontrada", "Alert not found") },
      { status: 404 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (payload.data.status !== undefined && existing.source !== "manual" && existing.source !== "reminder") {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Solo las alertas manuales o recurrentes pueden cambiar de estado", "Only manual or reminder alerts can change status") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const updatePayload: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.data.read !== undefined) {
    updatePayload.read_at = payload.data.read ? new Date().toISOString() : null;
  }
  if (payload.data.status !== undefined) {
    updatePayload.status = payload.data.status;
  }

  const { data, error } = await supabase
    .from("general_alerts")
    .update(updatePayload)
    .eq("id", alertId)
    .select("id, user_id, source_key, source, source_entity_type, source_entity_id, category, title, message, priority, status, due_date, link_href, metadata, read_at, browser_notified_at, created_at, updated_at")
    .single();

  if (error || !data) {
    log("error", "api_general_alert_patch_failed", requestId, { alertId, error: error?.message ?? "unknown" });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudo actualizar la alerta", "Unable to update alert") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: getAuditDomain(existing.category),
      entityType: "general_alert",
      entityId: alertId,
      action: payload.data.status ? "status_updated" : "read_updated",
      summary: payload.data.status
        ? `Estado de alerta general actualizado a ${payload.data.status}`
        : `Lectura de alerta general actualizada`,
      metadata: payload.data,
    });
  } catch (auditError) {
    log("warn", "api_general_alert_patch_audit_failed", requestId, {
      alertId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }

  const response = NextResponse.json({ success: true, alert: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
