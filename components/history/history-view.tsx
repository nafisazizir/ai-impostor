"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type { GameSummary, PersistedGame } from "@/lib/game/persisted";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SeatRing } from "@/components/game/seat-ring";
import { ThinkingPanel } from "@/components/game/thinking-panel";
import { ThinkingPanelToggle } from "@/components/game/thinking-panel-toggle";
import { GameListSidebar } from "@/components/history/game-list-sidebar";
import { HistoryGameHeader } from "@/components/history/history-game-header";

export function HistoryView({
  initialGames,
  total,
  initialGame,
  initialGameId,
}: {
  initialGames: GameSummary[];
  total: number;
  initialGame: PersistedGame | null;
  initialGameId: string | null;
}) {
  const router = useRouter();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    initialGameId,
  );
  const [selectedGame, setSelectedGame] = useState<PersistedGame | null>(
    initialGame,
  );
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function selectGame(gameId: string) {
    if (gameId === selectedGameId) return;
    setSelectedGameId(gameId);
    setLoading(true);
    try {
      const res = await fetch(`/api/history/${gameId}`);
      if (res.ok) {
        const game: PersistedGame = await res.json();
        setSelectedGame(game);
        router.replace(`/history?game=${gameId}`, { scroll: false });
      }
    } finally {
      setLoading(false);
    }
    setSidebarOpen(false);
  }

  return (
    <div className="relative flex h-dvh flex-col md:flex-row">
      <div className="hidden md:block">
        <GameListSidebar
          initialGames={initialGames}
          total={total}
          selectedGameId={selectedGameId}
          onSelectGame={selectGame}
        />
      </div>

      {/* Center content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selectedGame ? (
          <>
            <HistoryGameHeader summary={selectedGame.summary} />
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
              <SeatRing state={selectedGame.state} activeSeat={null} />
            </div>

            <div className="p-2 md:hidden">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground/50 h-auto cursor-pointer p-0 font-mono text-xs tracking-tight"
                    />
                  }
                >
                  history
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
                  <SheetHeader className="sr-only">
                    <SheetTitle>Game History</SheetTitle>
                  </SheetHeader>

                  <GameListSidebar
                    initialGames={initialGames}
                    total={total}
                    selectedGameId={selectedGameId}
                    onSelectGame={selectGame}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground/60 font-mono text-sm">
              Select a game to view
            </p>
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground cursor-pointer text-xs"
              >
                ← Back to Live
              </Button>
            </Link>
          </div>
        )}
      </div>

      {selectedGame && (
        <ThinkingPanelToggle open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} />
      )}

      {/* Thinking panel */}
      {selectedGame && (
        <ThinkingPanel thinking={selectedGame.thinking} open={panelOpen} />
      )}
    </div>
  );
}
