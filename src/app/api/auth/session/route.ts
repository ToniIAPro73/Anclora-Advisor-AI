import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromCookies } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { syncAppUserRecord } from "@/lib/auth/app-user";
import { validateAccessToken } from "@/lib/auth/token";

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
  await syncAppUserRecord(user);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, parsed.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } });
}
