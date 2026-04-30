import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allRes = await lambdaFetch("/navigators");
  if (!allRes.ok) return NextResponse.json({ error: "Failed to fetch navigators" }, { status: allRes.status });

  const all = await allRes.json().catch(() => []);
  const list = Array.isArray(all) ? all : (all.navigators ?? []);
  const me = list.find((n: { auth0_user_id?: string }) => n.auth0_user_id === session.user.sub) ?? null;

  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(me);
}

// Upsert the current navigator's profile.
// Finds the row by auth0_user_id from the session, PATCHes if found, POSTs if not.
export async function PUT(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const allRes = await lambdaFetch("/navigators");
  if (allRes.ok) {
    const all = await allRes.json().catch(() => []) as Array<{ id: string; auth0_user_id?: string }>;
    if (Array.isArray(all)) {
      const existing = all.find((n) => n.auth0_user_id === session.user.sub);
      if (existing?.id) {
        const patchRes = await lambdaFetch(`/navigators/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        const patchBody = await patchRes.json().catch(() => null);
        return NextResponse.json(patchBody, { status: patchRes.status });
      }
    }
  }

  // No existing row — create a new profile.
  const createRes = await lambdaFetch("/navigators", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const createBody = await createRes.json().catch(() => null);
  return NextResponse.json(createBody, { status: createRes.status });
}
