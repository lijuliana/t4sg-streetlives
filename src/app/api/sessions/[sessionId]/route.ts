import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const res = await lambdaFetch(`/sessions/${sessionId}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
