import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";
import { clearTransferRequested } from "@/lib/transferRequestStore";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await lambdaFetch(`/sessions/${sessionId}/transfer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) clearTransferRequested(sessionId);
  return NextResponse.json(data, { status: res.status });
}
