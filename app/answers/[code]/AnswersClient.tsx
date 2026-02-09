"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
};

type QuestionRow = {
  id: string;
  prompt: string;
  sort_order: number | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
  created_at?: string;
};

type AnswerRow = {
  player_id: string;
  question_id: string;
  option: string | null;
};

async function fetchAllAnswers(qIds: string[]): Promise<AnswerRow[]> {
  if (qIds.length === 0) return [];

  const PAGE_SIZE = 1000;
  let all: AnswerRow[] = [];
  let from = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from("answers")
      .select("player_id, question_id, option")
      .in("question_id", qIds)
      .order("player_id", { ascending: true })
      .order("question_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (page ?? []) as AnswerRow[];
    all = all.concat(rows);

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export default function AnswersClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  // answerMap.get(`${playerId}:${questionId}`) => option
  const [answerMap, setAnswerMap] = useState<Map<string, string>>(new Map());

  async function refresh() {
    setError(null);
    setLoading(true);

    try {
      // 1) Game
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, code, title, is_locked")
        .eq("code", joinCode)
        .single();

      if (gErr || !g) throw new Error("Game not found.");
      setGame(g);

      // Gate: only show after lock
      if (!g.is_locked) {
        setPlayers([]);
        setQuestions([]);
        setAnswerMap(new Map());
        return;
      }

      // 2) Questions (prefer sort_order if you have it)
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, prompt, sort_order")
        .eq("game_id", g.id)
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (qErr) throw qErr;
      const qList = (qs ?? []) as QuestionRow[];
      setQuestions(qList);

      const qIds = qList.map((q) => q.id);

      // 3) Players
      const { data: ps, error: pErr } = await supabase
        .from("players")
        .select("id, display_name, created_at")
        .eq("game_id", g.id)
        .order("created_at", { ascending: true });

      if (pErr) throw pErr;
      const pList = (ps ?? []) as PlayerRow[];
      setPlayers(pList);

      // 4) Answers (paged)
      const answers = await fetchAllAnswers(qIds);

      const m = new Map<string, string>();
      for (const a of answers) {
        const key = `${a.player_id}:${a.question_id}`;
        m.set(key, a.option ?? "");
      }
      setAnswerMap(m);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p>Loading answers…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Everyone’s Answers</h1>
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

  if (!game.is_locked) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Everyone’s Answers</h1>
        <p className="mt-2 text-sm text-gray-600">
          This page becomes available after submissions are locked.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/leaderboard/${game.code}`}
          >
            Leaderboard →
          </Link>
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href="/"
          >
            Join →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Everyone’s Answers</h1>
          <p className="mt-1 text-sm text-gray-600">
            {game.title} · Code: <span className="font-mono">{game.code}</span> · Locked
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tip: swipe left/right on mobile to see all questions.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/leaderboard/${game.code}`}
          >
            Leaderboard →
          </Link>
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href="/champions"
          >
            Past Champions →
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-600">
                <th className="sticky left-0 z-20 bg-gray-50 border-b border-r px-3 py-2 text-left">
                  Player
                </th>
                {questions.map((q, idx) => (
                  <th
                    key={q.id}
                    className="border-b px-3 py-2 text-left whitespace-nowrap"
                    title={q.prompt}
                  >
                    Q{idx + 1}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-white border-r px-3 py-2 font-medium whitespace-nowrap">
                    {p.display_name}
                  </td>

                  {questions.map((q) => {
                    const val = answerMap.get(`${p.id}:${q.id}`) ?? "";
                    return (
                      <td key={q.id} className="px-3 py-2 align-top">
                        <div className="leading-snug">
                          {val ? val : <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {players.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={1 + questions.length}>
                    No players found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
