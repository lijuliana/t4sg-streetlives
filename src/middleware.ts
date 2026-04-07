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
