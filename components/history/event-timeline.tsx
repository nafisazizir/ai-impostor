"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";

import type { GameEvent } from "@/lib/game/state";
import type { SeatNumber } from "@/lib/game/types";
import { playerLogo, playerName } from "@/lib/game/players";
import { cn } from "@/lib/utils";
import { WINNER_LABEL } from "@/lib/game/ui-helpers";

function PlayerTag({ seat }: { seat: SeatNumber }) {
  return (
    <span className="inline-flex items-center gap-1">
      {createElement(playerLogo(seat), { className: "text-muted-foreground inline size-3" })}
      <span className="text-foreground font-medium">{playerName(seat)}</span>
    </span>
  );
}

function EventLine({ event }: { event: GameEvent }) {
  switch (event.type) {
    case "game_started":
      return (
        <span className="text-muted-foreground/60 italic">
          Game started
        </span>
      );
    case "clue_submitted":
      return (
        <span>
          <PlayerTag seat={event.clue.seat} />{" "}
          <span className="text-muted-foreground">gave clue:</span>{" "}
          <span className="text-foreground">&ldquo;{event.clue.text}&rdquo;</span>
        </span>
      );
    case "discussion_message":
      return (
        <span>
          <PlayerTag seat={event.message.seat} />{" "}
          <span className="text-muted-foreground">said:</span>{" "}
          <span className="text-foreground">&ldquo;{event.message.text}&rdquo;</span>
        </span>
      );
    case "vote_cast":
      return (
        <span>
          <PlayerTag seat={event.vote.voterSeat} />{" "}
          <span className="text-muted-foreground">voted for</span>{" "}
          <PlayerTag seat={event.vote.targetSeat} />
        </span>
      );
    case "round_resolved":
      if (event.elimination.eliminatedSeat === null) {
        return (
          <span className="text-muted-foreground/60 italic">
            Vote tied — no elimination
          </span>
        );
      }
      return null;
    case "player_eliminated":
      return (
        <span>
          <PlayerTag seat={event.eliminatedSeat} />{" "}
          <span className="text-muted-foreground">eliminated</span>{" "}
          <span className="text-muted-foreground/60">({event.revealedRole})</span>
        </span>
      );
    case "mr_white_guess_made":
      return (
        <span>
          <PlayerTag seat={event.seat} />{" "}
          <span className="text-muted-foreground">guessed:</span>{" "}
          <span className="text-foreground">&ldquo;{event.guess}&rdquo;</span>
          {" — "}
          <span className={event.wasCorrect ? "text-green-400" : "text-red-400"}>
            {event.wasCorrect ? "Correct!" : "Wrong"}
          </span>
        </span>
      );
    case "game_finished":
      return (
        <span className="text-foreground font-medium">
          {WINNER_LABEL[event.outcome.winner]}
        </span>
      );
  }
}

function groupEventsByRound(events: GameEvent[]): Map<number, GameEvent[]> {
  const groups = new Map<number, GameEvent[]>();
  for (const event of events) {
    const round = event.round;
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round)!.push(event);
  }
  return groups;
}

export function EventTimeline({ events }: { events: GameEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledDown, setScrolledDown] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrolledDown(el.scrollTop > 4);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events]);

  const grouped = groupEventsByRound(events);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="log"
        aria-label="Game event timeline"
        className="scrollbar-hide h-full overflow-y-auto px-6 pb-6"
      >
        {Array.from(grouped.entries()).map(([round, roundEvents]) => (
          <div key={round} className="mb-4">
            {round > 0 && (
              <div className="border-border mb-3 border-b pb-1">
                <span className="text-muted-foreground/60 font-mono text-xs">
                  Round {round}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {roundEvents.map((event, i) => {
                const line = <EventLine event={event} />;
                if (line === null) return null;
                return (
                  <div key={i} className="font-mono text-xs leading-relaxed">
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-0 right-0 left-0 z-10 h-8 bg-linear-to-b from-black to-transparent",
          scrolledDown ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
