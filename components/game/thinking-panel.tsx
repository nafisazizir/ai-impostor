"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

import type { ThinkingEntry } from "@/lib/game/types";
import type { SeatNumber } from "@/lib/game/types";
import { playerLogo, playerName } from "@/lib/game/players";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  clue: "Clue",
  discussion: "Discussion",
  vote: "Vote",
  elimination: "Elimination",
};

export function ThinkingPanel({
  thinking,
  activeSeat,
}: {
  thinking: ThinkingEntry[];
  activeSeat: SeatNumber | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking.length]);

  const lastEntry = thinking.length > 0 ? thinking[thinking.length - 1] : null;
  const headerSeat = activeSeat ?? lastEntry?.seat ?? null;

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
            <Image
              src={playerLogo(headerSeat)}
              alt={playerName(headerSeat)}
              width={18}
              height={18}
              className="size-4.5"
            />
            <span className="truncate font-mono text-xs">
              {playerName(headerSeat)}
            </span>
            {lastEntry && (
              <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase">
                {PHASE_LABEL[lastEntry.phase] ?? lastEntry.phase}
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
        {thinking.length === 0 ? (
          <p className="text-muted-foreground font-mono text-xs">
            Waiting for next move...
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {thinking.map((entry, i) => {
              const isLatest = i === thinking.length - 1;
              return (
                <div
                  key={`${entry.seat}-${entry.phase}-${entry.round}-${i}`}
                  className={cn(
                    "transition-opacity duration-300",
                    !isLatest && "opacity-60",
                  )}
                >
                  {/* Entry header — only show when speaker changes */}
                  {(i === 0 ||
                    thinking[i - 1].seat !== entry.seat ||
                    thinking[i - 1].phase !== entry.phase) && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <Image
                        src={playerLogo(entry.seat)}
                        alt={playerName(entry.seat)}
                        width={14}
                        height={14}
                        className="size-3.5"
                      />
                      <span className="text-muted-foreground font-mono text-xs">
                        {playerName(entry.seat)}
                        <span className="text-muted-foreground/60 ml-2">
                          R{entry.round}{" "}
                          {PHASE_LABEL[entry.phase] ?? entry.phase}
                        </span>
                      </span>
                    </div>
                  )}
                  <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
