export type RememberedPlayer = {
  playerId: string;
};

function getStorageKey(gameCode: string) {
  return `sbq:player:${gameCode.trim().toUpperCase()}`;
}

export function getRememberedPlayer(
  gameCode: string
): RememberedPlayer | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getStorageKey(gameCode));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RememberedPlayer>;

    if (
      typeof parsed.playerId !== "string" ||
      parsed.playerId.trim().length === 0
    ) {
      return null;
    }

    return {
      playerId: parsed.playerId,
    };
  } catch {
    return null;
  }
}

export function rememberPlayer(
  gameCode: string,
  playerId: string
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(gameCode),
    JSON.stringify({
      playerId,
    } satisfies RememberedPlayer)
  );
}

export function forgetRememberedPlayer(gameCode: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStorageKey(gameCode));
}