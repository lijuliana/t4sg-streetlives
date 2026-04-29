import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const res = await lambdaFetch(`/sessions/${sessionId}/events`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await lambdaFetch(`/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
