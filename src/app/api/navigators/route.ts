import { NextRequest, NextResponse } from "next/server";
import { lambdaFetch } from "@/lib/lambda";

export async function GET() {
  const res = await lambdaFetch("/navigators");
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await lambdaFetch("/navigators", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
