"use client";

import { useEffect, useRef, useState } from "react";

import type { MockSnapshot } from "@/lib/game/mock-states";
import type { GameSnapshot } from "@/lib/game/snapshot";
import { deriveActiveSeat } from "@/lib/game/ui-helpers";
import { useGameStream } from "@/hooks/use-game-stream";

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
      isFinished={isFinished}
      onNewGame={restart}
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
    startGame,
  } = useGameStream();

  const snapshot: GameSnapshot | undefined = snapshots[currentIndex];

  if (status === "idle") {
    return <IdleScreen onStart={startGame} />;
  }

  if (status === "connecting" && !snapshot) {
    return <ConnectingScreen />;
  }

  if (status === "error" && !snapshot) {
    return <ErrorScreen error={error} onRetry={startGame} />;
  }

  if (!snapshot) {
    return <ConnectingScreen />;
  }

  const { state, thinking } = snapshot;
  const activeSeat = deriveActiveSeat(state);

  return (
    <SpectatorShell
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      streamingThinking={streamingThinking}
      isFinished={status === "finished"}
      onNewGame={startGame}
    />
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

import type { GameState } from "@/lib/game/state";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type { StreamingThinking } from "@/hooks/use-game-stream";
import { Button } from "@/components/ui/button";

type SpectatorShellProps = {
  state: GameState;
  activeSeat: SeatNumber | null;
  thinking: ThinkingEntry[];
  streamingThinking?: StreamingThinking | null;
  isFinished: boolean;
  onNewGame: () => void;
};

function SpectatorShell({
  state,
  activeSeat,
  thinking,
  streamingThinking,
  isFinished,
  onNewGame,
}: SpectatorShellProps) {
  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left column: header + game area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <GameHeader />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
          <SeatRing state={state} activeSeat={activeSeat} />

          {isFinished && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewGame}
              className="text-muted-foreground cursor-pointer text-xs"
            >
              Watch New Game
            </Button>
          )}
        </div>
      </div>

      <ThinkingPanel
        thinking={thinking}
        streamingThinking={streamingThinking}
      />
    </div>
  );
}

// ─── Status screens ───────────────────────────────────────────────────────────

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <GameHeader />
      <p className="text-muted-foreground text-sm">
        6 AI models. 1 secret word. Who&apos;s the impostor?
      </p>
      <Button
        onClick={onStart}
        className={"hover:bg-primary/80 cursor-pointer"}
        size={"lg"}
      >
        Start Game
      </Button>
    </div>
  );
}

function ConnectingScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <GameHeader />
      <p className="text-muted-foreground animate-pulse text-sm">
        Generating word pair and assigning roles...
      </p>
    </div>
  );
}

function ErrorScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <GameHeader />
      <p className="text-sm text-red-400">{error ?? "Something went wrong"}</p>
      <Button
        onClick={onRetry}
        className={"hover:bg-primary/80 cursor-pointer"}
        size={"lg"}
      >
        Try Again
      </Button>
    </div>
  );
}
