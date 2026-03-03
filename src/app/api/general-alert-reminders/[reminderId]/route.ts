import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  buildReminderRunAfter,
  getNextReminderOccurrence,
  updateGeneralAlertReminderSchema,
} from "@/lib/alerts/general-alert-reminders";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import { createAppJob } from "@/lib/operations/jobs";
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
  params: Promise<{ reminderId: string }>;
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

  const payload = updateGeneralAlertReminderSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Payload invalido", "Invalid payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { reminderId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: existing, error: existingError } = await supabase
    .from("general_alert_reminders")
    .select("id, category, is_active, recurrence, anchor_date, lead_days")
    .eq("id", reminderId)
    .single();

  if (existingError || !existing) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Recordatorio no encontrado", "Reminder not found") },
      { status: 404 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const updatePayload: Record<string, boolean | string> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.data.isActive !== undefined) {
    updatePayload.is_active = payload.data.isActive;
  }

  const { data, error } = await supabase
    .from("general_alert_reminders")
    .update(updatePayload)
    .eq("id", reminderId)
    .select("id, user_id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active, last_generated_for, created_at, updated_at")
    .single();

  if (error || !data) {
    log("error", "api_general_alert_reminders_patch_failed", requestId, { reminderId, error: error?.message ?? "unknown" });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudo actualizar el recordatorio", "Unable to update reminder") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (payload.data.isActive === true && existing.is_active === false) {
    const { data: existingJobs, error: jobsError } = await supabase
      .from("app_jobs")
      .select("id")
      .eq("job_kind", "general_alert_reminder_generation")
      .in("status", ["pending", "running"])
      .contains("payload", { reminderId })
      .limit(1);

    if (jobsError) {
      log("warn", "api_general_alert_reminders_patch_jobs_check_failed", requestId, {
        reminderId,
        error: jobsError.message,
      });
    }

    if (!existingJobs || existingJobs.length === 0) {
      const nextOccurrence = getNextReminderOccurrence({
        anchorDate: existing.anchor_date,
        recurrence: existing.recurrence as "monthly" | "quarterly" | "yearly",
      });
      await createAppJob({
        userId: auth.userId,
        jobKind: "general_alert_reminder_generation",
        payload: {
          reminderId,
          occurrenceDate: nextOccurrence,
        },
        runAfter: buildReminderRunAfter(nextOccurrence, existing.lead_days),
        maxAttempts: 3,
      });
    }
  }

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: getAuditDomain(existing.category),
      entityType: "general_alert_reminder",
      entityId: reminderId,
      action: "updated",
      summary: `Recordatorio recurrente ${payload.data.isActive ? "activado" : "pausado"}`,
      metadata: payload.data,
    });
  } catch (auditError) {
    log("warn", "api_general_alert_reminders_patch_audit_failed", requestId, {
      reminderId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }

  const response = NextResponse.json({ success: true, reminder: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
