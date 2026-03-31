import Link from "next/link";
import { Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";

const MOCK_POSTS = [
  {
    id: "1",
    content: "Just found out that the drop-in center on 42nd opens at 7am on weekdays now. Great for getting breakfast before job searches.",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    author_email: "marcus.t@example.com",
  },
  {
    id: "2",
    content: "Anyone know if the mobile health clinic is still coming to Tompkins Square on Thursdays? Trying to get my prescriptions sorted.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    author_email: undefined,
  },
  {
    id: "3",
    content: "BRC on 30th St was super helpful — they connected me with a housing specialist same day. If you need case management don't sleep on it.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
    author_email: "jess.m@example.com",
  },
  {
    id: "4",
    content: "Heads up — the food pantry on Amsterdam Ave is giving out extra hygiene kits this week while supplies last.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    author_email: undefined,
  },
  {
    id: "5",
    content: "Finally got into transitional housing after 8 months on the list. For anyone still waiting — keep checking in weekly, that's what made a difference for me.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    author_email: "dani.r@example.com",
  },
];

export default function FeedPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <h2 className="font-medium text-lg text-gray-900">Community Feed</h2>
      </div>

      {/* Posts */}
      <main className="flex-1 px-4 py-5 space-y-3 max-w-lg mx-auto w-full">
        {MOCK_POSTS.map((post, i) => (
          <PostCard key={post.id} post={post} index={i} />
        ))}
      </main>

      {/* FAB */}
      <Link
        href="/post/new"
        className="fixed bottom-6 right-5 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition"
        aria-label="Create new post"
      >
        <Plus size={26} strokeWidth={2.5} className="text-gray-900" />
      </Link>
    </div>
  );
}
