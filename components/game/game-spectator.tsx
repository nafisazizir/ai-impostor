"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { GameHeader } from "@/components/game/game-header";
import { SeatRing } from "@/components/game/seat-ring";
import { ThinkingPanel } from "@/components/game/thinking-panel";

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

  return (
    <div className="relative flex h-screen flex-col md:flex-row">
      {/* Left column: header + game area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <GameHeader state={state} status={status} />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
          {status === "connecting" && !state && (
            <p className="text-muted-foreground animate-pulse font-mono text-sm">
              Connecting to live game...
            </p>
          )}

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
              <p className="text-muted-foreground animate-pulse font-mono text-sm">
                Next game starting...
              </p>
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
        </div>
      </div>

      {/* Toggle tab — pinned to right edge (desktop) / bottom edge (mobile), always visible */}
      <button
        onClick={togglePanel}
        className={cn(
          "bg-background hover:bg-muted text-muted-foreground absolute z-20 flex cursor-pointer items-center justify-center transition-all duration-300",
          // Mobile: tab above bottom panel
          "bottom-0 left-1/2 h-5 w-10 -translate-x-1/2 rounded-t-lg border-b-0",
          panelOpen ? "max-md:bottom-[25vh]" : "max-md:bottom-0",
          // Desktop: tab on left side of panel
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

      <ThinkingPanel
        thinking={thinking}
        streamingThinking={streamingThinking}
        streamingAnswer={streamingAnswer}
        open={panelOpen}
      />
    </div>
  );
}
