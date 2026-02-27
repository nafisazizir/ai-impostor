import type { GameState } from "@/lib/game/state";
import type { SeatNumber, WordPair } from "@/lib/game/types";

import { orderedAliveSeats } from "@/lib/game/engine";

export const DEMO_WORD_PAIR: WordPair = {
  civilianWord: "Ocean",
  impostorWord: "River",
};

export function createDemoClue(state: GameState, seat: SeatNumber): string {
  return `round-${state.currentRound}-seat-${seat}-clue`;
}

export function createDemoDiscussionMessage(state: GameState, seat: SeatNumber): string {
  return `round-${state.currentRound}-pass-${state.discussionPass}-seat-${seat}-discussion`;
}

export function chooseDemoVoteTarget(state: GameState, voterSeat: SeatNumber): SeatNumber {
  const aliveInOrder = orderedAliveSeats(state);
  const mrWhiteSeat = aliveInOrder.find((seat) => state.rolesBySeat[seat] === "mr_white");
  if (mrWhiteSeat) {
    return mrWhiteSeat;
  }

  const impostorSeat = aliveInOrder.find((seat) => state.rolesBySeat[seat] === "impostor");
  if (impostorSeat) {
    return impostorSeat;
  }

  return aliveInOrder.find((seat) => seat !== voterSeat) ?? voterSeat;
}

export function createDemoMrWhiteFinalGuess(): string {
  return "demo-wrong-guess";
}
