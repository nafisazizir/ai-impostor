"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game/state";
import type { GameOutcome, GamePhase } from "@/lib/game/types";

const PHASE_LABEL: Record<GamePhase, string> = {
  setup: "Setup",
  clue: "Clue",
  discussion: "Discussion",
  vote: "Vote",
  elimination: "Elimination",
  finished: "Finished",
};

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

function PhaseLabel({ state }: { state: GameState }) {
  const phase = state.currentPhase;
  const round = state.currentRound;

  if (phase === "finished" && state.outcome) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="rounded-sm bg-green-400/10 px-3 py-1 font-mono text-xs text-green-400">
          {REASON_LABEL[state.outcome.reason]}
        </span>
        <span className="text-2xl font-light ">
          {WINNER_LABEL[state.outcome.winner]}
        </span>
      </div>
    );
  }

  const passSuffix =
    phase === "discussion" && state.discussionPass > 1
      ? ` P${state.discussionPass}`
      : "";

  return (
    <span className={`text-foreground text-2xl font-light`}>
      <span className="font-mono">R{round}</span> · {PHASE_LABEL[phase]}
      {passSuffix}
    </span>
  );
}

type Status = "idle" | "connecting" | "error" | "playing" | "finished" | "between-games";

export function GameHeader({
  state,
  status,
}: {
  state?: GameState;
  status: Status;
}) {
  const [elapsed, setElapsed] = useState(0);
  const prevStatusRef = useRef<Status>(status);

  // Reset timer when entering "connecting"
  useEffect(() => {
    if (status === "connecting" && prevStatusRef.current !== "connecting") {
      setElapsed(0);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Run interval only while connecting or playing
  useEffect(() => {
    if (status !== "connecting" && status !== "playing") return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Fallback for screens that don't pass state (idle, connecting, error)
  if (!state) {
    return (
      <header className="flex flex-col items-center justify-center p-4 tracking-tight">
        <h1 className="text-2xl text-balance">Impostor</h1>
        {status !== "idle" && (
          <span className="text-muted-foreground mt-1 font-mono text-sm tabular-nums">
            {display}
          </span>
        )}
      </header>
    );
  }

  const wordPair = state.wordPair;

  return (
    <header className="flex items-start justify-between p-4">
      {/* Left — Civilian word */}
      <div className="flex flex-col items-start">
        <span className="text-foreground text-xl font-light">
          {wordPair.civilianWord}
        </span>
        <span className="text-muted-foreground/60 font-mono text-xs">
          civilian
        </span>
      </div>

      {/* Center — Round + Phase + Timer */}
      <div className="flex flex-col items-center">
        <PhaseLabel state={state} />
        <span className="text-muted-foreground mt-1 font-mono text-sm tabular-nums">
          {display}
        </span>
      </div>

      {/* Right — Impostor word */}
      <div className="flex flex-col items-end">
        <span className="text-foreground text-xl font-light">
          {wordPair.impostorWord}
        </span>
        <span className="text-muted-foreground/60 font-mono text-xs">
          impostor
        </span>
      </div>
    </header>
  );
}
