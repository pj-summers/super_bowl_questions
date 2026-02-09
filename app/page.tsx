"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedCode) return setError("Please enter a join code.");
    if (!trimmedName) return setError("Please enter your name.");

    setLoading(true);

    try {
      // 1) Ensure we have an anonymous session (for RLS + inserts)
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      let userId = sessionData.session?.user?.id;

      if (!userId) {
        const { data: authData, error: authError } =
          await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        userId = authData.user?.id;
      }

      if (!userId) throw new Error("Could not create session.");

      // 2) Look up the game by join code
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, code, title, is_locked")
        .eq("code", trimmedCode)
        .single();

      if (gameError || !game) throw new Error("Invalid join code.");

      // 3) If the name already exists for this game, just use it (any device)
      const { data: existing, error: existingErr } = await supabase
        .from("players")
        .select("id")
        .eq("game_id", game.id)
        .ilike("display_name", trimmedName)
        .maybeSingle();

      if (existingErr) throw existingErr;

      // 4) If not existing, create it
      if (!existing) {
        const { error: insertErr } = await supabase.from("players").insert({
          game_id: game.id,
          user_id: userId, // stored but no longer used for access control
          display_name: trimmedName,
        });

        // If two people race to create same name, unique index might throw.
        // In that case, just proceed to game (name exists now).
        if (insertErr) {
          // If it's a unique violation, proceed; otherwise throw.
          // Postgres unique violation is typically code "23505"
          // Supabase error typing isn't perfect, so we check loosely.
          const msg = String(insertErr.message ?? "");
          if (!msg.toLowerCase().includes("duplicate") && !msg.includes("23505")) {
            throw insertErr;
          }
        }
      }

      // 5) Go to game (name in URL = identity)
      router.push(`/game/${trimmedCode}?name=${encodeURIComponent(trimmedName)}`);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Super Bowl Trivia</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the join code and your name to play.
        </p>

        <form onSubmit={handleJoin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Join Code</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Your Name</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and Last please"
              autoCorrect="off"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
          >
            {loading ? "Joining..." : "Join Game"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>Anyone with the join code can play.</span>
          <Link className="underline" href="/champions">
            Past champions
          </Link>
        </div>
      </div>
    </main>
  );
}
