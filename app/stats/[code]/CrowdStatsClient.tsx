"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import StatCard from "@/components/StatCard";

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
  correct_option: string | null;
  options: any | null; // jsonb array usually; we’ll handle unknown shape safely
};

type PlayerRow = {
  id: string;
  display_name: string;
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

function safeOptionList(q: QuestionRow, answersForQ: AnswerRow[]) {
  // Prefer question.options if it exists and is array-like
  if (Array.isArray(q.options)) {
    return q.options.map((x) => String(x));
  }

  // Otherwise infer from answers + correct option
  const set = new Set<string>();
  for (const a of answersForQ) {
    const v = (a.option ?? "").trim();
    if (v) set.add(v);
  }
  const c = (q.correct_option ?? "").trim();
  if (c) set.add(c);

  return Array.from(set);
}

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

export default function CrowdStatsClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);

  async function refresh() {
    setError(null);
    setLoading(true);

    try {
      // Game
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, code, title, is_locked")
        .eq("code", joinCode)
        .single();

      if (gErr || !g) throw new Error("Game not found.");
      setGame(g);

      // Only after lock (recommended)
      if (!g.is_locked) {
        setPlayers([]);
        setQuestions([]);
        setAnswers([]);
        return;
      }

      // Players
      const { data: ps, error: pErr } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("game_id", g.id);

      if (pErr) throw pErr;
      setPlayers((ps ?? []) as PlayerRow[]);

      // Questions (include options)
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, prompt, sort_order, correct_option, options")
        .eq("game_id", g.id)
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (qErr) throw qErr;

      const qList = (qs ?? []) as QuestionRow[];
      qList.sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
      setQuestions(qList);

      // Answers (paged)
      const qIds = qList.map((q) => q.id);
      const allAnswers = await fetchAllAnswers(qIds);
      setAnswers(allAnswers);
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
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading crowd stats…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Crowd Stats</h1>
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
      <main className="min-h-screen max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Crowd Stats</h1>
        <p className="mt-2 text-sm text-gray-600">
          Crowd stats become available after submissions are locked.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/leaderboard/${game.code}`}
          >
            Leaderboard →
          </Link>
          <Link className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" href="/">
            Join →
          </Link>
        </div>
      </main>
    );
  }

  const playerCount = players.length;
  const questionCount = questions.length;

  const maxPossibleAnswers = playerCount * questionCount;
  const totalAnswersSubmitted = answers.filter((a) => (a.option ?? "").trim() !== "").length;

  const overallResponse = maxPossibleAnswers > 0 ? pct(totalAnswersSubmitted, maxPossibleAnswers) : 0;

  const scoredSoFar = questions.filter(
    (q) => (q.correct_option ?? "").trim() !== ""
  ).length;

  // Group answers by question
  const answersByQ = new Map<string, AnswerRow[]>();
  for (const a of answers) {
    if (!answersByQ.has(a.question_id)) answersByQ.set(a.question_id, []);
    answersByQ.get(a.question_id)!.push(a);
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Crowd Stats</h1>
          <p className="mt-1 text-sm text-gray-600">
            {game.title} · Code: <span className="font-mono">{game.code}</span> · Locked
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Shows how the group answered each question.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/leaderboard/${game.code}`}
          >
            Leaderboard →
          </Link>
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/answers/${game.code}`}
          >
            Everyone’s Answers →
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Players" value={playerCount} />
        <StatCard label="Questions" value={questionCount} />
        <StatCard label="Scored" value={`${scoredSoFar}/${questionCount}`} />
        <StatCard label="Answers Submitted" value={totalAnswersSubmitted} sub={`of ${maxPossibleAnswers}`} />
        <StatCard label="Overall Response" value={`${overallResponse}%`} />
      </div>

      {/* Question cards */}
      <div className="mt-6 space-y-4">
        {questions.map((q, idx) => {
          const list = answersByQ.get(q.id) ?? [];
          const answeredCount = list.filter((a) => (a.option ?? "").trim() !== "").length;

          const correctOpt = (q.correct_option ?? "").trim();
          const opts = safeOptionList(q, list);

          // count by option
          const counts = new Map<string, number>();
          for (const a of list) {
            const v = (a.option ?? "").trim();
            if (!v) continue;
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }

          // Build rows ordered by count desc
          const rows = opts
            .map((opt) => ({
              opt,
              n: counts.get(opt) ?? 0,
              p: playerCount > 0 ? pct(counts.get(opt) ?? 0, playerCount) : 0,
            }))
            .sort((a, b) => b.n - a.n || a.opt.localeCompare(b.opt));

          const top = rows[0];
          const gotRight =
            correctOpt && counts.has(correctOpt) ? (counts.get(correctOpt) ?? 0) : 0;

          return (
            <div key={q.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500">Q{idx + 1}</div>
                  <div className="mt-1 font-semibold leading-snug">{q.prompt}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Answered: {answeredCount}/{playerCount} · Response:{" "}
                    {playerCount > 0 ? `${pct(answeredCount, playerCount)}%` : "—"}
                    {correctOpt ? ` · Got right: ${gotRight}/${playerCount} (${pct(gotRight, playerCount)}%)` : ""}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">Most common</div>
                  <div className="mt-1 font-medium">
                    {top && top.n > 0 ? `${top.opt}` : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {top && top.n > 0 ? `${top.n} (${top.p}%)` : ""}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-600">No answers yet.</div>
                ) : (
                  rows.map((r) => {
                    const isCorrect = correctOpt && r.opt === correctOpt;
                    return (
                      <div key={r.opt} className="grid grid-cols-12 items-center gap-3">
                        <div className="col-span-5 text-sm leading-snug">
                          <span className={isCorrect ? "font-semibold text-green-700" : ""}>
                            {r.opt}
                          </span>
                          {isCorrect ? (
                            <span className="ml-2 text-[11px] rounded-full border px-2 py-0.5">
                              Correct
                            </span>
                          ) : null}
                        </div>

                        <div className="col-span-5">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-2 bg-brand"
                              style={{ width: `${r.p}%` }}
                            />
                          </div>
                        </div>

                        <div className="col-span-2 text-right font-mono text-sm">
                          {r.n} ({r.p}%)
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Tip: This page is best after lock. If you ever want it available mid-game, we can gate it behind an admin key.
      </p>
    </main>
  );
}
