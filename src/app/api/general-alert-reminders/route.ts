import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  buildReminderRunAfter,
  createGeneralAlertReminderSchema,
  getNextReminderOccurrence,
  type GeneralAlertReminderRecord,
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

export async function GET(request: NextRequest) {
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

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("general_alert_reminders")
    .select("id, user_id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active, last_generated_for, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    log("error", "api_general_alert_reminders_get_failed", requestId, { error: error.message });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudieron cargar los recordatorios", "Unable to load reminders") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({
    success: true,
    reminders: (data ?? []) as GeneralAlertReminderRecord[],
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function POST(request: NextRequest) {
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

  const payload = createGeneralAlertReminderSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: translate(locale, "Payload invalido", "Invalid payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("general_alert_reminders")
    .insert({
      user_id: auth.userId,
      category: payload.data.category,
      title: payload.data.title,
      message: payload.data.message,
      priority: payload.data.priority,
      recurrence: payload.data.recurrence,
      anchor_date: payload.data.anchorDate,
      lead_days: payload.data.leadDays,
      link_href: payload.data.linkHref,
      is_active: true,
    })
    .select("id, user_id, category, title, message, priority, recurrence, anchor_date, lead_days, link_href, is_active, last_generated_for, created_at, updated_at")
    .single();

  if (error || !data) {
    log("error", "api_general_alert_reminders_post_failed", requestId, { error: error?.message ?? "unknown" });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudo crear el recordatorio", "Unable to create reminder") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const nextOccurrence = getNextReminderOccurrence({
    anchorDate: payload.data.anchorDate,
    recurrence: payload.data.recurrence,
  });

  await createAppJob({
    userId: auth.userId,
    jobKind: "general_alert_reminder_generation",
    payload: {
      reminderId: data.id,
      occurrenceDate: nextOccurrence,
    },
    runAfter: buildReminderRunAfter(nextOccurrence, payload.data.leadDays),
    maxAttempts: 3,
  });

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: getAuditDomain(payload.data.category),
      entityType: "general_alert_reminder",
      entityId: data.id,
      action: "created",
      summary: `Recordatorio recurrente creado: ${payload.data.title}`,
      metadata: payload.data,
    });
  } catch (auditError) {
    log("warn", "api_general_alert_reminders_post_audit_failed", requestId, {
      reminderId: data.id,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }

  const response = NextResponse.json({ success: true, reminder: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
