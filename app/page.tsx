import { createClient } from "@/lib/supabase/server";
import { SERVICES } from "@/data/services";
import { ServiceCard } from "@/app/services/ServiceCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const savedIds = user
    ? (
        await supabase
          .from("favorites")
          .select("service_id")
          .eq("user_id", user.id)
      ).data?.map((r) => r.service_id) ?? []
    : [];

  return (
    <main className="max-w-2xl mx-auto p-4 pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Free support services validated by your peers
      </h1>
      <p className="text-gray-700 mb-6">
        {user
          ? "Search through free support services."
          : "Search through free support services. Sign in to save your favorites."}
      </p>
      <ul className="space-y-3">
        {SERVICES.map((service) => (
          <li key={service.id}>
            <ServiceCard
              service={service}
              isSaved={savedIds.includes(service.id)}
              signedIn={!!user}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
