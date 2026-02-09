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
  correct_option: string | null;
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

function baseAbbrevName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const lastInitial = last[0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}`;
}

function normalizeKey(s: string) {
  return s.trim().toLowerCase();
}

export default function AnswersClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answerMap, setAnswerMap] = useState<Map<string, string>>(new Map());

  // View toggle
  const [view, setView] = useState<"players" | "questions">("players");

  // Score metadata
  const [scoredSoFar, setScoredSoFar] = useState(0);
  const [playerScore, setPlayerScore] = useState<
    Map<string, { correct: number; answered: number }>
  >(new Map());

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
        setPlayerScore(new Map());
        setScoredSoFar(0);
        return;
      }

      // 2) Questions (include correct_option for coloring)
      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, prompt, sort_order, correct_option")
        .eq("game_id", g.id)
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (qErr) throw qErr;
      const qList = (qs ?? []) as QuestionRow[];

      // Fallback if sort_order nulls cause weirdness
      qList.sort((a, b) => {
        const ao = a.sort_order ?? 1e9;
        const bo = b.sort_order ?? 1e9;
        return ao - bo;
      });

      setQuestions(qList);

      const qIds = qList.map((q) => q.id);

      // Count scored so far (correct answers entered)
      const correctByQ = new Map<string, string>();
      let correctCount = 0;
      for (const q of qList) {
        const v = q.correct_option == null ? "" : String(q.correct_option).trim();
        if (v !== "") {
          correctByQ.set(q.id, v);
          correctCount += 1;
        }
      }
      setScoredSoFar(correctCount);

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
        m.set(`${a.player_id}:${a.question_id}`, a.option ?? "");
      }
      setAnswerMap(m);

      // 5) Compute per-player answered + correct (relative to scoredSoFar)
      const answeredSets = new Map<string, Set<string>>();
      const correctCounts = new Map<string, number>();

      for (const a of answers) {
        if (!answeredSets.has(a.player_id)) answeredSets.set(a.player_id, new Set());
        answeredSets.get(a.player_id)!.add(a.question_id);

        const correctOpt = correctByQ.get(a.question_id);
        if (correctOpt && (a.option ?? "") === correctOpt) {
          correctCounts.set(a.player_id, (correctCounts.get(a.player_id) ?? 0) + 1);
        }
      }

      const scoreMap = new Map<string, { correct: number; answered: number }>();
      for (const p of pList) {
        scoreMap.set(p.id, {
          correct: correctCounts.get(p.id) ?? 0,
          answered: answeredSets.get(p.id)?.size ?? 0,
        });
      }
      setPlayerScore(scoreMap);
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

  // Build unique abbreviated names for column headers (disambiguate collisions)
  const playerLabels = useMemo(() => {
    const baseCounts = new Map<string, number>();
    for (const p of players) {
      const base = baseAbbrevName(p.display_name);
      baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
    }

    const used = new Map<string, number>();
    const labels = new Map<string, string>();

    for (const p of players) {
      const base = baseAbbrevName(p.display_name);
      if ((baseCounts.get(base) ?? 0) <= 1) {
        labels.set(p.id, base);
        continue;
      }

      // collision: add a counter suffix
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      labels.set(p.id, `${base} (${n})`);
    }

    return labels;
  }, [players]);

  // Players sorted by score for the flipped view
  const playersByScore = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      const sa = playerScore.get(a.id) ?? { correct: 0, answered: 0 };
      const sb = playerScore.get(b.id) ?? { correct: 0, answered: 0 };
      if (sb.correct !== sa.correct) return sb.correct - sa.correct;
      if (sb.answered !== sa.answered) return sb.answered - sa.answered;
      return normalizeKey(a.display_name).localeCompare(normalizeKey(b.display_name));
    });
    return arr;
  }, [players, playerScore]);

  function getCellValue(playerId: string, questionId: string) {
    return answerMap.get(`${playerId}:${questionId}`) ?? "";
  }

  function getCellClass(questionId: string, value: string) {
    const q = questions.find((qq) => qq.id === questionId);
    const correctOpt = q?.correct_option == null ? "" : String(q.correct_option).trim();

    const v = (value ?? "").trim();

    // no correct entered yet
    if (!correctOpt) return "bg-white";

    // unanswered
    if (!v) return "bg-white";

    // correct / incorrect
    if (v === correctOpt) return "bg-green-50";
    return "bg-red-50";
  }

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
          <Link className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" href="/">
            Join →
          </Link>
        </div>
      </main>
    );
  }

  const totalQuestions = questions.length;

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Everyone’s Answers</h1>
          <p className="mt-1 text-sm text-gray-600">
            {game.title} · Code: <span className="font-mono">{game.code}</span> · Locked
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Scored so far: {scoredSoFar}/{totalQuestions} · Green = correct, red = incorrect
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tip: swipe left/right on mobile.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setView((v) => (v === "players" ? "questions" : "players"))}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            View: {view === "players" ? "Players × Questions" : "Questions × Players"}
          </button>

          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href={`/leaderboard/${game.code}`}
          >
            Leaderboard →
          </Link>

          <Link className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" href="/champions">
            Past Champions →
          </Link>
        </div>
      </div>

      {/* TABLE */}
      <div className="mt-6 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          {view === "players" ? (
            // Players = rows, Questions = columns (original)
            <table className="w-full border-collapse text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-600">
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r px-3 py-2 text-left">
                    Player
                  </th>
                  {questions.map((q, idx) => (
                    <th
                      key={q.id}
                      className="border-b px-3 py-2 text-left whitespace-nowrap cursor-help"
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
                      const val = getCellValue(p.id, q.id);
                      const cls = getCellClass(q.id, val);
                      return (
                        <td key={q.id} className={`px-3 py-2 align-top ${cls}`}>
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
          ) : (
            // Questions = rows, Players = columns (flipped + ordered by score)
            <table className="w-full border-collapse text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-600">
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r px-3 py-2 text-left whitespace-nowrap">
                    Question
                  </th>

                  {playersByScore.map((p) => {
                    const label = playerLabels.get(p.id) ?? p.display_name;
                    const s = playerScore.get(p.id) ?? { correct: 0, answered: 0 };
                    return (
                      <th
                        key={p.id}
                        className="border-b px-3 py-2 text-left whitespace-nowrap cursor-help"
                        title={`${p.display_name} — Score ${s.correct}/${scoredSoFar || 0}`}
                      >
                        <div className="font-semibold">{label}</div>
                        <div className="mt-0.5 text-[10px] text-gray-500 font-normal">
                          {scoredSoFar > 0 ? `${s.correct}/${scoredSoFar}` : "0/0"}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {questions.map((q, idx) => (
                  <tr key={q.id} className="border-t">
                    <td
                      className="sticky left-0 z-10 bg-white border-r px-3 py-2 align-top"
                      title={q.prompt}
                    >
                      <div className="font-medium whitespace-nowrap">Q{idx + 1}</div>
                      <div className="mt-0.5 text-xs text-gray-600 leading-snug max-w-[340px]">
                        {q.prompt}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        {q.correct_option && String(q.correct_option).trim() !== ""
                          ? `Correct: ${q.correct_option}`
                          : "Correct: —"}
                      </div>
                    </td>

                    {playersByScore.map((p) => {
                      const val = getCellValue(p.id, q.id);
                      const cls = getCellClass(q.id, val);
                      return (
                        <td key={p.id} className={`px-3 py-2 align-top ${cls}`}>
                          <div className="leading-snug">
                            {val ? val : <span className="text-gray-400">—</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {questions.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-gray-600" colSpan={1 + playersByScore.length}>
                      No questions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
