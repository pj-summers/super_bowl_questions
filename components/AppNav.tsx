"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
  getGameStatus,
  type GameStatus,
} from "@/lib/gameStatus";
import { supabase } from "@/lib/supabaseClient";

type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
  status: GameStatus;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M3 10.75 12 3l9 7.75" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function LeadersIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M8 21v-8h8v8" />
      <path d="M3 21v-5h5v5" />
      <path d="M16 21V10h5v11" />
      <path d="m12 3 .9 1.9 2.1.3-1.5 1.5.4 2.1L12 7.8l-1.9 1 .4-2.1L9 5.2l2.1-.3L12 3Z" />
    </svg>
  );
}

function PicksIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M7 4h10" />
      <path d="M7 9h10" />
      <path d="M7 14h6" />
      <path d="m15 18 2 2 4-5" />
      <path d="M4 4h.01M4 9h.01M4 14h.01" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M5 20V10" />
      <path d="M12 20V4" />
      <path d="M19 20v-7" />
    </svg>
  );
}

function getStatusLabel(status: GameStatus) {
  if (status === "live") return "Live";
  if (status === "completed") return "Completed";
  return "Pregame";
}

export default function AppNav() {
  const pathname = usePathname();

  const [lastCode, setLastCode] = useState<string>("LX");
  const [lastName, setLastName] = useState<string>("");
  const [game, setGame] = useState<GameRow | null>(null);

  const code = useMemo(
    () => (lastCode || "LX").toUpperCase(),
    [lastCode]
  );

  useEffect(() => {
    const savedCode = window.localStorage.getItem("sbq:lastCode");
    if (savedCode) setLastCode(savedCode.toUpperCase());

    const savedName = window.localStorage.getItem("sbq:lastName");
    if (savedName) setLastName(savedName);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGame() {
      try {
        const { data, error } = await supabase
          .from("games")
          .select("id, code, title, is_locked, status")
          .eq("code", code)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setGame(null);
          return;
        }

        setGame(data ?? null);
      } catch {
        if (!cancelled) {
          setGame(null);
        }
      }
    }

    loadGame();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const gameStatus = game
    ? getGameStatus(game.status, game.is_locked)
    : "pregame";

  const gameHref = lastName
    ? `/game/${code}?name=${encodeURIComponent(lastName)}`
    : `/game/${code}`;

  const liveNav: NavItem[] = [
    {
      href: gameHref,
      label: "Home",
      icon: <HomeIcon />,
    },
    {
      href: `/leaderboard/${code}`,
      label: "Leaders",
      icon: <LeadersIcon />,
    },
    {
      href: `/answers/${code}`,
      label: "Picks",
      icon: <PicksIcon />,
    },
    {
      href: `/stats/${code}`,
      label: "Stats",
      icon: <StatsIcon />,
    },
  ];

  const desktopNav = [
    { href: gameHref, label: gameStatus === "live" ? "Home" : "Game" },
    { href: `/leaderboard/${code}`, label: "Leaders" },
    { href: `/answers/${code}`, label: "Picks" },
    { href: `/stats/${code}`, label: "Stats" },
    { href: "/champions", label: "Champions" },
  ];

  function isActive(href: string) {
    if (href.startsWith("/game/")) {
      return pathname?.startsWith(`/game/${code}`);
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href={gameHref}
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold tracking-tight text-brand-foreground">
              SB
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight sm:text-base">
                Super Bowl Questions
              </div>

              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <span className="truncate">
                  {game?.title ?? `Game ${code}`}
                </span>

                <span aria-hidden="true">•</span>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-semibold",
                    gameStatus === "live" && "text-success",
                    gameStatus === "completed" && "text-muted",
                    gameStatus === "pregame" && "text-brand"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      gameStatus === "live" && "bg-success",
                      gameStatus === "completed" && "bg-muted",
                      gameStatus === "pregame" && "bg-brand"
                    )}
                  />

                  {getStatusLabel(gameStatus)}
                </span>
              </div>
            </div>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground",
                  isActive(item.href) &&
                    "bg-brand-soft text-brand"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/champions"
            className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle md:hidden"
          >
            Champs
          </Link>
        </div>
      </header>

      {gameStatus === "live" && (
        <nav
          aria-label="Live game navigation"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
            {liveNav.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "sbq-touch-target flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors",
                    active
                      ? "text-brand"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {gameStatus === "live" && (
        <div
          aria-hidden="true"
          className="h-20 md:hidden"
        />
      )}
    </>
  );
}