import { NextResponse } from "next/server";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN!;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID!;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET!;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE!;

async function getM2MToken(): Promise<string> {
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });
  if (!res.ok) throw new Error("Failed to get M2M token");
  const data = await res.json();
  return data.access_token as string;
}

async function lambdaM2M(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${LAMBDA}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { sessionToken } = await req.json().catch(() => ({}));

  if (!sessionToken) {
    return NextResponse.json({ error: "sessionToken required" }, { status: 400 });
  }

  let m2mToken: string;
  try {
    m2mToken = await getM2MToken();
  } catch {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  // Fetch session and verify token matches
  const sessionRes = await lambdaM2M(m2mToken, `/sessions/${sessionId}`);
  if (!sessionRes.ok) {
    const data = await sessionRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: sessionRes.status });
  }
  const session = await sessionRes.json();
  if (session.session_user_token !== sessionToken) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 403 });
  }

  if (session.status === "closed") {
    return NextResponse.json({ ok: true });
  }

  // Close the session — submitted_for_review stays false (user-ended, not navigator-submitted)
  const closeRes = await lambdaM2M(m2mToken, `/sessions/${sessionId}/close`, { method: "POST" });
  if (!closeRes.ok) {
    const data = await closeRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: closeRes.status });
  }

  return NextResponse.json({ ok: true });
}
