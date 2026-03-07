"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { GameSummary } from "@/lib/game/persisted";
import { Button } from "@/components/ui/button";
import { DotMatrixLoader } from "@/components/ui/dot-matrix-loader";
import { GameSummaryCard } from "@/components/history/game-summary-card";

export function GameListSidebar({
  initialGames,
  total,
  selectedGameId,
  onSelectGame,
}: {
  initialGames: GameSummary[];
  total: number;
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}) {
  const [games, setGames] = useState(initialGames);
  const [loading, setLoading] = useState(false);

  const hasMore = games.length < total;

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/history/list?limit=20&offset=${games.length}`,
      );
      const data = await res.json();
      setGames((prev) => [...prev, ...data.games]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-border flex h-full w-full md:w-72 shrink-0 flex-col md:border-r">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-sm font-medium tracking-tight">Game History</h2>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {games.length === 0 && !loading && (
          <p className="text-muted-foreground/60 px-3 py-8 text-center font-mono text-xs">
            No games yet
          </p>
        )}

        <div className="divide-border flex flex-col divide-y">
          {games.map((game) => (
            <GameSummaryCard
              key={game.gameId}
              summary={game}
              selected={game.gameId === selectedGameId}
              onSelect={() => onSelectGame(game.gameId)}
            />
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center p-6">
            <DotMatrixLoader size="md" />
          </div>
        )}

        {hasMore && !loading && (
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              className="text-muted-foreground w-full cursor-pointer text-xs"
            >
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
