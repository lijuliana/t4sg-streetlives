import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="bg-amber-100/80 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold text-gray-900 hover:text-gray-700">
        Streetmark
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-gray-800 hover:text-gray-900 font-medium"
        >
          Services
        </Link>
        {user ? (
          <>
            <Link
              href="/saved"
              className="text-sm text-gray-800 hover:text-gray-900"
            >
              Favorites
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/auth"
            className="text-sm font-medium text-gray-900 hover:text-gray-700"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
