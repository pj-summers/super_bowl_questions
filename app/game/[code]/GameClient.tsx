"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";

type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
};

type QuestionRow = {
  id: string;
  prompt: string;
  options: string[];
  sort_order: number;
};

type PlayerRow = {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
};

type AnswerRow = {
  question_id: string;
  option: string;
};

export default function GameClient({ code }: { code: string }) {
  const joinCode = code;

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const displayName = (searchParams.get("name") ?? "").trim();


  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      try {
        // Must have a session from join page
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          throw new Error("You are not signed in. Go back and join again.");
        }

        // Fetch game
        const { data: g, error: gameError } = await supabase
          .from("games")
          .select("id, code, title, is_locked")
          .eq("code", joinCode)
          .single();

        if (gameError || !g) throw new Error("Game not found.");
        setGame(g);

        if (!displayName) {
  throw new Error("Missing player name. Go back and join again.");
}

const { data: p, error: playerError } = await supabase
  .from("players")
  .select("id, game_id, user_id, display_name")
  .eq("game_id", g.id)
  .ilike("display_name", displayName)
  .single();

if (playerError || !p) {
  throw new Error("Player not found. Go back and re-join.");
}

// Optional extra safety: if you want to ensure the same device owns it
if (p.user_id !== userId) {
  throw new Error("That name belongs to a different device/session. Re-join with a different name.");
}

setPlayer(p);


        // Fetch questions in order
        const { data: qs, error: qError } = await supabase
          .from("questions")
          .select("id, prompt, options, sort_order")
          .eq("game_id", g.id)
          .order("sort_order", { ascending: true });

        if (qError) throw qError;

        setQuestions(
          (qs ?? []).map((row: any) => ({
            id: row.id,
            prompt: row.prompt,
            options: row.options,
            sort_order: row.sort_order,
          }))
        );

        // Fetch existing answers for this player
        const { data: as, error: aError } = await supabase
          .from("answers")
          .select("question_id, option")
          .eq("player_id", p.id);

        if (aError) throw aError;

        const map: Record<string, string> = {};
        (as ?? []).forEach((r: AnswerRow) => {
          map[r.question_id] = r.option;
        });
        setAnswers(map);
      } catch (err: any) {
        setError(err?.message ?? "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [joinCode]);

  useEffect(() => {
  if (!joinCode) return;

  const channel = supabase
    .channel(`game-lock-${joinCode}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games" },
      () => {
        // easiest: reload game state
        window.location.reload();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [joinCode]);


  async function saveAnswer(questionId: string, option: string) {
    if (!player || !game) return;
    if (game.is_locked) return;

    setSavingId(questionId);
    setError(null);

    try {
      setAnswers((prev) => ({ ...prev, [questionId]: option }));

      const { error: upsertError } = await supabase.from("answers").upsert(
        { player_id: player.id, question_id: questionId, option },
        { onConflict: "player_id,question_id" }
      );

      if (upsertError) throw upsertError;
    } catch (err: any) {
      setError(err?.message ?? "Failed to save answer.");
    } finally {
      setSavingId(null);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p>Loading game…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Game</h1>
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
        <p className="mt-4">
          <Link className="underline" href="/">
            Back to Join
          </Link>
        </p>
      </main>
    );
  }

  if (!game || !player) return null;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{game.title}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Code: <span className="font-mono">{game.code}</span> · Player:{" "}
            <span className="font-medium">{player.display_name}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Progress: {answeredCount}/{totalCount}
            {game.is_locked ? " · Submissions locked" : ""}
          </p>
        </div>

        <Link
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          href={`/leaderboard/${game.code}?name=${encodeURIComponent(player.display_name)}`}
        >
          View Live Leaderboard →
        </Link>
      </div>

      {game.is_locked && (
        <div className="mt-4 rounded-xl border bg-yellow-50 p-3 text-sm">
          This game is locked. Answers can’t be changed.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Q{idx + 1}</p>
                <p className="mt-1 font-medium">{q.prompt}</p>
              </div>

              {savingId === q.id && (
                <span className="text-xs text-gray-500">Saving…</span>
              )}
            </div>

            <div className="mt-3">
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={answers[q.id] ?? ""}
                onChange={(e) => saveAnswer(q.id, e.target.value)}
                disabled={game.is_locked}
              >
                <option value="" disabled>
                  Select an answer…
                </option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {q.options.length === 1 && q.options[0] === "TBD" && (
                <p className="mt-2 text-xs text-gray-500">
                  Options are still <span className="font-mono">TBD</span>. Update in Supabase →
                  questions → options.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Answers save automatically when you choose an option.
      </p>
    </main>
  );
}
