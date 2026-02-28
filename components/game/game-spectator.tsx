"use client";

import { useCallback, useEffect, useState } from "react";

import type { MockSnapshot } from "@/lib/game/mock-states";
import { deriveActiveSeat } from "@/lib/game/ui-helpers";

import { GameHeader } from "@/components/game/game-header";
import { SeatRing } from "@/components/game/seat-ring";

export function GameSpectator({ snapshots }: { snapshots: MockSnapshot[] }) {
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

  const { state, label } = snapshots[currentIndex];
  const activeSeat = deriveActiveSeat(state);

  const DEV_BUTTON_CLASS =
    "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring rounded px-1.5 py-0.5 text-xs touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-1";

  return (
    <div className="flex h-screen flex-col">
      <GameHeader />

      {/* Seat ring + dev controls */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
        <SeatRing state={state} activeSeat={activeSeat} />

        {/* Dev controls */}
        <div className="border-border bg-card/50 flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <span className="text-muted-foreground text-xs tabular-nums">
            {currentIndex + 1}/{snapshots.length}
          </span>
          <span className="text-muted-foreground text-xs">{label}</span>
          <div className="bg-border mx-1 h-4 w-px" />
          <button
            onClick={prev}
            aria-label="Previous snapshot"
            className={DEV_BUTTON_CLASS}
          >
            Prev
          </button>
          <button
            onClick={next}
            aria-label="Next snapshot"
            className={DEV_BUTTON_CLASS}
          >
            Next
          </button>
          <button
            onClick={() => setAutoReplay((v) => !v)}
            aria-label={autoReplay ? "Pause auto-replay" : "Start auto-replay"}
            className={DEV_BUTTON_CLASS}
          >
            {autoReplay ? "Pause" : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}
