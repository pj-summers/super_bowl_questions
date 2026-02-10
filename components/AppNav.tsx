"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type GameRow = {
  id: string;
  code: string;
  title: string;
  is_locked: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppNav() {
  const pathname = usePathname();

  const [lastCode, setLastCode] = useState<string>("LX"); // fallback
  const [lastName, setLastName] = useState<string>("");
  const [game, setGame] = useState<GameRow | null>(null);

  // Keep a stable, uppercase code
  const code = useMemo(() => (lastCode || "LX").toUpperCase(), [lastCode]);

  useEffect(() => {
    // Load last used join code from localStorage (set by join/game pages)
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
          .select("id, code, title, is_locked")
          .eq("code", code)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setGame(null);
          return;
        }
        setGame(data ?? null);
      } catch {
        if (!cancelled) setGame(null);
      }
    }

    loadGame();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const locked = game?.is_locked ?? false;

  const gameHref = lastName
    ? `/game/${code}?name=${encodeURIComponent(lastName)}`
    : `/game/${code}`;

  const nav = [
    { href: "/", label: "Join" },
    { href: gameHref, label: "Game" },
    { href: `/leaderboard/${code}`, label: "Leaderboard" },
    { href: `/answers/${code}`, label: "Answers" },
    { href: "/champions", label: "Champions" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl border flex items-center justify-center font-semibold">
            SB
          </div>

          <div className="min-w-0">
            <div className="font-semibold leading-tight truncate">
              Super Bowl Questions
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-mono">Code: {code}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5",
                  locked ? "bg-gray-50" : "bg-green-50"
                )}
                title={locked ? "Submissions locked" : "Submissions open"}
              >
                <span
                  className={cn(
                    "mr-1 inline-block h-2 w-2 rounded-full",
                    locked ? "bg-gray-400" : "bg-green-500"
                  )}
                />
                <span className="text-[11px] text-gray-700">
                  {locked ? "Locked" : "Open"}
                </span>
              </span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-xl px-3 py-2 text-sm border hover:bg-gray-50",
                  active && "bg-gray-50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
