import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { validateAccessToken } from "@/lib/auth/token";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export async function getCurrentUserFromCookies(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!accessToken) {
    return null;
  }

  const { user } = await validateAccessToken(accessToken);
  return user;
}

export async function getAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
