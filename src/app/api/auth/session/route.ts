import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/logs";
import { getCurrentUserFromCookies } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { syncAppUserRecord } from "@/lib/auth/app-user";
import { validateAccessToken } from "@/lib/auth/token";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

const saveSessionSchema = z.object({
  accessToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = saveSessionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload for session creation." },
      { status: 400 }
    );
  }

  const { user } = await validateAccessToken(parsed.data.accessToken);
  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid access token." }, { status: 401 });
  }
  const appUser = await syncAppUserRecord(user);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, parsed.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  try {
    await createAuditLog(createServiceSupabaseClient(), {
      userId: appUser.id,
      domain: "admin_rag",
      entityType: "auth_session",
      entityId: appUser.id,
      action: "session_started",
      summary: `Sesion iniciada para ${appUser.email}`,
      metadata: {
        role: appUser.role,
      },
    });
  } catch {
    // Session creation must not fail because of audit logging.
  }
  return response;
}

export async function DELETE() {
  const currentUser = await getCurrentUserFromCookies();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  if (currentUser?.id) {
    try {
      await createAuditLog(createServiceSupabaseClient(), {
        userId: currentUser.id,
        domain: "admin_rag",
        entityType: "auth_session",
        entityId: currentUser.id,
        action: "session_ended",
        summary: `Sesion cerrada para ${currentUser.email ?? currentUser.id}`,
      });
    } catch {
      // Logout must not fail because of audit logging.
    }
  }
  return response;
}

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } });
}
