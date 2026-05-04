import { NextResponse } from "next/server";

const LAMBDA = process.env.NEXT_PUBLIC_API_URL!;
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN!;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID!;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET!;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE!;

async function getM2MToken(): Promise<string> {
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });
  if (!res.ok) throw new Error("M2M token failed");
  const data = await res.json();
  return data.access_token as string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const token = await getM2MToken();
    const res = await fetch(`${LAMBDA}/navigators`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await res.json();
    const list: Array<{ id: string; first_name?: string | null; last_name?: string | null; nav_group?: string | null }> =
      Array.isArray(body) ? body : (body.navigators ?? []);
    const nav = list.find((n) => n.id === id);
    if (!nav) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const name =
      [nav.first_name, nav.last_name].filter(Boolean).join(" ") ||
      (nav.nav_group ?? "").replace(/_/g, " ") ||
      null;
    return NextResponse.json({ id, name });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
