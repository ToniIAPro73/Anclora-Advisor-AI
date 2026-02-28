import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { isAdminRole } from "@/lib/auth/roles";
import { validateAccessToken } from "@/lib/auth/token";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

function buildRedirect(request: NextRequest, pathname: string, next?: string) {
  const url = new URL(pathname, request.url);
  if (next) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isLoginRoute = pathname === "/login";

  if (!isDashboardRoute && !isLoginRoute) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    if (isDashboardRoute) {
      const next = `${pathname}${search}`;
      return buildRedirect(request, "/login", next);
    }
    return NextResponse.next();
  }

  const { user } = await validateAccessToken(accessToken);

  if (!user) {
    if (isDashboardRoute) {
      const next = `${pathname}${search}`;
      return buildRedirect(request, "/login", next);
    }
    return NextResponse.next();
  }

  if (isLoginRoute) {
    return buildRedirect(request, "/dashboard/chat");
  }

  if (isAdminRoute) {
    const roleResponse = await fetch(
      `${getSupabaseUrl()}/rest/v1/users?select=role,is_active&id=eq.${user.id}&limit=1`,
      {
        headers: {
          apikey: getSupabaseAnonKey(),
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!roleResponse.ok) {
      return buildRedirect(request, "/dashboard/chat");
    }

    const rows = (await roleResponse.json()) as Array<{ role: string | null; is_active: boolean | null }>;
    const current = rows[0];

    if (!current || current.is_active === false || !isAdminRole(current.role)) {
      return buildRedirect(request, "/dashboard/chat");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
