import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";
import { markTransferRequested, getSessionNeedCategory } from "@/lib/transferRequestStore";

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
  if (!res.ok) throw new Error(`M2M token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const res = await lambdaFetch(`/sessions/${sessionId}`);
  const data = await res.json();
  const storedCategory = getSessionNeedCategory(sessionId);
  if (storedCategory && res.ok) {
    data.need_category = storedCategory;
  }
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));

  // transfer_requested is not a Lambda field — handle it here and strip it before forwarding.
  if (body.transfer_requested) {
    markTransferRequested(sessionId);
  }
  const { transfer_requested: _, ...lambdaBody } = body;

  if (Object.keys(lambdaBody).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const res = await lambdaFetch(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(lambdaBody),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let m2mToken: string;
  try {
    m2mToken = await getM2MToken();
  } catch (err) {
    console.error("[session:delete] M2M token failed:", err);
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const res = await fetch(`${LAMBDA}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${m2mToken}`,
    },
  });

  const raw = await res.text();
  console.log(`[session:delete] ← status=${res.status} body=${raw}`);

  if (res.status === 404) {
    console.warn(`[session:delete] Lambda has no delete endpoint for session ${sessionId}`);
    return NextResponse.json(
      { error: "Session deletion is not supported by the API. Contact your administrator." },
      { status: 501 },
    );
  }

  if (!res.ok) {
    let data: Record<string, unknown>;
    try { data = raw ? JSON.parse(raw) : { error: `Delete failed (${res.status})` }; }
    catch { data = { error: raw || `Delete failed (${res.status})` }; }
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
