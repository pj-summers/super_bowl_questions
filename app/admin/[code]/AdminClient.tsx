"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useLivePolling } from "@/lib/useLivePolling";
import QRCode from "qrcode";

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
  correct_option: string | null;
  resolved_at: string | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
};

type AnswerRow = {
  player_id: string;
  question_id: string;
  option: string;
};

type ReadinessRow = {
  playerId: string;
  name: string;
  answered: number;
  complete: boolean;
};

async function fetchAllAnswers(questionIds: string[]): Promise<AnswerRow[]> {
  if (questionIds.length === 0) return [];

  const PAGE_SIZE = 1000;
  let all: AnswerRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("answers")
      .select("player_id, question_id, option")
      .in("question_id", questionIds)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data ?? []) as AnswerRow[];
    all = all.concat(rows);

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return all;
}

export default function AdminClient({ code }: { code: string }) {
  const joinCode = useMemo(() => code.toUpperCase(), [code]);
  const searchParams = useSearchParams();
  const adminKey = searchParams.get("key") ?? "";
  const isAdmin = adminKey.length > 0;
  const [questionFilter, setQuestionFilter] = useState<
  "unresolved" | "resolved" | "all"
>("unresolved");

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [game, setGame] = useState<GameRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [readinessRows, setReadinessRows] = useState<ReadinessRow[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);
  const [playerFilter, setPlayerFilter] = useState<
    "all" | "complete" | "incomplete"
  >("all");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [playerActionId, setPlayerActionId] = useState<string | null>(null);
  const [removePlayer, setRemovePlayer] = useState<ReadinessRow | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [lifecycleWorking, setLifecycleWorking] = useState(false);
  const [pendingResolution, setPendingResolution] = useState<{
  questionId: string;
  prompt: string;
  option: string;
  isEdit: boolean;
} | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);

  const totalQuestions = questions.length;
  const resolvedQuestions = questions.filter(
  (q) => q.correct_option != null && String(q.correct_option).trim() !== ""
);

const unresolvedQuestions = questions.filter(
  (q) => q.correct_option == null || String(q.correct_option).trim() === ""
);

const resolvedCount = resolvedQuestions.length;

const filteredQuestions =
  questionFilter === "resolved"
    ? resolvedQuestions
    : questionFilter === "unresolved"
      ? unresolvedQuestions
      : questions;
  const totalPlayers = readinessRows.length;

const completePlayers = readinessRows.filter(
  (player) => player.complete
).length;

const incompletePlayers = totalPlayers - completePlayers;

const totalPicksMade = readinessRows.reduce(
  (sum, player) => sum + player.answered,
  0
);

const totalPossiblePicks = totalPlayers * totalQuestions;

const filteredPlayers = readinessRows.filter((player) => {
  if (playerFilter === "complete") return player.complete;
  if (playerFilter === "incomplete") return !player.complete;
  return true;
});

function getInviteLink() {
  if (typeof window === "undefined") return "";

  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

async function copyInviteLink() {
  const inviteLink = getInviteLink();

  if (!inviteLink) return;

  try {
    await navigator.clipboard.writeText(inviteLink);

    setInviteCopied(true);

    window.setTimeout(() => {
      setInviteCopied(false);
    }, 1500);
  } catch {
    setError("Could not copy the invite link.");
  }
}

async function lockPicks() {
  if (!game) return;

  setLifecycleWorking(true);
  setError(null);

  try {
    const { data: updatedGames, error: updateError } = await supabase
      .from("games")
      .update({
        status: "live",
        is_locked: true,
      })
      .eq("id", game.id)
      .eq("status", "pregame")
      .eq("is_locked", false)
      .select("id");

    if (updateError) throw updateError;

    if (!updatedGames || updatedGames.length === 0) {
      throw new Error(
        "The game could not be locked. Refresh and try again."
      );
    }

    setShowLockConfirm(false);

    // Reload so AppNav and every state-aware surface immediately
    // pick up the Pregame → Live transition.
    window.location.reload();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not lock picks."
    );
  } finally {
    setLifecycleWorking(false);
  }
}

async function unlockPicks() {
  if (!game) return;

  setLifecycleWorking(true);
  setError(null);

  try {
    const { data: updatedGames, error: updateError } = await supabase
      .from("games")
      .update({
        status: "pregame",
        is_locked: false,
      })
      .eq("id", game.id)
      .eq("status", "live")
      .eq("is_locked", true)
      .select("id");

    if (updateError) throw updateError;

    if (!updatedGames || updatedGames.length === 0) {
      throw new Error(
        "The game could not be unlocked. Refresh and try again."
      );
    }

    window.location.reload();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not unlock picks."
    );
  } finally {
    setLifecycleWorking(false);
  }
}

async function openQrCode() {
  const inviteLink = getInviteLink();

  if (!inviteLink) return;

  try {
    const dataUrl = await QRCode.toDataURL(inviteLink, {
      width: 320,
      margin: 2,
    });

    setQrDataUrl(dataUrl);
    setShowQr(true);
  } catch {
    setError("Could not generate the QR code.");
  }
}

function startRename(player: ReadinessRow) {
  setEditingPlayerId(player.playerId);
  setEditingPlayerName(player.name);
  setError(null);
}

function cancelRename() {
  setEditingPlayerId(null);
  setEditingPlayerName("");
}

async function savePlayerRename(player: ReadinessRow) {
  const trimmedName = editingPlayerName.trim();

  if (!trimmedName) {
    setError("Player name cannot be empty.");
    return;
  }

  if (trimmedName === player.name) {
    cancelRename();
    return;
  }

  setPlayerActionId(player.playerId);
  setError(null);

  try {
    const { error: updateError } = await supabase
      .from("players")
      .update({
        display_name: trimmedName,
      })
      .eq("id", player.playerId);

    if (updateError) {
      if (updateError.code === "23505") {
        throw new Error(
          "Another player in this game already has that name."
        );
      }

      throw updateError;
    }

    cancelRename();
    await refresh();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not rename player."
    );
  } finally {
    setPlayerActionId(null);
  }
}

async function confirmRemovePlayer() {
  if (!removePlayer) return;

  setPlayerActionId(removePlayer.playerId);
  setError(null);

  try {
    const { data: deletedRows, error: deleteError } = await supabase
  .from("players")
  .delete()
  .eq("id", removePlayer.playerId)
  .select("id");

if (deleteError) throw deleteError;

if (!deletedRows || deletedRows.length === 0) {
  throw new Error("Player could not be removed.");
}

    if (deleteError) throw deleteError;

    setRemovePlayer(null);
    await refresh();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not remove player."
    );
  } finally {
    setPlayerActionId(null);
  }
}

  async function refresh() {
    setError(null);
    setLoading(true);

    try {
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, code, title, is_locked, status")
        .eq("code", joinCode)
        .single();

      if (gErr || !g) throw new Error("Game not found.");
      setGame(g);

      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id, prompt, options, sort_order, correct_option, resolved_at")
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
          resolved_at: row.resolved_at,
        }))
      );

      const questionIds = (qs ?? []).map((question) => question.id);

const { data: playerData, error: playerError } = await supabase
  .from("players")
  .select("id, display_name")
  .eq("game_id", g.id)
  .order("display_name", { ascending: true });

if (playerError) throw playerError;

const players = (playerData ?? []) as PlayerRow[];

const answerData = await fetchAllAnswers(questionIds);
setAllAnswers(answerData);

const answeredByPlayer = new Map<string, Set<string>>();

for (const answer of answerData) {
  if (!answeredByPlayer.has(answer.player_id)) {
    answeredByPlayer.set(answer.player_id, new Set());
  }

  answeredByPlayer.get(answer.player_id)!.add(answer.question_id);
}

const questionCount = questionIds.length;

setReadinessRows(
  players.map((player) => {
    const answered =
      answeredByPlayer.get(player.id)?.size ?? 0;

    return {
      playerId: player.id,
      name: player.display_name,
      answered,
      complete:
        questionCount > 0 && answered === questionCount,
    };
  })
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

  useLivePolling({
  enabled: game?.status === "live",
  onPoll: refresh,
});

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

 async function confirmResolution() {
  if (!pendingResolution) return;

  const { questionId, option } = pendingResolution;

  setSavingId(questionId);
  setError(null);

  try {
    const res = await fetch("/api/admin/correct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        correctOption: option,
        key: adminKey,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? "Failed to resolve question.");
    }

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              correct_option: option,
              resolved_at: json.resolvedAt ?? q.resolved_at,
            }
          : q
      )
    );

    setPendingResolution(null);
    setEditingResultId(null);
  } catch (e: any) {
    setError(e?.message ?? "Failed to resolve question.");
    await refresh();
  } finally {
    setSavingId(null);
  }
}
function getQuestionCrowdStats(question: QuestionRow) {
  const questionAnswers = allAnswers.filter(
    (answer) => answer.question_id === question.id
  );

  const totalAnswered = questionAnswers.length;

  if (!question.correct_option || totalAnswered === 0) {
    return {
      correctCount: 0,
      totalAnswered,
      accuracyPercent: 0,
    };
  }

  const correctCount = questionAnswers.filter(
    (answer) => answer.option === question.correct_option
  ).length;

  return {
    correctCount,
    totalAnswered,
    accuracyPercent: Math.round(
      (correctCount / totalAnswered) * 100
    ),
  };
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
            Resolved: {resolvedCount}/{totalQuestions}
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
      <section className="mt-6 sbq-card overflow-hidden">
  <div className="border-b border-border px-5 py-5 sm:px-6">
    <p className="sbq-eyebrow">Pregame</p>

    <div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
  <div>
    <h2 className="text-xl font-bold tracking-tight">
      Player Readiness
    </h2>

    <p className="mt-1 text-sm text-muted">
      See who has finished their picks before locking the game.
    </p>
  </div>

  <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={copyInviteLink}
      className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
    >
      {inviteCopied ? "Copied ✓" : "Copy Invite Link"}
    </button>

    <button
      type="button"
      onClick={openQrCode}
      className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
    >
      Show QR
    </button>

    <button
      type="button"
      onClick={() => refresh()}
      className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
    >
      Refresh
    </button>
  </div>
</div>
  </div>

  <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
    <div className="bg-surface p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Players
      </p>
      <p className="mt-1 text-2xl font-bold">
        {totalPlayers}
      </p>
    </div>

    <div className="bg-surface p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Complete
      </p>
      <p className="mt-1 text-2xl font-bold text-success">
        {completePlayers}
      </p>
    </div>

    <div className="bg-surface p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Incomplete
      </p>
      <p className="mt-1 text-2xl font-bold">
        {incompletePlayers}
      </p>
    </div>

    <div className="bg-surface p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Picks Made
      </p>
      <p className="mt-1 text-2xl font-bold">
        {totalPicksMade}
        <span className="text-sm font-medium text-muted">
          {" "}/ {totalPossiblePicks}
        </span>
      </p>
    </div>
  </div>

  <div className="border-t border-border px-5 py-4 sm:px-6">
    <div className="flex flex-wrap gap-2">
      {game?.status === "pregame" && !game.is_locked ? (
  <button
    type="button"
    onClick={() => setShowLockConfirm(true)}
    disabled={lifecycleWorking}
    className="sbq-touch-target rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
  >
    Lock Picks
  </button>
) : game?.status === "live" && game.is_locked ? (
  <button
    type="button"
    onClick={() => void unlockPicks()}
    disabled={lifecycleWorking}
    className="sbq-touch-target rounded-xl border border-warning/30 bg-surface px-4 py-2 text-sm font-semibold text-warning transition-colors hover:bg-warning-soft disabled:opacity-50"
  >
    {lifecycleWorking ? "Unlocking..." : "Unlock Picks"}
  </button>
) : null}
      <button
        type="button"
        onClick={() => setPlayerFilter("all")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          playerFilter === "all"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        All ({totalPlayers})
      </button>

      <button
        type="button"
        onClick={() => setPlayerFilter("complete")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          playerFilter === "complete"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        Complete ({completePlayers})
      </button>

      <button
        type="button"
        onClick={() => setPlayerFilter("incomplete")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          playerFilter === "incomplete"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        Incomplete ({incompletePlayers})
      </button>
    </div>
  </div>

  <div className="divide-y divide-border">
    {filteredPlayers.length === 0 ? (
      <div className="px-5 py-8 text-center text-sm text-muted sm:px-6">
        No players match this filter.
      </div>
    ) : (
      filteredPlayers.map((player) => {
  const isEditing = editingPlayerId === player.playerId;
  const isWorking = playerActionId === player.playerId;

  return (
    <div
      key={player.playerId}
      className="px-5 py-4 sm:px-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={editingPlayerName}
                onChange={(event) =>
                  setEditingPlayerName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void savePlayerRename(player);
                  }

                  if (event.key === "Escape") {
                    cancelRename();
                  }
                }}
                disabled={isWorking}
                autoFocus
                className="sbq-touch-target w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-brand sm:max-w-xs"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void savePlayerRename(player)}
                  disabled={isWorking}
                  className="sbq-touch-target rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isWorking ? "Saving..." : "Save"}
                </button>

                <button
                  type="button"
                  onClick={cancelRename}
                  disabled={isWorking}
                  className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate font-semibold">
                {player.name}
              </p>

              <p className="mt-0.5 text-sm text-muted">
                {player.answered} of {totalQuestions} answered
              </p>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                player.complete
                  ? "bg-success-soft text-success"
                  : "bg-surface-subtle text-muted",
              ].join(" ")}
            >
              {player.complete ? "Complete" : "Incomplete"}
            </span>

            <button
              type="button"
              onClick={() => startRename(player)}
              disabled={isWorking}
              className="sbq-touch-target rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle disabled:opacity-50"
            >
              Rename
            </button>

            <button
              type="button"
              onClick={() => setRemovePlayer(player)}
              disabled={isWorking}
              className="sbq-touch-target rounded-xl border border-danger/30 bg-surface px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
})
    )}
  </div>
</section>
<section className="mt-6 sbq-card overflow-hidden">
  <div className="border-b border-border px-5 py-5 sm:px-6">
    <p className="sbq-eyebrow">
      {game.status === "live" ? "Live" : "Scoring"}
    </p>

    <div className="mt-1 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Live Control
        </h2>

        <p className="mt-1 text-sm text-muted">
          {resolvedCount} of {totalQuestions} questions resolved.
        </p>
      </div>

      <button
        type="button"
        onClick={() => refresh()}
        className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
      >
        Refresh
      </button>
    </div>
  </div>

  <div className="border-b border-border px-5 py-4 sm:px-6">
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setQuestionFilter("unresolved")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          questionFilter === "unresolved"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        Unresolved ({unresolvedQuestions.length})
      </button>

      <button
        type="button"
        onClick={() => setQuestionFilter("resolved")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          questionFilter === "resolved"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        Resolved ({resolvedQuestions.length})
      </button>

      <button
        type="button"
        onClick={() => setQuestionFilter("all")}
        className={[
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          questionFilter === "all"
            ? "bg-foreground text-background"
            : "border border-border bg-surface text-muted hover:bg-surface-subtle",
        ].join(" ")}
      >
        All ({totalQuestions})
      </button>
    </div>
  </div>

        <div className="divide-y divide-border">
    {filteredQuestions.length === 0 ? (
      <div className="px-5 py-10 text-center text-sm text-muted sm:px-6">
        No questions match this filter.
      </div>
    ) : (
      filteredQuestions.map((q) => {
        const isResolved =
          q.correct_option != null &&
          String(q.correct_option).trim() !== "";

        return (
          <div
            key={q.id}
            className={[
              "px-5 py-5 sm:px-6",
              isResolved ? "bg-success-soft/30" : "bg-surface",
            ].join(" ")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Question {q.sort_order + 1}
                  </p>

                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      isResolved
                        ? "bg-success-soft text-success"
                        : "bg-surface-subtle text-muted",
                    ].join(" ")}
                  >
                    {isResolved ? "Resolved" : "Unresolved"}
                  </span>
                </div>

                <p className="mt-2 font-semibold leading-snug">
                  {q.prompt}
                </p>

                {isResolved && (() => {
  const crowd = getQuestionCrowdStats(q);

  return (
    <div className="mt-3">
      <p className="text-sm">
        Correct answer:{" "}
        <span className="font-semibold text-success">
          {q.correct_option}
        </span>
      </p>

      <p className="mt-1 text-sm text-muted">
        Crowd accuracy:{" "}
        <span className="font-semibold text-foreground">
          {crowd.correctCount}/{crowd.totalAnswered}
        </span>
        {" "}· {crowd.accuracyPercent}%
      </p>
    </div>
  );
})()}
              </div>

              {savingId === q.id && (
                <span className="shrink-0 text-xs font-medium text-muted">
                  Saving…
                </span>
              )}
            </div>

            <div className="mt-4">
  {!isResolved || editingResultId === q.id ? (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={savingId === q.id}
            onClick={() =>
              setPendingResolution({
                questionId: q.id,
                prompt: q.prompt,
                option: opt,
                isEdit: isResolved,
              })
            }
            className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-semibold transition-colors hover:border-brand hover:bg-brand-soft disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted">
        Select the correct answer to review it before resolving.
      </p>
    </>
  ) : (
    <div className="flex flex-col gap-3">
  <p className="text-xs text-muted">
    This question has been resolved.
  </p>

  <button
    type="button"
    onClick={() => setEditingResultId(q.id)}
    className="sbq-touch-target self-start rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-subtle"
  >
    Edit Result
  </button>
</div>
  )}
</div>
          </div>
        );
      })
    )}
  </div>
</section>

        {showQr && qrDataUrl && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="sbq-eyebrow">Game Invite</p>

          <h2 className="mt-1 text-xl font-bold tracking-tight">
            Scan to Join
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowQr(false)}
          className="sbq-touch-target rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-subtle"
        >
          Close
        </button>
      </div>

      <div className="mt-6 flex justify-center rounded-2xl bg-white p-4">
        <img
          src={qrDataUrl}
          alt={`QR code to join ${game?.title ?? "game"}`}
          className="h-auto w-full max-w-[280px]"
        />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Scan this code to join the game.
      </p>

      <button
        type="button"
        onClick={copyInviteLink}
        className="sbq-touch-target mt-4 w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
      >
        {inviteCopied ? "Copied ✓" : "Copy Invite Link"}
      </button>
    </div>
  </div>
)}
{removePlayer && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
      <p className="sbq-eyebrow">Remove Player</p>

      <h2 className="mt-1 text-xl font-bold tracking-tight">
        Remove {removePlayer.name}?
      </h2>

      <p className="mt-3 text-sm leading-6 text-muted">
        This will permanently remove the player and all of their saved
        answers from this game.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setRemovePlayer(null)}
          disabled={playerActionId === removePlayer.playerId}
          className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-subtle disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void confirmRemovePlayer()}
          disabled={playerActionId === removePlayer.playerId}
          className="sbq-touch-target rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {playerActionId === removePlayer.playerId
            ? "Removing..."
            : "Remove Player"}
        </button>
      </div>
    </div>
  </div>
)}
{showLockConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
      <p className="sbq-eyebrow">Start Game</p>

      <h2 className="mt-1 text-xl font-bold tracking-tight">
        Lock everyone&apos;s picks?
      </h2>

      <p className="mt-3 text-sm leading-6 text-muted">
        Once locked, players will no longer be able to change their
        predictions.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-subtle p-3 text-center">
          <p className="text-2xl font-bold">
            {totalPlayers}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">
            Players
          </p>
        </div>

        <div className="rounded-xl bg-surface-subtle p-3 text-center">
          <p className="text-2xl font-bold text-success">
            {completePlayers}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">
            Complete
          </p>
        </div>

        <div className="rounded-xl bg-surface-subtle p-3 text-center">
          <p className="text-2xl font-bold">
            {incompletePlayers}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">
            Incomplete
          </p>
        </div>
      </div>

      {incompletePlayers > 0 && (
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning">
            {incompletePlayers}{" "}
            {incompletePlayers === 1 ? "player has" : "players have"} unfinished picks.
          </p>

          <p className="mt-1 text-sm leading-6 text-muted">
            Unanswered questions will remain unanswered and receive 0
            points.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {readinessRows
              .filter((player) => !player.complete)
              .map((player) => (
                <span
                  key={player.playerId}
                  className="rounded-full border border-warning/20 bg-surface px-3 py-1 text-xs font-semibold"
                >
                  {player.name} · {player.answered}/{totalQuestions}
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setShowLockConfirm(false)}
          disabled={lifecycleWorking}
          className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-subtle disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void lockPicks()}
          disabled={lifecycleWorking}
          className="sbq-touch-target rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {lifecycleWorking ? "Locking..." : "Lock Picks"}
        </button>
      </div>
    </div>
  </div>
)}
      {pendingResolution && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
      <p className="sbq-eyebrow">
  {pendingResolution.isEdit ? "Edit Result" : "Resolve Question"}
</p>

      <h2 className="mt-1 text-xl font-bold tracking-tight">
  {pendingResolution.isEdit
    ? "Confirm result change"
    : "Confirm correct answer"}
</h2>

      <p className="mt-4 text-sm font-semibold leading-6">
        {pendingResolution.prompt}
      </p>

      <div className="mt-4 rounded-xl border border-success/30 bg-success-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Correct Answer
        </p>

        <p className="mt-1 text-lg font-bold text-success">
          {pendingResolution.option}
        </p>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        Resolving this question will immediately affect player scores.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setPendingResolution(null)}
          disabled={savingId === pendingResolution.questionId}
          className="sbq-touch-target rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold transition-colors hover:bg-surface-subtle disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void confirmResolution()}
          disabled={savingId === pendingResolution.questionId}
          className="sbq-touch-target rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {savingId === pendingResolution.questionId
  ? "Saving..."
  : pendingResolution.isEdit
    ? "Confirm Change"
    : "Confirm & Resolve"}
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}
