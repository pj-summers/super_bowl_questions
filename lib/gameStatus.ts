export type GameStatus = "pregame" | "live" | "completed";

export function isGameStatus(value: unknown): value is GameStatus {
  return (
    value === "pregame" ||
    value === "live" ||
    value === "completed"
  );
}

export function getGameStatus(
  status: unknown,
  isLocked: boolean
): GameStatus {
  if (isGameStatus(status)) {
    return status;
  }

  return isLocked ? "live" : "pregame";
}

export function isGameLocked(status: GameStatus): boolean {
  return status === "live" || status === "completed";
}