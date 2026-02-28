import type { GameState } from "@/lib/game/state";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import {
  createInitialGameState,
  orderedAliveSeats,
  submitClue,
  submitDiscussionMessage,
  submitVote,
  resolveRound,
  applyElimination,
  resolveMrWhiteGuess,
  DEFAULT_DISCUSSION_PASSES,
} from "@/lib/game/engine";

import {
  generateWordPair,
  generateClue,
  generateDiscussionMessage,
  generateVote,
  generateMrWhiteGuess,
  type ActionResult,
} from "@/lib/ai/actions";

const MAX_ROUNDS = 10;

export type GameRunResult = {
  finalState: GameState;
  thinking: ThinkingEntry[];
};

function pushThinking(
  thinking: ThinkingEntry[],
  seat: SeatNumber,
  state: GameState,
  result: ActionResult<unknown>,
  pass?: number,
): void {
  const entry: ThinkingEntry = {
    seat,
    phase: state.currentPhase,
    round: state.currentRound,
    at: new Date().toISOString(),
    text: result.reasoning,
    actionSummary: result.actionSummary,
  };
  if (pass !== undefined) entry.pass = pass;
  thinking.push(entry);
}

export async function runGame(gameId: string): Promise<GameRunResult> {
  const thinking: ThinkingEntry[] = [];

  // 1. Generate word pair from host model
  console.log(`[${gameId}] Generating word pair...`);
  const wordPairResult = await generateWordPair();
  console.log(
    `[${gameId}] Word pair: "${wordPairResult.output.civilianWord}" / "${wordPairResult.output.impostorWord}"`,
  );

  // 2. Create initial game state
  let state = createInitialGameState({
    gameId,
    wordPair: wordPairResult.output,
  });

  console.log(`[${gameId}] Seat order: ${state.seatOrder.join(", ")}`);
  console.log(
    `[${gameId}] Roles: ${state.seatOrder.map((s) => `${s}=${state.rolesBySeat[s]}`).join(", ")}`,
  );

  // 3. Game loop
  let roundCount = 0;
  while (state.currentPhase !== "finished" && roundCount < MAX_ROUNDS) {
    roundCount++;
    const round = state.currentRound;
    console.log(`[${gameId}] === Round ${round} ===`);

    // --- Clue phase ---
    const aliveForClues = orderedAliveSeats(state);
    console.log(`[${gameId}] Clue phase (${aliveForClues.length} players)`);
    for (const seat of aliveForClues) {
      const result = await generateClue(state, seat);
      pushThinking(thinking, seat, state, result);
      state = submitClue(state, { seat, text: result.output.clue });
      console.log(`[${gameId}]   Player ${seat}: "${result.output.clue}"`);
    }

    // --- Discussion phase ---
    for (let pass = 1; pass <= DEFAULT_DISCUSSION_PASSES; pass++) {
      const aliveForDiscussion = orderedAliveSeats(state);
      console.log(`[${gameId}] Discussion pass ${pass} (${aliveForDiscussion.length} players)`);
      for (const seat of aliveForDiscussion) {
        const result = await generateDiscussionMessage(state, seat);
        pushThinking(thinking, seat, state, result, pass);
        state = submitDiscussionMessage(state, { seat, text: result.output.message });
        console.log(`[${gameId}]   Player ${seat}: "${result.output.message}"`);
      }
    }

    // --- Vote phase ---
    const aliveForVotes = orderedAliveSeats(state);
    console.log(`[${gameId}] Vote phase (${aliveForVotes.length} players)`);
    for (const seat of aliveForVotes) {
      const result = await generateVote(state, seat);
      pushThinking(thinking, seat, state, result);
      state = submitVote(state, {
        voterSeat: seat,
        targetSeat: result.output.targetPlayer as SeatNumber,
      });
      console.log(`[${gameId}]   Player ${seat} voted for Player ${result.output.targetPlayer}`);
    }

    // --- Elimination phase ---
    console.log(`[${gameId}] Resolving round...`);
    const resolved = resolveRound(state);
    state = resolved.state;

    if (resolved.result.eliminatedSeat === null) {
      console.log(`[${gameId}] Tie — no elimination. Advancing to next round.`);
      continue;
    }

    const eliminatedSeat = resolved.result.eliminatedSeat;
    const eliminatedRole = state.rolesBySeat[eliminatedSeat];
    state = applyElimination(state, resolved.result);
    console.log(
      `[${gameId}] Eliminated: Player ${eliminatedSeat} (${eliminatedRole})`,
    );

    // --- Mr. White guess (if applicable) ---
    if (eliminatedRole === "mr_white" && state.currentPhase === "elimination") {
      console.log(`[${gameId}] Mr. White gets a final guess...`);
      const guessResult = await generateMrWhiteGuess(state, eliminatedSeat);
      pushThinking(thinking, eliminatedSeat, state, guessResult);
      state = resolveMrWhiteGuess(state, guessResult.output.guess);
      console.log(
        `[${gameId}] Mr. White guessed: "${guessResult.output.guess}" — ${state.outcome?.winner === "mr_white" ? "CORRECT!" : "WRONG"}`,
      );
    }

    if (state.currentPhase === "finished") {
      break;
    }
  }

  if (state.currentPhase !== "finished") {
    console.warn(`[${gameId}] Game did not finish within ${MAX_ROUNDS} rounds.`);
  }

  console.log(`[${gameId}] Game finished. Outcome: ${JSON.stringify(state.outcome)}`);
  return { finalState: state, thinking };
}
