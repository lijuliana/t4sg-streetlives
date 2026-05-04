import { NextResponse } from "next/server";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";

  const res = await fetch(`${LAMBDA}/sessions/${sessionId}?token=${token}`);
  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`[session:get] ← error ${res.status} sessionId=${sessionId}`);
    return NextResponse.json(raw, { status: res.status });
  }

  // Lambda GET returns snake_case; normalise to camelCase so the frontend gets
  // the same shape from both POST (create) and GET (poll).
  const data = {
    sessionId:          raw.id ?? raw.sessionId,
    sessionUserToken:   raw.session_user_token ?? raw.sessionUserToken,
    status:             raw.status,
    needCategory:       raw.need_category ?? raw.needCategory,
    assignedNavigatorId: raw.navigator_id ?? raw.assignedNavigatorId ?? null,
    routingFailReason:  raw.routing_fail_reason ?? raw.routingFailReason ?? null,
  };

  console.log(
    `[session:get] ← sessionId=${data.sessionId}`,
    `status=${data.status}`,
    `assignedNav=${data.assignedNavigatorId ?? "none"}`,
    data.routingFailReason ? `fail="${data.routingFailReason}"` : "",
  );

  return NextResponse.json(data, { status: res.status });
}
