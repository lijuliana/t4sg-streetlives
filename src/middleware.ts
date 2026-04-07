import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const ROLES_CLAIM = "https://streetlives.app/roles";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  // /chat is public
  if (pathname.startsWith("/chat")) {
    return NextResponse.next();
  }

  // Role-protected routes — run auth0 middleware first so it can refresh
  // the access token before we try to read the session/roles.
  if (
    pathname.startsWith("/dashboard/navigator") ||
    pathname.startsWith("/dashboard/supervisor") ||
    pathname.startsWith("/dashboard/user")
  ) {
    const authRes = await auth0.middleware(request);

    // auth0 returned a redirect (e.g. session expired → login page) — follow it
    if (authRes.status !== 200) {
      return authRes;
    }

    const session = await auth0.getSession(request);

    if (!session) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const roles: string[] = (session.user?.[ROLES_CLAIM] as string[]) ?? [];

    if (pathname.startsWith("/dashboard/navigator") && !roles.includes("navigator")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (pathname.startsWith("/dashboard/supervisor") && !roles.includes("supervisor")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (pathname.startsWith("/dashboard/user") && (roles.includes("navigator") || roles.includes("supervisor"))) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Return auth0's response so any refreshed-token cookies are sent to the client
    return authRes;
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
