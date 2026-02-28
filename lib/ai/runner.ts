import type { GameState } from "@/lib/game/state";
import type { GameSnapshot } from "@/lib/game/snapshot";
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

import { playerName } from "@/lib/game/players";

const MAX_ROUNDS = 10;
const MAX_AI_ATTEMPTS = 3;

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_AI_ATTEMPTS) throw error;
      console.warn(`[${label}] Attempt ${attempt}/${MAX_AI_ATTEMPTS} failed: ${msg}. Retrying...`);
    }
  }
  throw new Error("unreachable");
}

export type GameRunResult = {
  finalState: GameState;
  thinking: ThinkingEntry[];
};

export type RunGameOptions = {
  onSnapshot?: (snapshot: GameSnapshot) => void;
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

export async function runGame(
  gameId: string,
  options?: RunGameOptions,
): Promise<GameRunResult> {
  const thinking: ThinkingEntry[] = [];
  let snapshotIndex = 0;

  function emitSnapshot(label: string, state: GameState, prevLength: number): void {
    options?.onSnapshot?.({
      index: snapshotIndex++,
      label,
      state,
      thinking: [...thinking],
      newThinkingStartIndex: prevLength,
    });
  }

  // 1. Generate word pair from host model
  console.log(`[${gameId}] Generating word pair...`);
  const wordPairResult = await withRetry(() => generateWordPair(), `${gameId} word-pair`);
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

  emitSnapshot("Game started", state, 0);

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
      const prev = thinking.length;
      const result = await withRetry(() => generateClue(state, seat), `${gameId} P${seat} clue`);
      pushThinking(thinking, seat, state, result);
      state = submitClue(state, { seat, text: result.output.clue });
      console.log(`[${gameId}]   Player ${seat}: "${result.output.clue}"`);
      emitSnapshot(`${playerName(seat)} gave clue`, state, prev);
    }

    // --- Discussion phase ---
    for (let pass = 1; pass <= DEFAULT_DISCUSSION_PASSES; pass++) {
      const aliveForDiscussion = orderedAliveSeats(state);
      console.log(`[${gameId}] Discussion pass ${pass} (${aliveForDiscussion.length} players)`);
      for (const seat of aliveForDiscussion) {
        const prev = thinking.length;
        let result: ActionResult<{ message: string }>;
        try {
          result = await withRetry(
            () => generateDiscussionMessage(state, seat),
            `${gameId} P${seat} discussion`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[${gameId}] P${seat} discussion failed after retries: ${msg}`,
          );
          result = {
            output: { message: "I need more time to think about this." },
            reasoning: "(fallback: AI generation failed)",
            actionSummary: `Discussion failed — used fallback`,
          };
        }
        pushThinking(thinking, seat, state, result, pass);
        state = submitDiscussionMessage(state, { seat, text: result.output.message });
        console.log(`[${gameId}]   Player ${seat}: "${result.output.message}"`);
        emitSnapshot(`${playerName(seat)} discussed`, state, prev);
      }
    }

    // --- Vote phase ---
    const aliveForVotes = orderedAliveSeats(state);
    console.log(`[${gameId}] Vote phase (${aliveForVotes.length} players)`);
    for (const seat of aliveForVotes) {
      const prev = thinking.length;
      const result = await withRetry(() => generateVote(state, seat), `${gameId} P${seat} vote`);
      pushThinking(thinking, seat, state, result);
      state = submitVote(state, {
        voterSeat: seat,
        targetSeat: result.output.targetPlayer as SeatNumber,
      });
      console.log(`[${gameId}]   Player ${seat} voted for Player ${result.output.targetPlayer}`);
      emitSnapshot(`${playerName(seat)} voted`, state, prev);
    }

    // --- Elimination phase ---
    console.log(`[${gameId}] Resolving round...`);
    const resolved = resolveRound(state);
    state = resolved.state;

    if (resolved.result.eliminatedSeat === null) {
      console.log(`[${gameId}] Tie — no elimination. Advancing to next round.`);
      emitSnapshot("Tie — no elimination", state, thinking.length);
      continue;
    }

    const eliminatedSeat = resolved.result.eliminatedSeat;
    const eliminatedRole = state.rolesBySeat[eliminatedSeat];
    state = applyElimination(state, resolved.result);
    console.log(
      `[${gameId}] Eliminated: Player ${eliminatedSeat} (${eliminatedRole})`,
    );
    emitSnapshot(`${playerName(eliminatedSeat)} eliminated`, state, thinking.length);

    // --- Mr. White guess (if applicable) ---
    if (eliminatedRole === "mr_white" && state.currentPhase === "elimination") {
      console.log(`[${gameId}] Mr. White gets a final guess...`);
      const prev = thinking.length;
      const guessResult = await withRetry(() => generateMrWhiteGuess(state, eliminatedSeat), `${gameId} P${eliminatedSeat} mr-white-guess`);
      pushThinking(thinking, eliminatedSeat, state, guessResult);
      state = resolveMrWhiteGuess(state, guessResult.output.guess);
      console.log(
        `[${gameId}] Mr. White guessed: "${guessResult.output.guess}" — ${state.outcome?.winner === "mr_white" ? "CORRECT!" : "WRONG"}`,
      );
      emitSnapshot(`Mr. White guessed: "${guessResult.output.guess}"`, state, prev);
    }

    if (state.currentPhase === "finished") {
      break;
    }
  }

  if (state.currentPhase !== "finished") {
    console.warn(`[${gameId}] Game did not finish within ${MAX_ROUNDS} rounds.`);
  }

  console.log(`[${gameId}] Game finished. Outcome: ${JSON.stringify(state.outcome)}`);
  emitSnapshot("Game over", state, thinking.length);
  return { finalState: state, thinking };
}
