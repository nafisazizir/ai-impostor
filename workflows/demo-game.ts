import {
  applyElimination,
  createInitialGameState,
  resolveMrWhiteGuess,
  resolveRound,
  submitClue,
  submitDiscussionMessage,
  submitVote,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/state";
import type { GameOutcome } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";
import {
  hostGenerateWordPairStep,
  mrWhiteFinalGuessStep,
  seatGenerateClueStep,
  seatGenerateDiscussionStep,
  seatGenerateVoteStep,
} from "@/workflows/demo-game-steps";

const DEFAULT_MAX_DISCUSSION_PASSES = 2;
const DEFAULT_MAX_ROUNDS = 10;

export type DemoGameWorkflowInput = {
  gameId: string;
  maxDiscussionPasses?: number;
  maxRounds?: number;
};

export type DemoGameWorkflowResult = {
  gameId: string;
  outcome: GameOutcome;
  totalEvents: number;
  totalRounds: number;
  finalState: GameState;
};

export async function runDemoGameWorkflow(
  input: DemoGameWorkflowInput,
): Promise<DemoGameWorkflowResult> {
  "use workflow";

  const maxDiscussionPasses = input.maxDiscussionPasses ?? DEFAULT_MAX_DISCUSSION_PASSES;
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const wordPair = await hostGenerateWordPairStep();
  let state = createInitialGameState({
    gameId: input.gameId,
    wordPair,
  });

  while (state.currentPhase !== "finished") {
    if (state.currentRound > maxRounds) {
      throw new Error(`Demo workflow exceeded maxRounds=${maxRounds} without a terminal outcome.`);
    }

    if (state.currentPhase === "clue") {
      for (const seat of orderedAliveSeats(state)) {
        const clue = await seatGenerateClueStep(state, seat);
        state = submitClue(state, { seat, text: clue });
      }
      continue;
    }

    if (state.currentPhase === "discussion") {
      for (const seat of orderedAliveSeats(state)) {
        const message = await seatGenerateDiscussionStep(state, seat);
        state = submitDiscussionMessage(state, { seat, text: message }, maxDiscussionPasses);
      }
      continue;
    }

    if (state.currentPhase === "vote") {
      for (const voterSeat of orderedAliveSeats(state)) {
        const targetSeat = await seatGenerateVoteStep(state, voterSeat);
        state = submitVote(state, { voterSeat, targetSeat });
      }
      continue;
    }

    if (state.currentPhase === "elimination") {
      const resolved = resolveRound(state);
      state = resolved.state;

      if (resolved.result.eliminatedSeat !== null) {
        state = applyElimination(state, resolved.result);

        if (state.currentPhase === "elimination" && state.outcome === null) {
          const guess = await mrWhiteFinalGuessStep();
          state = resolveMrWhiteGuess(state, guess);
        }
      }
      continue;
    }
  }

  if (!state.outcome) {
    throw new Error("Demo workflow reached finished phase without an outcome.");
  }

  return {
    gameId: state.gameId,
    outcome: state.outcome,
    totalEvents: state.events.length,
    totalRounds: state.currentRound,
    finalState: state,
  };
}
