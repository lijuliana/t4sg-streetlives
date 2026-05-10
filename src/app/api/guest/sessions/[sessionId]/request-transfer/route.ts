import { NextResponse } from "next/server";
import { markTransferRequested } from "@/lib/transferRequestStore";

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
  if (!res.ok) throw new Error("M2M token failed");
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const { token } = await req.json().catch(() => ({}));

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  let m2mToken: string;
  try {
    m2mToken = await getM2MToken();
  } catch {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  // Verify the session token belongs to this session
  const sessionRes = await fetch(`${LAMBDA}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${m2mToken}`, "Content-Type": "application/json" },
  });
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const session = await sessionRes.json();
  if (session.session_user_token !== token) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 403 });
  }

  // Lambda has no transfer_requested field — track it in-process.
  markTransferRequested(sessionId);
  console.log(`[session:request-transfer] sessionId=${sessionId} → transfer_requested (guest)`);
  return NextResponse.json({ ok: true });
}
