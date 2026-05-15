import { NextResponse } from "next/server";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";

  const res = await fetch(`${LAMBDA}/sessions/${sessionId}/messages?token=${token}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[session:messages:get] ← error ${res.status} sessionId=${sessionId}`);
  }

  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${LAMBDA}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[session:messages:post] ← error ${res.status} sessionId=${sessionId}`);
  }

  return NextResponse.json(data, { status: res.status });
}
