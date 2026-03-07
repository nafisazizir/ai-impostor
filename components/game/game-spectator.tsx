"use client";

import { useEffect, useRef, useState } from "react";

import type { MockSnapshot } from "@/lib/game/mock-states";
import type { GameSnapshot } from "@/lib/game/snapshot";
import type { GameState } from "@/lib/game/state";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type {
  GameStreamStatus,
  StreamingThinking,
  StreamingAnswer,
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

type Props = { mode: "mock"; snapshots: MockSnapshot[] } | { mode: "live" };

export function GameSpectator(props: Props) {
  if (props.mode === "mock") {
    return <MockSpectator snapshots={props.snapshots} />;
  }
  return <LiveSpectator />;
}

// ─── Mock mode ────────────────────────────────────────────────────────────────

function MockSpectator({ snapshots }: { snapshots: MockSnapshot[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinished = currentIndex >= snapshots.length - 1;

  // Auto-advance with 2s delay, stop at last snapshot
  useEffect(() => {
    if (isFinished) return;
    timerRef.current = setTimeout(() => {
      setCurrentIndex((i) => i + 1);
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isFinished]);

  const restart = () => setCurrentIndex(0);

  const { state, thinking } = snapshots[currentIndex];
  const activeSeat = deriveActiveSeat(state);

  return (
    <SpectatorShell
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      status={isFinished ? "finished" : "playing"}
      onAction={restart}
    />
  );
}

// ─── Live mode ────────────────────────────────────────────────────────────────

function LiveSpectator() {
  const {
    snapshots,
    currentIndex,
    status,
    error,
    streamingThinking,
    streamingAnswer,
    reconnect,
  } = useGameStream();

  const snapshot: GameSnapshot | undefined = snapshots[currentIndex];
  const state = snapshot?.state;
  const thinking = snapshot?.thinking ?? [];
  const activeSeat = state ? deriveActiveSeat(state) : null;

  const shellStatus = deriveShellStatus(status, !!snapshot);

  return (
    <SpectatorShell
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      streamingThinking={streamingThinking}
      streamingAnswer={streamingAnswer}
      status={shellStatus}
      error={error}
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
  state?: GameState;
  activeSeat: SeatNumber | null;
  thinking: ThinkingEntry[];
  streamingThinking?: StreamingThinking | null;
  streamingAnswer?: StreamingAnswer | null;
  status: "connecting" | "error" | "playing" | "finished" | "between-games";
  error?: string | null;
  onAction: () => void;
};

function SpectatorShell({
  state,
  activeSeat,
  thinking,
  streamingThinking,
  streamingAnswer,
  status,
  error,
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
        <GameHeader state={state} status={status} />

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

          {status === "between-games" && (
            <>
              {state && <SeatRing state={state} activeSeat={null} />}
              <div className="flex flex-col items-center gap-3">
                <DotMatrixLoader />
                <p className="text-muted-foreground font-mono text-sm">
                  Next game starting...
                </p>
              </div>
            </>
          )}

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

        <footer className="text-muted-foreground/50 flex flex-row items-center justify-end gap-4 p-2 font-mono text-xs tracking-tight">
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
