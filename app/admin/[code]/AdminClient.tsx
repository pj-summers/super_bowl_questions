"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  options: string[];
  sort_order: number;
  correct_option: string | null;
};

export default function AdminClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);
  const searchParams = useSearchParams();
  const adminKey = searchParams.get("key") ?? "";
  const isAdmin = adminKey.length > 0;
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(true);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  const totalQuestions = questions.length;
  const correctEntered = questions.filter(
    (q) => q.correct_option != null && String(q.correct_option).trim() !== ""
  ).length;
  const filteredQuestions = showOnlyUnanswered
  ? questions.filter(
      (q) => q.correct_option == null || String(q.correct_option).trim() === ""
    )
  : questions;


  async function refresh() {
    setError(null);
    setLoading(true);

    try {
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, code, title, is_locked")
        .eq("code", joinCode)
        .single();

      if (gErr || !g) throw new Error("Game not found.");
      setGame(g);

      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, prompt, options, sort_order, correct_option")
        .eq("game_id", g.id)
        .order("sort_order", { ascending: true });

      if (qErr) throw qErr;

      setQuestions(
        (qs ?? []).map((row: any) => ({
          id: row.id,
          prompt: row.prompt,
          options: row.options,
          sort_order: row.sort_order,
          correct_option: row.correct_option,
        }))
      );
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
    if (!res.ok) throw new Error(json?.error ?? "Failed to update lock.");
    await refresh();
  }

  async function setCorrect(questionId: string, correctOption: string | null) {
    setSavingId(questionId);
    setError(null);

    try {
      // Optimistic update
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, correct_option: correctOption } : q
        )
      );

      const res = await fetch("/api/admin/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          correctOption,
          key: adminKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to set correct answer.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
      // reload from source of truth if something went wrong
      await refresh();
    } finally {
      setSavingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="mt-4 rounded-xl border bg-yellow-50 p-3 text-sm">
          Missing <span className="font-mono">?key=</span>. This page is private.
        </div>
        <p className="mt-4">
          <Link className="underline" href="/">
            Back to Join
          </Link>
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <p>Loading admin…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
        <p className="mt-4">
          <button
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            onClick={() => refresh()}
          >
            Refresh
          </button>
        </p>
      </main>
    );
  }

  if (!game) return null;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-gray-600">
            {game.title} · Code: <span className="font-mono">{game.code}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Correct answers entered: {correctEntered}/{totalQuestions}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Submissions: {game.is_locked ? "LOCKED" : "OPEN"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refresh()}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>

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

          <Link
            href={`/leaderboard/${game.code}?key=${encodeURIComponent(adminKey)}`}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Leaderboard →
          </Link>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={showOnlyUnanswered}
      onChange={(e) => setShowOnlyUnanswered(e.target.checked)}
    />
    Show only unanswered
  </label>

  <div className="text-sm text-gray-600">
    Showing {filteredQuestions.length} of {questions.length}
  </div>
</div>

      <div className="mt-6 space-y-4">
        {filteredQuestions.map((q, idx) => (
          <div key={q.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500">Q{q.sort_order + 1}</p>
                <p className="mt-1 font-medium">{q.prompt}</p>
              </div>
              {savingId === q.id && (
                <span className="text-xs text-gray-500">Saving…</span>
              )}
            </div>

            <div className="mt-3">
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={q.correct_option ?? ""}
                onChange={(e) =>
                  setCorrect(q.id, e.target.value === "" ? null : e.target.value)
                }
              >
                <option value="">(No correct answer yet)</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Set the correct answer when it becomes known. Leaderboard updates live.
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
