import { RetryableError, getStepMetadata } from "workflow";

import type { GameState } from "@/lib/game/state";
import type { SeatNumber, WordPair } from "@/lib/game/types";
import {
  DEMO_WORD_PAIR,
  chooseDemoVoteTarget,
  createDemoClue,
  createDemoDiscussionMessage,
  createDemoMrWhiteFinalGuess,
} from "@/lib/game/demo-policy";

export async function hostGenerateWordPairStep(): Promise<WordPair> {
  "use step";

  return DEMO_WORD_PAIR;
}

export async function seatGenerateClueStep(state: GameState, seat: SeatNumber): Promise<string> {
  "use step";

  const metadata = getStepMetadata();
  const firstSeat = state.seatOrder[0];
  if (state.currentRound === 1 && seat === firstSeat && metadata.attempt === 0) {
    throw new RetryableError("Simulated transient clue generation failure.", {
      retryAfter: "50ms",
    });
  }

  return createDemoClue(state, seat);
}
seatGenerateClueStep.maxRetries = 2;

export async function seatGenerateDiscussionStep(state: GameState, seat: SeatNumber): Promise<string> {
  "use step";

  return createDemoDiscussionMessage(state, seat);
}

export async function seatGenerateVoteStep(state: GameState, voterSeat: SeatNumber): Promise<SeatNumber> {
  "use step";

  return chooseDemoVoteTarget(state, voterSeat);
}

export async function mrWhiteFinalGuessStep(): Promise<string> {
  "use step";

  return createDemoMrWhiteFinalGuess();
}
