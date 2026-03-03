import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  buildSystemAlertCandidates,
  createGeneralAlertSchema,
  sortGeneralAlerts,
  type GeneralAlertRecord,
} from "@/lib/alerts/general-alerts";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import type { FiscalAlertRecord } from "@/lib/fiscal/alerts";
import type { InvoiceRecord } from "@/lib/invoices/contracts";
import type { LaborMitigationActionRecord } from "@/lib/labor/assessments";
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

async function syncSystemAlerts(accessToken: string, userId: string) {
  const supabase = createUserScopedSupabaseClient(accessToken);

  const [fiscalResult, laborResult, invoiceResult, currentResult] = await Promise.all([
    supabase
      .from("fiscal_alerts")
      .select("id, alert_type, description, due_date, priority, status, workflow_status, presented_at, template_id, period_key, source, tax_regime, tax_model, created_at")
      .limit(100),
    supabase
      .from("labor_mitigation_actions")
      .select("id, assessment_id, title, description, status, due_date, sla_due_at, owner_name, owner_email, evidence_notes, closure_notes, checklist_items, evidence_links, started_at, completed_at, last_follow_up_at, created_at, updated_at")
      .limit(200),
    supabase
      .from("invoices")
      .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, series, invoice_number, recipient_email, sent_at, paid_at, payment_method, payment_reference, payment_notes, invoice_type, rectifies_invoice_id, rectification_reason, created_at")
      .limit(120),
    supabase
      .from("general_alerts")
      .select("id, source_key, status")
      .in("source", ["fiscal", "laboral", "facturacion"]),
  ]);

  if (fiscalResult.error) {
    throw new Error(fiscalResult.error.message);
  }
  if (laborResult.error) {
    throw new Error(laborResult.error.message);
  }
  if (invoiceResult.error) {
    throw new Error(invoiceResult.error.message);
  }
  if (currentResult.error) {
    throw new Error(currentResult.error.message);
  }

  const candidates = buildSystemAlertCandidates({
    fiscalAlerts: (fiscalResult.data ?? []) as FiscalAlertRecord[],
    laborActions: (laborResult.data ?? []) as LaborMitigationActionRecord[],
    invoices: (invoiceResult.data ?? []) as InvoiceRecord[],
  });

  if (candidates.length > 0) {
    const { error: upsertError } = await supabase.from("general_alerts").upsert(
      candidates.map((candidate) => ({
        user_id: userId,
        source_key: candidate.sourceKey,
        source: candidate.source,
        source_entity_type: candidate.sourceEntityType,
        source_entity_id: candidate.sourceEntityId,
        category: candidate.category,
        title: candidate.title,
        message: candidate.message,
        priority: candidate.priority,
        status: candidate.status,
        due_date: candidate.dueDate,
        link_href: candidate.linkHref,
        metadata: candidate.metadata,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,source_key" }
    );

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  const candidateKeys = new Set(candidates.map((candidate) => candidate.sourceKey));
  const staleIds = ((currentResult.data ?? []) as Array<{ id: string; source_key: string; status: string }>)
    .filter((item) => item.status === "pending" && !candidateKeys.has(item.source_key))
    .map((item) => item.id);

  if (staleIds.length > 0) {
    const { error: staleError } = await supabase
      .from("general_alerts")
      .update({
        status: "resolved",
        updated_at: new Date().toISOString(),
      })
      .in("id", staleIds);

    if (staleError) {
      throw new Error(staleError.message);
    }
  }
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

  const includeResolved = request.nextUrl.searchParams.get("includeResolved") === "true";
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;

  try {
    await syncSystemAlerts(auth.accessToken, auth.userId);
    const supabase = createUserScopedSupabaseClient(auth.accessToken);
    let query = supabase
      .from("general_alerts")
      .select("id, user_id, source_key, source, source_entity_type, source_entity_id, category, title, message, priority, status, due_date, link_href, metadata, read_at, browser_notified_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(80);

    if (!includeResolved) {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const alerts = sortGeneralAlerts((data ?? []) as GeneralAlertRecord[]).slice(0, safeLimit);
    const unreadCount = alerts.filter((item) => !item.read_at && item.status === "pending").length;
    const response = NextResponse.json({ success: true, alerts, unreadCount });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    log("error", "api_general_alerts_get_failed", requestId, {
      error: error instanceof Error ? error.message : "unknown",
    });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudieron cargar las alertas", "Unable to load alerts") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }
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

  const payload = createGeneralAlertSchema.safeParse(await request.json());
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
    .from("general_alerts")
    .insert({
      user_id: auth.userId,
      source_key: `manual:${randomUUID()}`,
      source: "manual",
      source_entity_type: "general_alert",
      source_entity_id: null,
      category: payload.data.category,
      title: payload.data.title,
      message: payload.data.message,
      priority: payload.data.priority,
      status: "pending",
      due_date: payload.data.dueDate,
      link_href: payload.data.linkHref,
      metadata: {
        createdManually: true,
      },
    })
    .select("id, user_id, source_key, source, source_entity_type, source_entity_id, category, title, message, priority, status, due_date, link_href, metadata, read_at, browser_notified_at, created_at, updated_at")
    .single();

  if (error || !data) {
    log("error", "api_general_alerts_post_failed", requestId, { error: error?.message ?? "unknown" });
    const response = NextResponse.json(
      { success: false, error: translate(locale, "No se pudo crear la alerta", "Unable to create alert") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: getAuditDomain(payload.data.category),
      entityType: "general_alert",
      entityId: data.id,
      action: "created",
      summary: `Alerta general creada: ${payload.data.title}`,
      metadata: payload.data,
    });
  } catch (auditError) {
    log("warn", "api_general_alerts_post_audit_failed", requestId, {
      alertId: data.id,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }

  const response = NextResponse.json({ success: true, alert: data });
  response.headers.set("x-request-id", requestId);
  return response;
}
