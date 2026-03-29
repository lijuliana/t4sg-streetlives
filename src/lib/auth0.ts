import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const ROLES_CLAIM = "https://streetlives.app/roles";

export const auth0 = new Auth0Client({
  async beforeSessionSaved(session) {
    return {
      ...session,
      user: {
        ...session.user,
        [ROLES_CLAIM]: (session.user[ROLES_CLAIM] as string[]) ?? [],
      },
    };
  },

  async onCallback(error, ctx, session) {
    const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL!;

    if (error) {
      return NextResponse.redirect(new URL("/auth/signin", base));
    }

    const roles: string[] = (session?.user?.[ROLES_CLAIM] as string[]) ?? [];

    if (roles.includes("navigator")) {
      return NextResponse.redirect(new URL("/navigator/dashboard", base));
    }
    if (roles.includes("supervisor")) {
      return NextResponse.redirect(new URL("/supervisor/dashboard", base));
    }
    return NextResponse.redirect(new URL("/chat", base));
  },
});
