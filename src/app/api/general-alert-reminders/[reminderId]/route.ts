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

async function deletePendingReminderJobs(params: {
  reminderId: string;
  userId: string;
  accessToken: string;
}): Promise<void> {
  const supabase = createUserScopedSupabaseClient(params.accessToken);
  const { data, error } = await supabase
    .from("app_jobs")
    .select("id, payload")
    .eq("job_kind", "general_alert_reminder_generation")
    .eq("user_id", params.userId)
    .in("status", ["pending", "running"])
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const idsToDelete = (data ?? [])
    .filter((job) => {
      const payload = job.payload as Record<string, unknown> | null;
      return payload?.reminderId === params.reminderId;
    })
    .map((job) => job.id);

  if (idsToDelete.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("app_jobs")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

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
    .select("id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active")
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

  const updatePayload: Record<string, boolean | number | string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.data.category !== undefined) {
    updatePayload.category = payload.data.category;
  }
  if (payload.data.title !== undefined) {
    updatePayload.title = payload.data.title;
  }
  if (payload.data.message !== undefined) {
    updatePayload.message = payload.data.message;
  }
  if (payload.data.priority !== undefined) {
    updatePayload.priority = payload.data.priority;
  }
  if (payload.data.recurrence !== undefined) {
    updatePayload.recurrence = payload.data.recurrence;
  }
  if (payload.data.anchorDate !== undefined) {
    updatePayload.anchor_date = payload.data.anchorDate;
  }
  if (payload.data.leadDays !== undefined) {
    updatePayload.lead_days = payload.data.leadDays;
  }
  if (payload.data.linkHref !== undefined) {
    updatePayload.link_href = payload.data.linkHref;
  }
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

  const scheduleFieldsChanged =
    payload.data.recurrence !== undefined ||
    payload.data.anchorDate !== undefined ||
    payload.data.leadDays !== undefined ||
    payload.data.isActive !== undefined;

  if (scheduleFieldsChanged) {
    try {
      await deletePendingReminderJobs({
        reminderId,
        userId: auth.userId,
        accessToken: auth.accessToken,
      });
    } catch (jobsError) {
      log("warn", "api_general_alert_reminders_patch_jobs_cleanup_failed", requestId, {
        reminderId,
        error: jobsError instanceof Error ? jobsError.message : "unknown",
      });
    }
  }

  if (data.is_active) {
    const nextOccurrence = getNextReminderOccurrence({
      anchorDate: data.anchor_date,
      recurrence: data.recurrence as "monthly" | "quarterly" | "yearly",
    });
    await createAppJob({
      userId: auth.userId,
      jobKind: "general_alert_reminder_generation",
      payload: {
        reminderId,
        occurrenceDate: nextOccurrence,
      },
      runAfter: buildReminderRunAfter(nextOccurrence, data.lead_days),
      maxAttempts: 3,
    });
  }

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: getAuditDomain(data.category),
      entityType: "general_alert_reminder",
      entityId: reminderId,
      action: "updated",
      summary: "Recordatorio recurrente actualizado",
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
