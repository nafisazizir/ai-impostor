import type { GameState } from "@/lib/game/state";
import type { GameOutcome, GamePhase, Role, SeatNumber } from "@/lib/game/types";

import { orderedAliveSeats } from "@/lib/game/engine";

export const PHASE_LABEL: Record<GamePhase, string> = {
  setup: "Setup",
  clue: "Clue",
  discussion: "Discussion",
  vote: "Vote",
  elimination: "Elimination",
  finished: "Finished",
};

export const WINNER_LABEL: Record<GameOutcome["winner"], string> = {
  civilians: "Civilians Win",
  impostor: "Impostor Wins",
  mr_white: "Mr. White Wins",
};

export const REASON_LABEL: Record<GameOutcome["reason"], string> = {
  both_special_roles_eliminated: "special roles eliminated",
  reached_final_two: "reached final two",
  final_guess_correct: "correctly guessed the word",
};

export const ROLE_STYLE: Record<Role, { label: string; className: string }> = {
  civilian: { label: "civilian", className: "text-blue-400 bg-blue-400/10" },
  impostor: { label: "impostor", className: "text-red-400 bg-red-400/10" },
  mr_white: { label: "mr white", className: "text-white/70 bg-white/5" },
};

export function deriveActiveSeat(state: GameState): SeatNumber | null {
  const alive = orderedAliveSeats(state);

  switch (state.currentPhase) {
    case "clue": {
      const clues = state.cluesByRound[state.currentRound] ?? [];
      return alive[clues.length] ?? null;
    }
    case "discussion": {
      const messages = state.discussionByRound[state.currentRound] ?? [];
      const passMessages = messages.filter((m) => m.pass === state.discussionPass);
      return alive[passMessages.length] ?? null;
    }
    case "vote": {
      const votes = state.votesByRound[state.currentRound] ?? [];
      return alive[votes.length] ?? null;
    }
    default:
      return null;
  }
}

export function deriveSeatAction(
  state: GameState,
  seat: SeatNumber,
): { text: string; hasActed: boolean } | null {
  const alive = orderedAliveSeats(state);
  if (!alive.includes(seat)) return null;

  const clues = state.cluesByRound[state.currentRound] ?? [];
  const clue = clues.find((c) => c.seat === seat);

  // hasActed tracks whether the player has acted in the *current* phase
  let hasActed = false;
  switch (state.currentPhase) {
    case "clue":
      hasActed = !!clue;
      break;
    case "discussion": {
      const messages = state.discussionByRound[state.currentRound] ?? [];
      const passMessages = messages.filter((m) => m.pass === state.discussionPass);
      hasActed = passMessages.some((m) => m.seat === seat);
      break;
    }
    case "vote": {
      const votes = state.votesByRound[state.currentRound] ?? [];
      hasActed = votes.some((v) => v.voterSeat === seat);
      break;
    }
  }

  // Always show the clue text (not discussion/vote text)
  if (!clue) return null;
  return { text: `"${clue.text}"`, hasActed };
}

export function deriveVoteCounts(
  state: GameState,
): Partial<Record<SeatNumber, number>> | null {
  if (state.currentPhase !== "vote") return null;

  const votes = state.votesByRound[state.currentRound] ?? [];
  if (votes.length === 0) return null;

  const counts: Partial<Record<SeatNumber, number>> = {};
  for (const vote of votes) {
    counts[vote.targetSeat] = (counts[vote.targetSeat] ?? 0) + 1;
  }
  return counts;
}

