import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const ROLES_CLAIM = "https://streetlives.app/roles";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: "openid profile email",
  },

  async beforeSessionSaved(session) {
    return {
      ...session,
      user: {
        ...session.user,
        [ROLES_CLAIM]: (session.user[ROLES_CLAIM] as string[]) ?? [],
      },
    };
  },

  async onCallback(error, ctx) {
    const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL!;

    if (error) {
      // Log the real error — previously redirecting to /auth/signin caused an infinite loop
      // because the auth0 middleware re-triggered login on that path.
      console.error("[auth0] onCallback error:", error);
      return NextResponse.redirect(new URL("/", base));
    }

    return NextResponse.redirect(new URL("/", base));
  },
});
