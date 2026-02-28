export const APP_ROLES = ["admin", "partner", "user"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function normalizeAppRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "partner") {
    return role;
  }

  return "user";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeAppRole(role) === "admin";
}
