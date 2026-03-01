import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SERVICES } from "@/data/services";
import { removeFavorite } from "@/app/actions/favorites";
import { RemoveButton } from "./RemoveButton";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: rows } = await supabase
    .from("favorites")
    .select("service_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const savedIds = rows?.map((r) => r.service_id) ?? [];
  const savedServices = SERVICES.filter((s) => savedIds.includes(s.id));

  return (
    <div className="min-h-screen bg-amber-50/70">
      <main className="max-w-2xl mx-auto p-4 pb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Favorite services
        </h1>
        {savedServices.length === 0 ? (
          <p className="text-gray-700">
            You haven&apos;t saved any services yet.{" "}
            <Link href="/" className="text-gray-900 font-medium underline hover:no-underline">
              Services
            </Link>{" "}
            and click Save to add them here.
          </p>
        ) : (
          <ul className="space-y-3">
            {savedServices.map((service) => (
              <li key={service.id}>
                <div className="bg-white border border-amber-200/80 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {service.category}
                    </span>
                    <h2 className="font-semibold text-gray-900 mt-0.5">
                      {service.name}
                    </h2>
                    <p className="text-sm text-gray-700 mt-1">
                      {service.description}
                    </p>
                  </div>
                  <RemoveButton serviceId={service.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
