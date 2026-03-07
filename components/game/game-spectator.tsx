"use client";

import { useState } from "react";

import type { GameSnapshot } from "@/lib/game/snapshot";
import type { GameState } from "@/lib/game/state";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type {
  GameStreamStatus,
  StreamingThinking,
  StreamingAnswer,
  StreamMode,
} from "@/hooks/use-game-stream";
import { deriveActiveSeat } from "@/lib/game/ui-helpers";
import { useGameStream } from "@/hooks/use-game-stream";

import { Button } from "@/components/ui/button";
import { DotMatrixLoader } from "@/components/ui/dot-matrix-loader";
import { GameHeader } from "@/components/game/game-header";
import { SeatRing } from "@/components/game/seat-ring";
import { ThinkingPanel } from "@/components/game/thinking-panel";
import { ThinkingPanelToggle } from "@/components/game/thinking-panel-toggle";
import Link from "next/link";

export function GameSpectator() {
  const {
    snapshots,
    currentIndex,
    status,
    error,
    streamingThinking,
    streamingAnswer,
    mode,
    reconnect,
    gameId,
  } = useGameStream();

  const snapshot: GameSnapshot | undefined = snapshots[currentIndex];
  const state = snapshot?.state;
  const thinking = snapshot?.thinking ?? [];
  const activeSeat = state ? deriveActiveSeat(state) : null;

  const shellStatus = deriveShellStatus(status, !!snapshot);

  return (
    <SpectatorShell
      gameId={gameId}
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      streamingThinking={streamingThinking}
      streamingAnswer={streamingAnswer}
      status={shellStatus}
      error={error}
      mode={mode}
      onAction={reconnect}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveShellStatus(
  status: GameStreamStatus,
  hasSnapshot: boolean,
): SpectatorShellProps["status"] {
  if (status === "between-games") return "between-games";
  if (hasSnapshot) return "playing";
  if (status === "error") return "error";
  return "connecting";
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

type SpectatorShellProps = {
  gameId: string | null;
  state?: GameState;
  activeSeat: SeatNumber | null;
  thinking: ThinkingEntry[];
  streamingThinking?: StreamingThinking | null;
  streamingAnswer?: StreamingAnswer | null;
  status: "connecting" | "error" | "playing" | "finished" | "between-games";
  error?: string | null;
  mode?: StreamMode;
  onAction: () => void;
};

function SpectatorShell({
  gameId,
  state,
  activeSeat,
  thinking,
  streamingThinking,
  streamingAnswer,
  status,
  error,
  mode,
  onAction,
}: SpectatorShellProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const togglePanel = () => setPanelOpen((v) => !v);

  if (status === "connecting" && !state) {
    return (
      <div className="flex h-screen items-center justify-center">
        <DotMatrixLoader />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col md:flex-row">
      {/* Left column: header + game area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <GameHeader key={gameId ?? undefined} state={state} status={status} />

        <main id="main-content" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
          {status === "error" && (
            <>
              <p className="text-sm text-red-400">
                {error ?? "Something went wrong"}
              </p>
              <Button
                onClick={onAction}
                className="hover:bg-primary/80 cursor-pointer"
                size="lg"
              >
                Try Again
              </Button>
            </>
          )}

          {/* {status === "between-games" && (
            <>
              {state && <SeatRing state={state} activeSeat={null} />}
              <div className="flex flex-col items-center gap-3">
                <DotMatrixLoader />
                <p className="text-muted-foreground font-mono text-sm">
                  Next game starting...
                </p>
              </div>
            </>
          )} */}

          {(status === "playing" || status === "finished") && state && (
            <>
              <SeatRing state={state} activeSeat={activeSeat} />

              {status === "finished" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAction}
                  className="text-muted-foreground cursor-pointer text-xs"
                >
                  Watch New Game
                </Button>
              )}
            </>
          )}
        </main>

        <footer className="text-muted-foreground/50 flex flex-row items-center justify-between gap-4 p-2 font-mono text-xs tracking-tight">
          <div className="px-2">
            {mode === "replay" && (
              <span className="text-muted-foreground/70 uppercase tracking-widest">
                replay
              </span>
            )}
          </div>
          <div className="flex flex-row items-center gap-4">
          <Link
            href="/history"
            className="hover:text-muted-foreground px-2 py-2 transition-colors duration-200"
          >
            history
          </Link>
          <a
            href="https://x.com/nafisazizir"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground px-2 py-2 transition-colors duration-200"
          >
            @nafisazizir
          </a>
          </div>
        </footer>
      </div>

      <ThinkingPanelToggle open={panelOpen} onToggle={togglePanel} />

      <ThinkingPanel
        thinking={thinking}
        streamingThinking={streamingThinking}
        streamingAnswer={streamingAnswer}
        open={panelOpen}
      />
    </div>
  );
}
