import type { GameState } from "@/lib/game/state";
import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, GamePhase, ThinkingEntry } from "@/lib/game/types";
import {
  createInitialGameState,
  orderedAliveSeats,
  submitClue,
  submitDiscussionMessage,
  submitVote,
  resolveRound,
  applyElimination,
  resolveMrWhiteGuess,
} from "@/lib/game/engine";
import { getEnv } from "@/lib/config/env";

import {
  streamWordPair,
  streamClue,
  streamDiscussionMessage,
  streamVote,
  streamMrWhiteGuess,
} from "@/lib/ai/actions";
import type { ActionResult } from "@/lib/ai/actions";

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
      console.warn(
        `[${label}] Attempt ${attempt}/${MAX_AI_ATTEMPTS} failed: ${msg}. Retrying...`,
      );
    }
  }
  throw new Error("unreachable");
}

export type RunGameOptions = {
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onThinkingStart?: (data: {
    seat: SeatNumber;
    phase: GamePhase;
    round: number;
    pass?: number;
  }) => void;
  onThinkingDelta?: (text: string) => void;
  onThinkingEnd?: (actionSummary: string) => void;
  onAnswerStart?: (data: {
    seat: SeatNumber;
    kind: "clue" | "discussion" | "mr_white_guess";
  }) => void;
  onAnswerDelta?: (text: string) => void;
  onAnswerEnd?: () => void;
};

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

export async function runGame(
  gameId: string,
  options?: RunGameOptions,
): Promise<GameRunResult> {
  const { WORKFLOW_MAX_DISCUSSION_PASSES: maxDiscussionPasses } = getEnv();
  const thinking: ThinkingEntry[] = [];
  let snapshotIndex = 0;

  function emitSnapshot(
    label: string,
    state: GameState,
    prevLength: number,
  ): void {
    options?.onSnapshot?.({
      index: snapshotIndex++,
      label,
      state,
      thinking: [...thinking],
      newThinkingStartIndex: prevLength,
    });
  }

  function emitThinkingStart(
    seat: SeatNumber,
    state: GameState,
    pass?: number,
  ): void {
    options?.onThinkingStart?.({
      seat,
      phase: state.currentPhase,
      round: state.currentRound,
      pass,
    });
  }

  function emitThinkingDelta(text: string): void {
    options?.onThinkingDelta?.(text);
  }

  function emitThinkingEnd(actionSummary: string): void {
    options?.onThinkingEnd?.(actionSummary);
  }

  function emitAnswerStart(
    seat: SeatNumber,
    kind: "clue" | "discussion" | "mr_white_guess",
  ): void {
    options?.onAnswerStart?.({ seat, kind });
  }

  function emitAnswerDelta(text: string): void {
    options?.onAnswerDelta?.(text);
  }

  function emitAnswerEnd(): void {
    options?.onAnswerEnd?.();
  }

  // 1. Generate word pair from host model
  console.log(`[${gameId}] Generating word pair...`);
  const wordPairResult = await withRetry(
    () => streamWordPair((delta) => emitThinkingDelta(delta)),
    `${gameId} word-pair`,
  );
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
      emitThinkingStart(seat, state);
      const result = await withRetry(
        () => {
          emitAnswerStart(seat, "clue");
          return streamClue(
            state,
            seat,
            (delta) => emitThinkingDelta(delta),
            (delta) => emitAnswerDelta(delta),
          );
        },
        `${gameId} P${seat} clue`,
      );
      emitAnswerEnd();
      emitThinkingEnd(result.actionSummary);
      pushThinking(thinking, seat, state, result);
      state = submitClue(state, { seat, text: result.output.clue });
      console.log(`[${gameId}]   Player ${seat}: "${result.output.clue}"`);
      emitSnapshot(`${playerName(seat)} gave clue`, state, prev);
    }

    // --- Discussion phase ---
    for (let pass = 1; pass <= maxDiscussionPasses; pass++) {
      const aliveForDiscussion = orderedAliveSeats(state);
      console.log(
        `[${gameId}] Discussion pass ${pass} (${aliveForDiscussion.length} players)`,
      );
      for (const seat of aliveForDiscussion) {
        const prev = thinking.length;
        let result: ActionResult<{ message: string }>;
        emitThinkingStart(seat, state, pass);
        try {
          result = await withRetry(
            () => {
              emitAnswerStart(seat, "discussion");
              return streamDiscussionMessage(
                state,
                seat,
                (delta) => emitThinkingDelta(delta),
                (delta) => emitAnswerDelta(delta),
              );
            },
            `${gameId} P${seat} discussion`,
          );
          emitAnswerEnd();
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[${gameId}] P${seat} discussion failed after retries: ${msg}`,
          );
          const fallbackText = "I need more time to think about this.";
          emitAnswerStart(seat, "discussion");
          for (const ch of fallbackText) {
            emitAnswerDelta(ch);
          }
          emitAnswerEnd();
          result = {
            output: { message: fallbackText },
            reasoning: "(fallback: AI generation failed)",
            actionSummary: `Discussion failed — used fallback`,
          };
        }
        emitThinkingEnd(result.actionSummary);
        pushThinking(thinking, seat, state, result, pass);
        state = submitDiscussionMessage(
          state,
          { seat, text: result.output.message },
          maxDiscussionPasses,
        );
        console.log(
          `[${gameId}]   Player ${seat}: "${result.output.message}"`,
        );
        emitSnapshot(`${playerName(seat)} discussed`, state, prev);
      }
    }

    // --- Vote phase ---
    const aliveForVotes = orderedAliveSeats(state);
    console.log(`[${gameId}] Vote phase (${aliveForVotes.length} players)`);
    for (const seat of aliveForVotes) {
      const prev = thinking.length;
      emitThinkingStart(seat, state);
      const result = await withRetry(
        () =>
          streamVote(state, seat, (delta) => emitThinkingDelta(delta)),
        `${gameId} P${seat} vote`,
      );
      emitThinkingEnd(result.actionSummary);
      pushThinking(thinking, seat, state, result);
      state = submitVote(state, {
        voterSeat: seat,
        targetSeat: result.output.targetPlayer as SeatNumber,
      });
      console.log(
        `[${gameId}]   Player ${seat} voted for Player ${result.output.targetPlayer}`,
      );
      emitSnapshot(`${playerName(seat)} voted`, state, prev);
    }

    // --- Elimination phase ---
    console.log(`[${gameId}] Resolving round...`);
    const resolved = resolveRound(state);
    state = resolved.state;

    if (resolved.result.eliminatedSeat === null) {
      console.log(
        `[${gameId}] Tie — no elimination. Advancing to next round.`,
      );
      emitSnapshot("Tie — no elimination", state, thinking.length);
      continue;
    }

    const eliminatedSeat = resolved.result.eliminatedSeat;
    const eliminatedRole = state.rolesBySeat[eliminatedSeat];
    state = applyElimination(state, resolved.result);
    console.log(
      `[${gameId}] Eliminated: Player ${eliminatedSeat} (${eliminatedRole})`,
    );
    emitSnapshot(
      `${playerName(eliminatedSeat)} eliminated`,
      state,
      thinking.length,
    );

    // --- Mr. White guess (if applicable) ---
    if (
      eliminatedRole === "mr_white" &&
      state.currentPhase === "elimination"
    ) {
      console.log(`[${gameId}] Mr. White gets a final guess...`);
      const prev = thinking.length;
      emitThinkingStart(eliminatedSeat, state);
      const guessResult = await withRetry(
        () => {
          emitAnswerStart(eliminatedSeat, "mr_white_guess");
          return streamMrWhiteGuess(
            state,
            eliminatedSeat,
            (delta) => emitThinkingDelta(delta),
            (delta) => emitAnswerDelta(delta),
          );
        },
        `${gameId} P${eliminatedSeat} mr-white-guess`,
      );
      emitAnswerEnd();
      emitThinkingEnd(guessResult.actionSummary);
      pushThinking(thinking, eliminatedSeat, state, guessResult);
      state = resolveMrWhiteGuess(state, guessResult.output.guess);
      console.log(
        `[${gameId}] Mr. White guessed: "${guessResult.output.guess}" — ${state.outcome?.winner === "mr_white" ? "CORRECT!" : "WRONG"}`,
      );
      emitSnapshot(
        `Mr. White guessed: "${guessResult.output.guess}"`,
        state,
        prev,
      );
    }

    if (state.currentPhase === "finished") {
      break;
    }
  }

  if (state.currentPhase !== "finished") {
    console.warn(
      `[${gameId}] Game did not finish within ${MAX_ROUNDS} rounds.`,
    );
  }

  console.log(
    `[${gameId}] Game finished. Outcome: ${JSON.stringify(state.outcome)}`,
  );
  emitSnapshot("Game over", state, thinking.length);
  return { finalState: state, thinking };
}
