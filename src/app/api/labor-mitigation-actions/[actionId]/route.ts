import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createAuditLog } from "@/lib/audit/logs";
import { validateAccessToken } from "@/lib/auth/token";
import {
  LABOR_MITIGATION_SELECT_FIELDS,
  type LaborMitigationActionRecord,
  updateLaborMitigationActionSchema,
} from "@/lib/labor/assessments";
import { resolveLocale, t } from "@/lib/i18n/messages";
import { getRequestId, log } from "@/lib/observability/logger";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

type RouteContext = {
  params: Promise<{ actionId: string }>;
};

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, userId: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, userId: user.id, error: null };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const payload = updateLaborMitigationActionSchema.safeParse(await request.json());
  if (!payload.success) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_payload") },
      { status: 400 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { actionId } = await context.params;
  const patch = payload.data;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data: currentAction, error: currentActionError } = await supabase
    .from("labor_mitigation_actions")
    .select(LABOR_MITIGATION_SELECT_FIELDS)
    .eq("id", actionId)
    .single();

  if (currentActionError || !currentAction) {
    log("error", "api_labor_mitigation_current_action_failed", requestId, {
      actionId,
      error: currentActionError?.message ?? "NOT_FOUND",
    });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const current = currentAction as unknown as LaborMitigationActionRecord;
  const updatePayload: Record<string, string | null> = {};
  if (patch.title !== undefined) updatePayload.title = patch.title;
  if (patch.description !== undefined) updatePayload.description = patch.description;
  if (patch.status !== undefined) updatePayload.status = patch.status;
  if (patch.dueDate !== undefined) updatePayload.due_date = patch.dueDate;
  if (patch.ownerName !== undefined) updatePayload.owner_name = patch.ownerName;
  if (patch.ownerEmail !== undefined) updatePayload.owner_email = patch.ownerEmail;
  if (patch.evidenceNotes !== undefined) updatePayload.evidence_notes = patch.evidenceNotes;
  if (patch.closureNotes !== undefined) updatePayload.closure_notes = patch.closureNotes;
  if (patch.status === "in_progress" && !current.started_at) {
    updatePayload.started_at = new Date().toISOString();
  }
  if (patch.status === "completed") {
    if (!current.started_at) {
      updatePayload.started_at = new Date().toISOString();
    }
    updatePayload.completed_at = new Date().toISOString();
  }
  if (patch.status && patch.status !== "completed" && current.completed_at) {
    updatePayload.completed_at = null;
  }
  if (patch.status && patch.status !== "in_progress" && patch.status !== "completed" && current.started_at) {
    updatePayload.started_at = current.started_at;
  }
  if (
    patch.status !== undefined ||
    patch.evidenceNotes !== undefined ||
    patch.closureNotes !== undefined ||
    patch.ownerName !== undefined ||
    patch.ownerEmail !== undefined
  ) {
    updatePayload.last_follow_up_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("labor_mitigation_actions")
    .update(updatePayload)
    .eq("id", actionId)
    .select(LABOR_MITIGATION_SELECT_FIELDS)
    .single();

  if (error) {
    log("error", "api_labor_mitigation_patch_failed", requestId, { actionId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true, action: data });
  response.headers.set("x-request-id", requestId);
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "labor",
      entityType: "labor_mitigation_action",
      entityId: actionId,
      action: "updated",
      summary: "Accion de mitigacion actualizada",
      metadata: patch,
    });
  } catch (auditError) {
    log("warn", "api_labor_mitigation_patch_audit_failed", requestId, {
      actionId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request.headers.get("x-request-id"));
  const locale = resolveLocale(request.headers.get("accept-language"));
  const auth = await getAuthenticatedContext();

  if (!auth.accessToken || !auth.userId) {
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.invalid_session") },
      { status: 401 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const { actionId } = await context.params;
  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { error } = await supabase.from("labor_mitigation_actions").delete().eq("id", actionId);

  if (error) {
    log("error", "api_labor_mitigation_delete_failed", requestId, { actionId, error: error.message });
    const response = NextResponse.json(
      { success: false, error: t(locale, "api.labor_assessments.db_error") },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("x-request-id", requestId);
  try {
    await createAuditLog(supabase, {
      userId: auth.userId,
      domain: "labor",
      entityType: "labor_mitigation_action",
      entityId: actionId,
      action: "deleted",
      summary: "Accion de mitigacion eliminada",
    });
  } catch (auditError) {
    log("warn", "api_labor_mitigation_delete_audit_failed", requestId, {
      actionId,
      error: auditError instanceof Error ? auditError.message : "unknown",
    });
  }
  return response;
}
