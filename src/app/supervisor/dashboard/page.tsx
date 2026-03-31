import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";

export default async function SupervisorDashboardPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-yellow px-5 py-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-gray-900">Supervisor Dashboard</h1>
        <a
          href="/auth/logout"
          className="text-sm font-normal text-gray-700 hover:underline"
        >
          Log out
        </a>
      </header>

      <main className="px-5 py-6 space-y-6 max-w-2xl">
        <p className="text-sm text-gray-500">
          Logged in as{" "}
          <span className="font-normal text-gray-800">{session.user.email}</span>
        </p>

        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-3">Summary</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 text-center">
            No session data to display
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-3">All Sessions</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 text-center">
            No sessions
          </div>
        </section>
      </main>
    </div>
  );
}
