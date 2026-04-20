import { NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function GET() {
  const res = await lambdaFetch("/sessions");
  const data = await res.json();
  if (!res.ok) console.error("[api/sessions] Lambda error:", data);
  return NextResponse.json(data, { status: res.status });
}
