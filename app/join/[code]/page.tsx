"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  forgetRememberedPlayer,
  getRememberedPlayer,
  rememberPlayer,
} from "@/lib/playerIdentity";
import { supabase } from "@/lib/supabaseClient";

type GameRow = {
  id: string;
  code: string;
  title: string;
};

type PlayerRow = {
  id: string;
  game_id: string;
  display_name: string;
};

export default function JoinGamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = useMemo(
    () => String(params.code ?? "").trim().toUpperCase(),
    [params.code]
  );

  const [game, setGame] = useState<GameRow | null>(null);
  const [rememberedPlayer, setRememberedPlayer] =
    useState<PlayerRow | null>(null);
  const [existingPlayer, setExistingPlayer] =
    useState<PlayerRow | null>(null);

  const [name, setName] = useState("");
  const [loadingGame, setLoadingGame] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGame() {
      setLoadingGame(true);
      setError(null);

      try {
        const { data: gameData, error: gameError } = await supabase
          .from("games")
          .select("id, code, title")
          .eq("code", code)
          .maybeSingle<GameRow>();

        if (cancelled) return;

        if (gameError) {
          throw gameError;
        }

        if (!gameData) {
          setGame(null);
          setError("This game could not be found.");
          return;
        }

        setGame(gameData);

        const remembered = getRememberedPlayer(code);

        if (!remembered) {
          return;
        }

        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("id, game_id, display_name")
          .eq("id", remembered.playerId)
          .eq("game_id", gameData.id)
          .maybeSingle<PlayerRow>();

        if (cancelled) return;

        if (playerError) {
          throw playerError;
        }

        if (!playerData) {
          forgetRememberedPlayer(code);
          return;
        }

        setRememberedPlayer(playerData);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong loading the game."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingGame(false);
        }
      }
    }

    if (code) {
      loadGame();
    }

    return () => {
      cancelled = true;
    };
  }, [code]);

  function continueAsPlayer(player: PlayerRow) {
    rememberPlayer(code, player.id);

    // Keep these legacy values during V2 development for V1 compatibility.
    window.localStorage.setItem("sbq:lastCode", code);
    window.localStorage.setItem("sbq:lastName", player.display_name);

    router.push(
  `/game/${code}?name=${encodeURIComponent(player.display_name)}`
);
  }

  function handleNotRememberedPlayer() {
    forgetRememberedPlayer(code);

    setRememberedPlayer(null);
    setExistingPlayer(null);
    setName("");
    setError(null);
  }

  function handleUseDifferentName() {
    setExistingPlayer(null);
    setName("");
    setError(null);
  }

  async function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!game) {
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const { data: playerMatch, error: existingError } = await supabase
        .from("players")
        .select("id, game_id, display_name")
        .eq("game_id", game.id)
        .ilike("display_name", trimmedName)
        .maybeSingle<PlayerRow>();

      if (existingError) {
        throw existingError;
      }

      if (playerMatch) {
        setExistingPlayer(playerMatch);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let userId = sessionData.session?.user?.id;

      if (!userId) {
        const { data: authData, error: authError } =
          await supabase.auth.signInAnonymously();

        if (authError) {
          throw authError;
        }

        userId = authData.user?.id;
      }

      if (!userId) {
        throw new Error("Could not create player session.");
      }

      const { data: player, error: insertError } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          user_id: userId,
          display_name: trimmedName,
        })
        .select("id, game_id, display_name")
        .single<PlayerRow>();

      if (insertError) {
        throw insertError;
      }

      continueAsPlayer(player);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong joining the game."
      );
    } finally {
      setJoining(false);
    }
  }

  if (loadingGame) {
    return (
      <div className="mx-auto max-w-md">
        <div className="sbq-card p-6 text-sm text-muted">
          Loading game...
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-md">
        <div className="sbq-card p-6">
          <p className="sbq-eyebrow">Super Bowl Questions</p>

          <h1 className="mt-2 text-2xl font-bold">
            Game not found
          </h1>

          <p className="mt-3 text-sm text-muted">
            Check the invite link and try again.
          </p>
        </div>
      </div>
    );
  }

  if (rememberedPlayer) {
    return (
      <div className="mx-auto flex max-w-md justify-center py-6 sm:py-10">
        <div className="sbq-card w-full p-6 sm:p-8">
          <p className="sbq-eyebrow">Super Bowl Questions</p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Welcome back, {rememberedPlayer.display_name}
          </h1>

          <p className="mt-2 text-sm text-muted">
            Continue to {game.title}.
          </p>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => continueAsPlayer(rememberedPlayer)}
              className="sbq-touch-target w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground transition-opacity hover:opacity-90"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={handleNotRememberedPlayer}
              className="sbq-touch-target w-full rounded-xl border border-border bg-surface px-4 py-3 font-semibold text-foreground transition-colors hover:bg-surface-subtle"
            >
              Not {rememberedPlayer.display_name}?
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (existingPlayer) {
    return (
      <div className="mx-auto flex max-w-md justify-center py-6 sm:py-10">
        <div className="sbq-card w-full p-6 sm:p-8">
          <p className="sbq-eyebrow">Super Bowl Questions</p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {existingPlayer.display_name} is already playing
          </h1>

          <p className="mt-2 text-sm text-muted">
            If this is you, continue with your existing entry.
          </p>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => continueAsPlayer(existingPlayer)}
              className="sbq-touch-target w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground transition-opacity hover:opacity-90"
            >
              Continue as {existingPlayer.display_name}
            </button>

            <button
              type="button"
              onClick={handleUseDifferentName}
              className="sbq-touch-target w-full rounded-xl border border-border bg-surface px-4 py-3 font-semibold text-foreground transition-colors hover:bg-surface-subtle"
            >
              Use a different name
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md justify-center py-6 sm:py-10">
      <div className="sbq-card w-full p-6 sm:p-8">
        <p className="sbq-eyebrow">Super Bowl Questions</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {game.title}
        </h1>

        <p className="mt-2 text-sm text-muted">
          Enter your name to join the game.
        </p>

        <form onSubmit={handleJoin} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="player-name"
              className="text-sm font-semibold"
            >
              Your name
            </label>

            <input
              id="player-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="First and last name"
              autoComplete="name"
              autoCorrect="off"
              disabled={joining}
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={joining}
            className="sbq-touch-target w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joining ? "Joining..." : "Join Game"}
          </button>
        </form>
      </div>
    </div>
  );
}