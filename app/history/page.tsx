import type { Metadata } from "next";
import { listRecentGameSummaries, getGameCount, getPersistedGame } from "@/lib/storage/redis";
import { HistoryView } from "@/components/history/history-view";

export const metadata: Metadata = {
  title: "Game History | AI Impostor",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const explicitGameId = typeof params.game === "string" ? params.game : null;

  const [games, total] = await Promise.all([
    listRecentGameSummaries(20),
    getGameCount(),
  ]);

  // Auto-select the latest game if none specified
  const gameId = explicitGameId ?? games[0]?.gameId ?? null;
  const initialGame = gameId ? await getPersistedGame(gameId) : null;

  return (
    <HistoryView
      initialGames={games}
      total={total}
      initialGame={initialGame}
      initialGameId={gameId}
    />
  );
}
