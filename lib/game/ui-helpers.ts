import type { GameState } from "@/lib/game/state";
import type { SeatNumber } from "@/lib/game/types";

import { orderedAliveSeats } from "@/lib/game/engine";

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

