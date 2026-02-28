import type { GameEvent, GameState } from "@/lib/game/state";
import type { SeatNumber } from "@/lib/game/types";

import { orderedAliveSeats } from "@/lib/game/engine";
import { playerName } from "@/lib/game/players";

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

export function formatEventSummary(event: GameEvent): string {
  switch (event.type) {
    case "game_started":
      return "Game started";
    case "clue_submitted":
      return `${playerName(event.clue.seat)} gave clue: "${event.clue.text}"`;
    case "discussion_message":
      return `${playerName(event.message.seat)}: "${event.message.text}"`;
    case "vote_cast":
      return `${playerName(event.vote.voterSeat)} voted for ${playerName(event.vote.targetSeat)}`;
    case "round_resolved":
      return event.elimination.eliminatedSeat
        ? `Round resolved — ${playerName(event.elimination.eliminatedSeat)} eliminated`
        : "Round resolved — Tie, no elimination";
    case "player_eliminated":
      return `${playerName(event.eliminatedSeat)} eliminated (${event.revealedRole === "mr_white" ? "Mr. White" : event.revealedRole})`;
    case "mr_white_guess_made":
      return event.wasCorrect
        ? `Mr. White guessed "${event.guess}" — Correct!`
        : `Mr. White guessed "${event.guess}" — Wrong!`;
    case "game_finished":
      return `Game over — ${event.outcome.winner === "mr_white" ? "Mr. White" : event.outcome.winner} win!`;
  }
}
