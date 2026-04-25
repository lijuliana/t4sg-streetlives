import "server-only";
import { auth0 } from "@/lib/auth0";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;

export async function lambdaFetch(path: string, init?: RequestInit): Promise<Response> {
  let token: string;
  try {
    ({ token } = await auth0.getAccessToken());
  } catch {
    return Response.json(
      { error: "Unauthorized", message: "Sign in required or access token could not be refreshed." },
      { status: 401 }
    );
  }

  if (!LAMBDA) {
    return Response.json(
      { error: "Configuration", message: "NEXT_PUBLIC_API_URL is not set." },
      { status: 503 }
    );
  }

  return fetch(`${LAMBDA}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}
