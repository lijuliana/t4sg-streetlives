import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const ROLES_CLAIM = "https://streetlives.app/roles";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  // /chat is for anonymous users only — anyone logged in gets sent to their dashboard
  if (pathname.startsWith("/chat")) {
    const session = await auth0.getSession(request);
    if (session) {
      const roles: string[] = (session.user?.[ROLES_CLAIM] as string[]) ?? [];
      if (roles.includes("supervisor")) return NextResponse.redirect(new URL("/dashboard/supervisor", request.nextUrl.origin));
      if (roles.includes("navigator")) return NextResponse.redirect(new URL("/dashboard/navigator", request.nextUrl.origin));
      // Logged in but no recognized role — send home, not to chat
      return NextResponse.redirect(new URL("/", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Role-protected routes
  if (
    pathname.startsWith("/dashboard/navigator") ||
    pathname.startsWith("/dashboard/supervisor")
  ) {
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

    return await auth0.middleware(request);
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
