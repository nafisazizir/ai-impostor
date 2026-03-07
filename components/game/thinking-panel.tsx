"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";

import type { GamePhase, ThinkingEntry } from "@/lib/game/types";
import type {
  StreamingThinking,
  StreamingAnswer,
} from "@/hooks/use-game-stream";
import { playerLogo, playerName } from "@/lib/game/players";
import { cn } from "@/lib/utils";
import { PHASE_LABEL } from "@/lib/game/ui-helpers";
import { MarkdownProse } from "@/components/ui/markdown-prose";

const ANSWER_PREFIX: Record<string, string> = {
  clue: 'Gave clue: "',
  discussion: 'Said: "',
  mr_white_guess: 'Guessed: "',
};

function phaseLabel(entry: { phase: GamePhase; round: number; pass?: number }): string {
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
  streamingThinking,
  streamingAnswer,
  open = true,
}: {
  thinking: ThinkingEntry[];
  streamingThinking?: StreamingThinking | null;
  streamingAnswer?: StreamingAnswer | null;
  open?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledDown, setScrolledDown] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrolledDown(el.scrollTop > 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking.length, streamingThinking?.text, streamingAnswer?.text]);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out",
        open
          ? "md:w-80 xl:w-96 h-[25vh] md:h-auto"
          : "md:w-0 h-0 md:h-auto",
        open && "md:border-border md:border-l",
        open && "border-border border-t md:border-t-0",
      )}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="log"
          aria-label="AI thinking log"
          className="scrollbar-hide h-full overflow-y-auto px-3 pt-3 pb-3"
        >
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground/40 font-mono text-xs">
              Game started
            </p>
            {thinking.map((entry, i) => {
              const showHeader = shouldShowHeader(thinking, i);
              return (
                <div
                  key={`${entry.seat}-${entry.phase}-${entry.round}-${i}`}
                  className="transition-opacity duration-300"
                >
                  {showHeader && (
                    <div className="mb-1 flex items-center gap-1.5">
                      {createElement(playerLogo(entry.seat), { className: "text-muted-foreground size-3.5" })}
                      <span className="text-muted-foreground font-mono text-xs">
                        {playerName(entry.seat)}
                        <span className="text-muted-foreground/60 ml-2">
                          {phaseLabel(entry)}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="text-muted-foreground/60 font-mono text-xs leading-tight">
                    <MarkdownProse content={entry.text} />
                  </div>
                  {entry.actionSummary && (
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {entry.actionSummary}
                    </p>
                  )}
                </div>
              );
            })}

            {streamingThinking && <StreamingEntry thinking={streamingThinking} answer={streamingAnswer} />}
          </div>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute top-0 right-0 left-0 z-10 h-8 bg-linear-to-b from-black to-transparent",
            scrolledDown ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}

function StreamingEntry({
  thinking,
  answer,
}: {
  thinking: StreamingThinking;
  answer?: StreamingAnswer | null;
}) {
  return (
    <div className="transition-opacity duration-300">
      <div className="mb-1 flex items-center gap-1.5">
        {createElement(playerLogo(thinking.seat), { className: "text-muted-foreground size-3.5" })}
        <span className="font-mono text-xs">
          <span
            className={cn(
              thinking.isStreaming
                ? "animate-thinking"
                : "text-muted-foreground",
            )}
          >
            {playerName(thinking.seat)}
          </span>
          <span className="text-muted-foreground/60 ml-2">
            {phaseLabel(thinking)}
          </span>
        </span>
      </div>
      <div className="text-muted-foreground/60 font-mono text-xs leading-tight">
        <MarkdownProse content={thinking.text} />
      </div>
      {answer?.text ? (
        <p className="text-muted-foreground mt-0.5 font-mono text-xs leading-tight whitespace-pre-wrap">
          {ANSWER_PREFIX[answer.kind]}
          {answer.text}
          {!answer.isStreaming && '"'}
        </p>
      ) : (
        thinking.actionSummary && (
          <p className="text-muted-foreground mt-0.5 font-mono text-xs">
            {thinking.actionSummary}
          </p>
        )
      )}
    </div>
  );
}
