import "server-only";
import { auth0 } from "@/lib/auth0";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;

export async function lambdaFetch(path: string, init?: RequestInit): Promise<Response> {
  const { token } = await auth0.getAccessToken();
  return fetch(`${LAMBDA}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}
