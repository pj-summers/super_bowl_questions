"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";


type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
};

type PlayerRow = {
  id: string;
  display_name: string;
};

type QuestionRow = {
  id: string;
  correct_option: string | null;
};

type AnswerRow = {
  player_id: string;
  question_id: string;
  option: string;
};

export default function LeaderboardClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [numCorrectSet, setNumCorrectSet] = useState(0);

  const searchParams = useSearchParams();
  const displayName = searchParams.get("name");
  const adminKey = searchParams.get("key") ?? "";
  const isAdmin = adminKey.length > 0;


  const [rows, setRows] = useState<
    Array<{
      player_id: string;
      name: string;
      answered: number;
      correct: number;
      correctOutOf: string;
      accuracyPct: number | null;
      pct: number;
    }>
  >([]);
  async function setLocked(nextLocked: boolean) {
  if (!game) return;

  const res = await fetch("/api/admin/lock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: game.code,
      locked: nextLocked,
      key: adminKey,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? "Failed to update lock.");
  }

  // Pull fresh state
  await refresh();
}

  async function refresh() {
    setError(null);

    try {
      // 1) Load game
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, code, title, is_locked")
        .eq("code", joinCode)
        .single();

      if (gErr || !g) throw new Error("Game not found.");
      setGame(g);

      // 2) Load total questions (for progress denominator)
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, correct_option")
        .eq("game_id", g.id);

      if (qErr) throw qErr;
      const qCount = (qs ?? []).length;
      setTotalQuestions(qCount);

      const qList: any[] = qs ?? [];

      const correctSetCount = qList.filter((q) => q.correct_option != null && String(q.correct_option).trim() !== "").length;
      setNumCorrectSet(correctSetCount);


      // 3) Load players
      const { data: ps, error: pErr } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("game_id", g.id)
        .order("created_at", { ascending: true });

      if (pErr) throw pErr;

      const players: PlayerRow[] = ps ?? [];

      // 4) Load all answers (for this game's questions)
      // We can’t filter answers directly by game_id without a join,
      // so we fetch by question_ids (small scale = totally fine).
      const qIds = (qs ?? []).map((q: QuestionRow) => q.id);

      let answers: AnswerRow[] = [];
      if (qIds.length > 0) {
        const { data: as, error: aErr } = await supabase
          .from("answers")
          .select("player_id, question_id, option")
          .in("question_id", qIds);

        if (aErr) throw aErr;
        answers = as ?? [];
      }

      const correctByQ = new Map<string, string>();
      (qs ?? []).forEach((q: any) => {
        if (q.correct_option) correctByQ.set(q.id, q.correct_option);
      });


      // Track answered questions and correct count per player
      const answeredSets = new Map<string, Set<string>>();
      const correctCounts = new Map<string, number>();

      for (const a of answers) {
        if (!answeredSets.has(a.player_id)) answeredSets.set(a.player_id, new Set());
        answeredSets.get(a.player_id)!.add(a.question_id);

        const correct = correctByQ.get(a.question_id);
        if (correct && a.option === correct) {
            correctCounts.set(a.player_id, (correctCounts.get(a.player_id) ?? 0) + 1);
        }
      }
const scoredSoFar = correctSetCount;
const computed = players.map((p) => {
  const answered = answeredSets.get(p.id)?.size ?? 0;
  const correct = correctCounts.get(p.id) ?? 0;
  const completionPct = qCount > 0 ? Math.round((answered / qCount) * 100) : 0;
  const accuracyPct = scoredSoFar > 0 ? Math.round((correct / answered) * 100) : null;

  return { 
    player_id: p.id, 
    name: p.display_name, 
    answered, 
    correct, 
    correctOutOf: `${correct}/${scoredSoFar}`,
    accuracyPct,
    pct: completionPct
  };
});


      // Sort: most answered first, then name
      computed.sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        if (b.answered !== a.answered) return b.answered - a.answered;
        return a.name.localeCompare(b.name);
      });

      setRows(computed);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  // Realtime updates
  useEffect(() => {
    // Any answer/player change triggers refresh.
    // (For your group size, this is totally fine.)
    const channel = supabase
      .channel(`leaderboard-${joinCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p>Loading leaderboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
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

  if (!game) return null;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {game.title} · Code: <span className="font-mono">{game.code}</span>
            {game.is_locked ? " · Locked" : ""}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Total questions: {totalQuestions}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Correct answers entered: {numCorrectSet}/{totalQuestions}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refresh()}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
          <Link
            href={
                displayName
                    ? `/game/${game.code}?name=${encodeURIComponent(displayName)}`
                    : `/`
            }
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
            Back to Game →
        </Link>
        <Link
          href="/champions"
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Past Champions →
        </Link>

        {isAdmin && (
  <button
    onClick={async () => {
      try {
        await setLocked(!game.is_locked);
      } catch (e: any) {
        setError(e?.message ?? "Failed to update lock.");
      }
    }}
    className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
  >
    {game.is_locked ? "Unlock Submissions" : "Lock Submissions"}
  </button>
)}


        </div>
      </div>

      <div className="mt-6 rounded-2xl border overflow-hidden">
  <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
    <div className="col-span-4">Player</div>
    <div className="col-span-2 text-right">Correct</div>
    <div className="col-span-2 text-right">Accuracy</div>
    <div className="col-span-2 text-right">Answered</div>
    <div className="col-span-2 text-right">Complete</div>
  </div>

  {rows.length === 0 ? (
    <div className="px-4 py-6 text-sm text-gray-600">No players yet.</div>
  ) : (
    rows.map((r, idx) => (
      <div
        key={r.player_id}
        className="grid grid-cols-12 px-4 py-3 border-t"
      >
        <div className="col-span-4 flex items-center gap-3">
          <div className="text-xs text-gray-500 w-6">{idx + 1}</div>
          <div className="font-medium">{r.name}</div>
        </div>

        <div className="col-span-2 text-right font-mono">{r.correctOutOf}</div>

        <div className="col-span-2 text-right font-mono">
          {r.accuracyPct == null ? "-" : `${r.accuracyPct}%`}
        </div>
        
        <div className="col-span-2 text-right font-mono">
          {r.answered}/{totalQuestions}
        </div>

        <div className="col-span-2 text-right font-mono">{r.pct}%</div>
      </div>
    ))
  )}
</div></main>)}
