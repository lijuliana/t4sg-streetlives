import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const res = await lambdaFetch(`/sessions/${sessionId}/close`, { method: "POST" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
