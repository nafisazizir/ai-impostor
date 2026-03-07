"use client";

import type { GameSummary } from "@/lib/game/persisted";
import type { GameOutcome } from "@/lib/game/types";
import {
  formatDuration,
  formatLocalDateTime,
} from "@/lib/history/format";
import { cn } from "@/lib/utils";
import { ROLE_STYLE } from "@/lib/game/ui-helpers";

const WINNER_TO_ROLE: Record<GameOutcome["winner"], keyof typeof ROLE_STYLE> = {
  civilians: "civilian",
  impostor: "impostor",
  mr_white: "mr_white",
};

export function GameSummaryCard({
  summary,
  selected,
  onSelect,
}: {
  summary: GameSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = ROLE_STYLE[WINNER_TO_ROLE[summary.outcome.winner]];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors",
        selected ? "bg-muted/50" : "hover:bg-muted/30",
      )}
    >
      <div className="text-foreground truncate font-mono text-xs lowercase">
        {summary.wordPair.civilianWord}{" "}
        <span className="text-muted-foreground/50">vs</span>{" "}
        {summary.wordPair.impostorWord}
      </div>

      <div className="flex flex-row gap-3">
        <span
          className={cn(
            "w-fit rounded-sm px-2 py-0.5 font-mono text-xs",
            badge.className,
          )}
        >
          {badge.label} won
        </span>
        <span className="text-muted-foreground/60 font-mono text-xs">
          {formatDuration(summary.durationMs)}
        </span>
      </div>

      <span className="text-muted-foreground/60 font-mono text-xs">
        {formatLocalDateTime(summary.finishedAt)}
      </span>
    </button>
  );
}
