import type { SupabaseClient } from "@supabase/supabase-js";

export const AUDIT_DOMAIN_VALUES = ["fiscal", "labor", "invoices", "admin_rag"] as const;
export type AuditDomain = (typeof AUDIT_DOMAIN_VALUES)[number];

export interface AuditLogRecord {
  id: string;
  user_id: string;
  domain: AuditDomain;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const AUDIT_LOG_SELECT_FIELDS = [
  "id",
  "user_id",
  "domain",
  "entity_type",
  "entity_id",
  "action",
  "summary",
  "metadata",
  "created_at",
].join(", ");

type AuditInsertInput = {
  userId: string;
  domain: AuditDomain;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export async function createAuditLog(
  supabase: SupabaseClient,
  input: AuditInsertInput
): Promise<AuditLogRecord> {
  const { data, error } = await supabase
    .from("app_audit_logs")
    .insert({
      user_id: input.userId,
      domain: input.domain,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select(AUDIT_LOG_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create audit log");
  }

  return data as unknown as AuditLogRecord;
}
