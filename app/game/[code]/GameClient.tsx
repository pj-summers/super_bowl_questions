"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
  status: "pregame" | "live" | "completed";
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
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"card" | "all">("card");
  const [reviewFilter, setReviewFilter] = useState<"all" | "unanswered">("all");
  const [showCompletion, setShowCompletion] = useState(false);
  const [hasShownCompletion, setHasShownCompletion] = useState(false);
  const [showPregameHome, setShowPregameHome] = useState(false);
  const [initialAnswerCount, setInitialAnswerCount] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
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
          .select("id, code, title, is_locked, status")
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
        setInitialAnswerCount(Object.keys(map).length);
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
  window.localStorage.setItem("sbq:lastCode", code.toUpperCase());

  const currentName = searchParams.get("name");
  if (!currentName) {
    const savedName = window.localStorage.getItem("sbq:lastName");
    if (savedName) {
      router.replace(`/game/${code.toUpperCase()}?name=${encodeURIComponent(savedName)}`);
    }
  } else{
    window.localStorage.setItem("sbq:lastName", currentName);
  }

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
}, [code, router, searchParams]);


  async function saveAnswer(questionId: string, option: string) {
    if (!player || !game) return;
    if (game.is_locked) return;

    setSavingId(questionId);
    setError(null);
    setSavedId(null);

    try {
      setAnswers((prev) => ({ ...prev, [questionId]: option }));

      const { error: upsertError } = await supabase.from("answers").upsert(
        { player_id: player.id, question_id: questionId, option },
        { onConflict: "player_id,question_id" }
      );

      if (upsertError) throw upsertError;
      setSavedId(questionId);

      window.setTimeout(() => {
        setSavedId((current) =>
          current === questionId ? null : current
        );
      }, 1200);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save answer.");
    } finally {
      setSavingId(null);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const currentQuestion = questions[currentQuestionIndex] ?? null;

  const progressPercent =
    totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const unansweredCount = totalCount - answeredCount;

  const reviewQuestions =
    reviewFilter === "unanswered"
      ? questions.filter((question) => !answers[question.id])
      : questions;

  useEffect(() => {
    if (
      initialAnswerCount !== null &&
      totalCount > 0 &&
      initialAnswerCount === totalCount &&
      game?.status === "pregame" &&
      !game.is_locked
    ) {
      setShowPregameHome(true);
      setHasShownCompletion(true);
    }
  }, [initialAnswerCount, totalCount, game]);

  useEffect(() => {
    if (
      totalCount > 0 &&
      answeredCount === totalCount &&
      !hasShownCompletion
    ) {
      setShowCompletion(true);
      setHasShownCompletion(true);
    }
  }, [answeredCount, totalCount, hasShownCompletion]);

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
  <div className="mx-auto max-w-xl py-4 sm:py-8">
    <div className="mb-6">
      <p className="sbq-eyebrow">{game.title}</p>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {player.display_name}&apos;s Picks
          </h1>

          <div className="mt-1 flex items-center gap-3">
            <p className="text-sm text-muted">
              {answeredCount} of {totalCount} answered
            </p>

            {viewMode === "card" && (
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className="text-sm font-semibold text-brand hover:underline"
              >
                View All
              </button>
            )}
          </div>
        </div>

        {game.is_locked && (
          <span className="rounded-full border border-warning/20 bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
            Locked
          </span>
        )}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>

    {game.is_locked && (
      <div className="mb-4 rounded-xl border border-warning/20 bg-warning-soft p-4 text-sm">
        Picks are locked. Your answers can no longer be changed.
      </div>
    )}

  {showPregameHome ? (
  <section className="sbq-card overflow-hidden">
    <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-2xl text-success">
        ✓
      </div>

      <p className="sbq-eyebrow mt-5">Pregame Picks</p>

      <h2 className="mt-2 text-3xl font-bold tracking-tight">
        You&apos;re Ready
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        All {totalCount} of your picks are saved. You can review or change
        them until picks are locked.
      </p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setShowPregameHome(false);
            setViewMode("all");
          }}
          className="sbq-touch-target rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Review My Picks
        </button>

        <a
          href="/champions"
          className="sbq-touch-target inline-flex items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle"
        >
          Hall of Champions
        </a>
      </div>
    </div>
  </section>
) : showCompletion ? (
  <section className="sbq-card overflow-hidden">
    <div className="px-6 py-10 text-center sm:px-10 sm:py-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-2xl text-success">
        ✓
      </div>

      <p className="sbq-eyebrow mt-5">Pregame Picks Complete</p>

      <h2 className="mt-2 text-3xl font-bold tracking-tight">
        You&apos;re All Set
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        All {totalCount} of your picks are saved. You can still review and
        change them until picks are locked.
      </p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setShowCompletion(false);
            setViewMode("all");
          }}
          className="sbq-touch-target rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Review My Picks
        </button>

        <button
          type="button"
          onClick={() => setShowCompletion(false)}
          className="sbq-touch-target rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle"
        >
          Back to Questions
        </button>
      </div>
    </div>
  </section>
) : viewMode === "all" ? (
  <section className="sbq-card overflow-hidden">
    <div className="border-b border-border px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="sbq-eyebrow">Review Picks</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            All Questions
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setViewMode("card")}
          className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
        >
          Back to Question
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setReviewFilter("all")}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            reviewFilter === "all"
              ? "bg-foreground text-background"
              : "border border-border bg-surface text-muted hover:bg-surface-subtle",
          ].join(" ")}
        >
          All ({totalCount})
        </button>

        <button
          type="button"
          onClick={() => setReviewFilter("unanswered")}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            reviewFilter === "unanswered"
              ? "bg-foreground text-background"
              : "border border-border bg-surface text-muted hover:bg-surface-subtle",
          ].join(" ")}
        >
          Unanswered ({unansweredCount})
        </button>
      </div>
    </div>

    <div className="divide-y divide-border">
      {reviewQuestions.map((question) => {
        const questionIndex = questions.findIndex(
          (item) => item.id === question.id
        );

        const selectedAnswer = answers[question.id];

        return (
          <button
            key={question.id}
            type="button"
            onClick={() => {
              setCurrentQuestionIndex(questionIndex);
              setViewMode("card");
            }}
            className="sbq-touch-target flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-subtle sm:px-6"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Question {questionIndex + 1}
              </p>

              <p className="mt-1 font-semibold leading-snug text-foreground">
                {question.prompt}
              </p>

              <p
                className={[
                  "mt-1.5 text-sm",
                  selectedAnswer
                    ? "font-medium text-brand"
                    : "text-muted",
                ].join(" ")}
              >
                {selectedAnswer ?? "Unanswered"}
              </p>
            </div>

            <span className="shrink-0 text-lg text-muted">
              →
            </span>
          </button>
        );
      })}

      {reviewQuestions.length === 0 && (
        <div className="px-5 py-10 text-center sm:px-6">
          <p className="font-semibold">
            No unanswered questions.
          </p>

          <p className="mt-1 text-sm text-muted">
            You&apos;ve answered all {totalCount} questions.
          </p>
        </div>
      )}
    </div>
  </section>
) : currentQuestion ? (
      <section className="sbq-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <p className="sbq-eyebrow">
              Question {currentQuestionIndex + 1} of {totalCount}
            </p>

            <div className="min-h-5 text-right">
              {savingId === currentQuestion.id && (
                <span className="text-xs font-medium text-muted">
                  Saving...
                </span>
              )}

              {savingId !== currentQuestion.id &&
                savedId === currentQuestion.id && (
                  <span className="text-xs font-semibold text-success">
                    Saved ✓
                  </span>
                )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">
            {currentQuestion.prompt}
          </h2>

          <div className="mt-6 space-y-3">
            {currentQuestion.options.map((option) => {
              const selected =
                answers[currentQuestion.id] === option;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={game.is_locked}
                  onClick={() =>
                    saveAnswer(currentQuestion.id, option)
                  }
                  className={[
                    "sbq-touch-target flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base font-medium transition",
                    selected
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle",
                    game.is_locked
                      ? "cursor-default opacity-80"
                      : "cursor-pointer",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border-strong bg-surface",
                    ].join(" ")}
                  >
                    {selected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  <span>{option}</span>
                </button>
              );
            })}
          </div>

          {currentQuestion.options.length === 1 &&
            currentQuestion.options[0] === "TBD" && (
              <p className="mt-4 text-xs text-muted">
                Options for this question are still TBD.
              </p>
            )}
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={() =>
              setCurrentQuestionIndex((current) =>
                Math.max(0, current - 1)
              )
            }
            disabled={currentQuestionIndex === 0}
            className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={() =>
              setCurrentQuestionIndex((current) =>
                Math.min(totalCount - 1, current + 1)
              )
            }
            disabled={currentQuestionIndex >= totalCount - 1}
            className="sbq-touch-target rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </section>
    ) : (
      <div className="sbq-card p-6 text-sm text-muted">
        No questions are available for this game yet.
      </div>
    )}

    <p className="mt-5 text-center text-xs text-muted">
      Your selections save automatically.
    </p>
  </div>
  );
}
