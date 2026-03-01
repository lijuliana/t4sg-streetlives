"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: "ok", text: "Check your email to confirm your account." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage({ type: "ok", text: "Signed in. Redirecting..." });
        window.location.href = "/";
        return;
      }
    } catch (err: unknown) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50/80 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md border border-amber-200/60 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          {isSignUp ? "Create account" : "Sign in"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>
          {message && (
            <p
              className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-black disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setIsSignUp((v) => !v);
            setMessage(null);
          }}
          className="mt-4 w-full py-2 text-sm font-medium text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
        <Link
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-900 underline underline-offset-2 hover:no-underline hover:bg-gray-100 rounded-lg"
        >
          ← Back to services
        </Link>
      </div>
    </div>
  );
}
