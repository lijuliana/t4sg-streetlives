import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";
import { markTransferRequested, getSessionNeedCategory } from "@/lib/transferRequestStore";


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
  const res = await lambdaFetch(`/sessions/${sessionId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
