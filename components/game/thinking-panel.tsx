"use client";

import { useEffect, useRef } from "react";

import type { ThinkingEntry } from "@/lib/game/types";
import type { SeatNumber } from "@/lib/game/types";
import type { StreamingThinking } from "@/hooks/use-game-stream";
import { playerName } from "@/lib/game/players";
import { PlayerIcon } from "@/components/icons/player-icons";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  clue: "Clue",
  discussion: "Discussion",
  vote: "Vote",
  elimination: "Elimination",
};

function entryLabel(entry: ThinkingEntry): string {
  const phase = PHASE_LABEL[entry.phase] ?? entry.phase;
  if (entry.pass !== undefined) {
    return `R${entry.round} ${phase} P${entry.pass}`;
  }
  return `R${entry.round} ${phase}`;
}

function streamingEntryLabel(entry: StreamingThinking): string {
  const phase = PHASE_LABEL[entry.phase] ?? entry.phase;
  if (entry.pass !== undefined) {
    return `R${entry.round} ${phase} P${entry.pass}`;
  }
  return `R${entry.round} ${phase}`;
}

function shouldShowHeader(entries: ThinkingEntry[], i: number): boolean {
  if (i === 0) return true;
  const prev = entries[i - 1];
  const curr = entries[i];
  return (
    prev.seat !== curr.seat ||
    prev.phase !== curr.phase ||
    prev.pass !== curr.pass
  );
}

export function ThinkingPanel({
  thinking,
  activeSeat,
  streamingThinking,
}: {
  thinking: ThinkingEntry[];
  activeSeat: SeatNumber | null;
  streamingThinking?: StreamingThinking | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking.length, streamingThinking?.text]);

  const lastEntry = thinking.length > 0 ? thinking[thinking.length - 1] : null;
  const headerSeat =
    streamingThinking?.seat ?? activeSeat ?? lastEntry?.seat ?? null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col",
        // Desktop: right panel
        "md:border-border md:w-80 md:border-l xl:w-96",
        // Mobile: bottom panel
        "border-border h-[25vh] border-t md:h-auto md:max-h-none md:border-t-0",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        {headerSeat ? (
          <>
            <PlayerIcon
              seat={headerSeat}
              className="text-muted-foreground size-4.5"
            />
            <span className="truncate font-mono text-xs">
              {playerName(headerSeat)}
            </span>
            {lastEntry && (
              <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
                {entryLabel(lastEntry)}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground font-mono text-xs">
            Waiting for next move...
          </span>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      >
        <div className="flex flex-col gap-3">
          {thinking.map((entry, i) => {
            return (
              <div
                key={`${entry.seat}-${entry.phase}-${entry.round}-${i}`}
                className="transition-opacity duration-300"
              >
                {/* Entry header — show when speaker, phase, or pass changes */}
                {shouldShowHeader(thinking, i) && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <PlayerIcon
                      seat={entry.seat}
                      className="text-muted-foreground size-3.5"
                    />
                    <span className="text-muted-foreground font-mono text-xs">
                      {playerName(entry.seat)}
                      <span className="text-muted-foreground/60 ml-2">
                        {entryLabel(entry)}
                      </span>
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground/60 font-mono text-xs leading-tight whitespace-pre-wrap">
                  {entry.text}
                </p>
                {entry.actionSummary && (
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    {entry.actionSummary}
                  </p>
                )}
              </div>
            );
          })}

          {/* Live streaming thinking entry */}
          {streamingThinking && (
            <div className="transition-opacity duration-300">
              <div className="mb-1 flex items-center gap-1.5">
                <PlayerIcon
                  seat={streamingThinking.seat}
                  className="text-muted-foreground size-3.5"
                />
                <span className="text-muted-foreground font-mono text-xs">
                  {playerName(streamingThinking.seat)}
                  <span className="text-muted-foreground/60 ml-2">
                    {streamingEntryLabel(streamingThinking)}
                  </span>
                </span>
              </div>
              <p
                className={cn(
                  "text-muted-foreground/60 font-mono text-xs leading-tight whitespace-pre-wrap",
                  streamingThinking.isStreaming,
                )}
              >
                {streamingThinking.text}
              </p>
              {streamingThinking.actionSummary && (
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                  {streamingThinking.actionSummary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
