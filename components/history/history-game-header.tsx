"use client";

import type { GameSummary } from "@/lib/game/persisted";
import type { GameOutcome } from "@/lib/game/types";
import { formatDuration } from "@/lib/history/format";

const WINNER_LABEL: Record<string, string> = {
  civilians: "Civilians Win",
  impostor: "Impostor Wins",
  mr_white: "Mr. White Wins",
};

const REASON_LABEL: Record<GameOutcome["reason"], string> = {
  both_special_roles_eliminated: "special roles eliminated",
  reached_final_two: "reached final two",
  final_guess_correct: "correctly guessed the word",
};

export function HistoryGameHeader({ summary }: { summary: GameSummary }) {
  return (
    <header className="flex items-start justify-between p-4">
      {/* Left - Civilian word */}
      <div className="flex flex-col items-start">
        <span className="text-foreground text-xl font-light">
          {summary.wordPair.civilianWord}
        </span>
        <span className="text-muted-foreground/60 font-mono text-xs">
          civilian
        </span>
      </div>

      {/* Center - Outcome */}
      <div className="flex flex-col items-center gap-1">
        <span className="rounded-sm bg-green-400/10 px-3 py-1 font-mono text-xs text-green-400">
          {REASON_LABEL[summary.outcome.reason]}
        </span>
        <span className="text-2xl font-light">
          {WINNER_LABEL[summary.outcome.winner]}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {summary.roundCount}R · {formatDuration(summary.durationMs)}
        </span>
      </div>

      {/* Right - Impostor word */}
      <div className="flex flex-col items-end">
        <span className="text-foreground text-xl font-light">
          {summary.wordPair.impostorWord}
        </span>
        <span className="text-muted-foreground/60 font-mono text-xs">
          impostor
        </span>
      </div>
    </header>
  );
}
