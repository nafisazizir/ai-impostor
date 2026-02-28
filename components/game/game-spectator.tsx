"use client";

import { useCallback, useEffect, useState } from "react";

import type { MockSnapshot } from "@/lib/game/mock-states";
import type { GameSnapshot } from "@/lib/game/snapshot";
import { deriveActiveSeat } from "@/lib/game/ui-helpers";
import { useGameStream } from "@/hooks/use-game-stream";

import { GameHeader } from "@/components/game/game-header";
import { SeatRing } from "@/components/game/seat-ring";
import { ThinkingPanel } from "@/components/game/thinking-panel";

type Props =
  | { mode: "mock"; snapshots: MockSnapshot[] }
  | { mode: "live" };

export function GameSpectator(props: Props) {
  if (props.mode === "mock") {
    return <MockSpectator snapshots={props.snapshots} />;
  }
  return <LiveSpectator />;
}

// ─── Mock mode ────────────────────────────────────────────────────────────────

function MockSpectator({ snapshots }: { snapshots: MockSnapshot[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoReplay, setAutoReplay] = useState(false);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % snapshots.length);
  }, [snapshots.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + snapshots.length) % snapshots.length);
  }, [snapshots.length]);

  useEffect(() => {
    if (!autoReplay) return;
    const interval = setInterval(next, 2000);
    return () => clearInterval(interval);
  }, [autoReplay, next]);

  const { state, label, thinking } = snapshots[currentIndex];
  const activeSeat = deriveActiveSeat(state);

  return (
    <SpectatorShell
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      label={label}
      currentIndex={currentIndex}
      totalSnapshots={snapshots.length}
      onPrev={prev}
      onNext={next}
      autoReplay={autoReplay}
      onToggleAutoReplay={() => setAutoReplay((v) => !v)}
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
    autoFollow,
    startGame,
    prev,
    next,
    goToLatest,
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

  const { state, label, thinking } = snapshot;
  const activeSeat = deriveActiveSeat(state);

  return (
    <SpectatorShell
      state={state}
      activeSeat={activeSeat}
      thinking={thinking}
      label={label}
      currentIndex={currentIndex}
      totalSnapshots={snapshots.length}
      onPrev={prev}
      onNext={next}
      status={status}
      error={error}
      autoFollow={autoFollow}
      onJumpToLive={goToLatest}
      onNewGame={startGame}
    />
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

import type { GameState } from "@/lib/game/state";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type { GameStreamStatus } from "@/hooks/use-game-stream";

type SpectatorShellProps = {
  state: GameState;
  activeSeat: SeatNumber | null;
  thinking: ThinkingEntry[];
  label: string;
  currentIndex: number;
  totalSnapshots: number;
  onPrev: () => void;
  onNext: () => void;
  // Mock mode controls
  autoReplay?: boolean;
  onToggleAutoReplay?: () => void;
  // Live mode controls
  status?: GameStreamStatus;
  error?: string | null;
  autoFollow?: boolean;
  onJumpToLive?: () => void;
  onNewGame?: () => void;
};

const DEV_BUTTON_CLASS =
  "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring rounded px-1.5 py-0.5 text-xs touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-1";

function SpectatorShell({
  state,
  activeSeat,
  thinking,
  label,
  currentIndex,
  totalSnapshots,
  onPrev,
  onNext,
  autoReplay,
  onToggleAutoReplay,
  status,
  error,
  autoFollow,
  onJumpToLive,
  onNewGame,
}: SpectatorShellProps) {
  const isLive = status !== undefined;

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left column: header + game area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <GameHeader />

        {/* Seat ring + controls */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
          <SeatRing state={state} activeSeat={activeSeat} />

          {/* Controls bar */}
          <div className="border-border bg-card/50 flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              {currentIndex + 1}/{totalSnapshots}
            </span>
            <span className="text-muted-foreground text-xs">{label}</span>
            <div className="bg-border mx-1 h-4 w-px" />
            <button
              onClick={onPrev}
              aria-label="Previous snapshot"
              className={DEV_BUTTON_CLASS}
            >
              Prev
            </button>
            <button
              onClick={onNext}
              aria-label="Next snapshot"
              className={DEV_BUTTON_CLASS}
            >
              Next
            </button>

            {/* Mock-specific controls */}
            {!isLive && onToggleAutoReplay !== undefined && (
              <button
                onClick={onToggleAutoReplay}
                aria-label={autoReplay ? "Pause auto-replay" : "Start auto-replay"}
                className={DEV_BUTTON_CLASS}
              >
                {autoReplay ? "Pause" : "Play"}
              </button>
            )}

            {/* Live-specific controls */}
            {isLive && (
              <>
                {!autoFollow && onJumpToLive && (
                  <button
                    onClick={onJumpToLive}
                    className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white hover:bg-red-500"
                  >
                    Jump to Live
                  </button>
                )}
                {status === "streaming" && autoFollow && (
                  <span className="text-xs text-red-400">LIVE</span>
                )}
                {status === "finished" && onNewGame && (
                  <button onClick={onNewGame} className={DEV_BUTTON_CLASS}>
                    New Game
                  </button>
                )}
                {status === "error" && (
                  <span className="text-xs text-red-400">
                    Error{error ? `: ${error}` : ""}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ThinkingPanel thinking={thinking} activeSeat={activeSeat} />
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
      <button
        onClick={onStart}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
      >
        Start Game
      </button>
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
      <p className="text-sm text-red-400">
        {error ?? "Something went wrong"}
      </p>
      <button
        onClick={onRetry}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
