"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  // 1) Reuse existing session if present; otherwise create anonymous session
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  let userId = sessionData.session?.user?.id;

  if (!userId) {
    const { data: authData, error: authError } =
      await supabase.auth.signInAnonymously();
    if (authError) throw authError;

    userId = authData.user?.id;
  }

  if (!userId) throw new Error("Could not create session.");

  // Look up the game by join code
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, code, title, is_locked")
    .eq("code", trimmedCode)
    .single();

  if (gameError || !game) throw new Error("Invalid join code.");
  if (game.is_locked) throw new Error("This game is locked.");

  const { data: existingName, error: nameErr } = await supabase
  .from("players")
  .select("id, user_id")
  .eq("game_id", game.id)
  .ilike("display_name", trimmedName)
  .maybeSingle();

if (nameErr) throw nameErr;

// If someone else already has this name, block it
if (existingName && existingName.user_id !== userId) {
  throw new Error("That name is already taken in this game. Try adding a last initial.");
}
  // 3) Check if the display name is already taken in this game
const { data: existing, error: existingErr } = await supabase
  .from("players")
  .select("id, user_id")
  .eq("game_id", game.id)
  .ilike("display_name", trimmedName)
  .maybeSingle();

if (existingErr) throw existingErr;

if (existing) {
  // Name exists already
  if (existing.user_id !== userId) {
    throw new Error(
      "That name is already taken in this game. Try adding a last initial."
    );
  }
  // Same device re-joining with same name -> allowed (no new row)
} else {
  // Name does not exist -> create new player row
  const { error: insertErr } = await supabase.from("players").insert({
    game_id: game.id,
    user_id: userId,
    display_name: trimmedName,
  });

  if (insertErr) throw insertErr;
}

// 4) Go to game (include name so we know which entry on this device)
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

        <p className="mt-4 text-xs text-gray-500">
          Anyone with the join code can play.
        </p>
      </div>
    </main>
  );
}
