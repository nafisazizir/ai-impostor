"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import type { GameSummary, PersistedGame } from "@/lib/game/persisted";
import { cn } from "@/lib/utils";
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
import { GameListSidebar } from "@/components/history/game-list-sidebar";
import { HistoryGameHeader } from "@/components/history/history-game-header";
import { EventTimeline } from "@/components/history/event-timeline";

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
    <div className="relative flex h-screen flex-col md:flex-row">
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
        {selectedGame && !loading ? (
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
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground animate-pulse font-mono text-sm">
              Loading game...
            </p>
          </div>
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

      {/* Thinking panel toggle */}
      {selectedGame && (
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={cn(
            "bg-background hover:bg-muted text-muted-foreground absolute z-20 flex cursor-pointer items-center justify-center transition-all duration-300",
            "bottom-0 left-1/2 h-5 w-10 -translate-x-1/2 rounded-t-lg border-b-0",
            panelOpen ? "max-md:bottom-[25vh]" : "max-md:bottom-0",
            "md:top-1/2 md:bottom-auto md:left-auto md:h-10 md:w-5 md:translate-x-0 md:-translate-y-1/2 md:rounded-t-none md:rounded-l-lg",
            panelOpen ? "md:right-80 xl:right-96" : "md:right-0",
          )}
          aria-label={
            panelOpen ? "Collapse thinking panel" : "Expand thinking panel"
          }
        >
          {panelOpen ? (
            <>
              <ChevronDown className="size-3.5 md:hidden" />
              <ChevronRight className="hidden size-3.5 md:block" />
            </>
          ) : (
            <>
              <ChevronUp className="size-3.5 md:hidden" />
              <ChevronLeft className="hidden size-3.5 md:block" />
            </>
          )}
        </button>
      )}

      {/* Thinking panel */}
      {selectedGame && (
        <ThinkingPanel thinking={selectedGame.thinking} open={panelOpen} />
      )}
    </div>
  );
}
