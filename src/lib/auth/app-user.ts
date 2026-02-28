import type { User } from "@supabase/supabase-js";
import { getCurrentUserFromCookies } from "@/lib/auth/session";
import { normalizeAppRole, type AppRole } from "@/lib/auth/roles";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

type AppUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  organization_id: string | null;
  is_active: boolean | null;
};

export interface AppUserRecord {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  organizationId: string | null;
  isActive: boolean;
}

function getAuthUserFullName(user: User): string | null {
  const metadata = user.user_metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const fullName = metadata.full_name;
  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName;
  }

  const name = metadata.name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }

  return null;
}

function mapAppUserRow(row: AppUserRow): AppUserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: normalizeAppRole(row.role),
    organizationId: row.organization_id,
    isActive: row.is_active !== false,
  };
}

export async function syncAppUserRecord(authUser: User): Promise<AppUserRecord> {
  const supabase = createServiceSupabaseClient();
  const desiredEmail = authUser.email ?? "";
  const desiredFullName = getAuthUserFullName(authUser);

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id, email, full_name, role, organization_id, is_active")
    .eq("id", authUser.id)
    .maybeSingle<AppUserRow>();

  if (selectError) {
    throw new Error(`Unable to load app user record: ${selectError.message}`);
  }

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        id: authUser.id,
        email: desiredEmail,
        full_name: desiredFullName,
        role: "user",
        is_active: true,
      })
      .select("id, email, full_name, role, organization_id, is_active")
      .single<AppUserRow>();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Unable to create app user record");
    }

    return mapAppUserRow(inserted);
  }

  const nextEmail = desiredEmail || existing.email;
  const needsUpdate =
    existing.email !== nextEmail ||
    existing.full_name !== desiredFullName ||
    existing.is_active === false;

  if (!needsUpdate) {
    return mapAppUserRow(existing);
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      email: nextEmail,
      full_name: desiredFullName,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authUser.id)
    .select("id, email, full_name, role, organization_id, is_active")
    .single<AppUserRow>();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Unable to update app user record");
  }

  return mapAppUserRow(updated);
}

export async function getCurrentAppUserFromCookies(): Promise<AppUserRecord | null> {
  const authUser = await getCurrentUserFromCookies();
  if (!authUser) {
    return null;
  }

  return syncAppUserRecord(authUser);
}
