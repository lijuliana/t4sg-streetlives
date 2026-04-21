import { NextRequest, NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = await req.json();
  const res = await lambdaFetch(`/sessions/${sessionId}/navigator-messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
