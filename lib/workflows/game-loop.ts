import { sleep, getWritable } from "workflow";

import type { GameState } from "@/lib/game/state";
import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, ThinkingEntry, WordPair } from "@/lib/game/types";
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
import { playerName } from "@/lib/game/players";
import { getEnv } from "@/lib/config/env";
import {
  streamWordPair,
  streamClue,
  streamDiscussionMessage,
  streamVote,
  streamMrWhiteGuess,
} from "@/lib/ai/actions";
import type { ActionResult } from "@/lib/ai/actions";
import { setGameStartIndex, persistGame } from "@/lib/storage/redis";
import { buildPersistedGame } from "@/lib/game/persisted";
import type { GameStreamEvent } from "@/lib/workflows/types";

const MAX_ROUNDS = 10;

// ─── Helper types ────────────────────────────────────────────────────────────

type PhaseResult = {
  state: GameState;
  newThinking: ThinkingEntry[];
  nextSnapshotIndex: number;
  eventsWritten: number;
};

type ResolutionResult = PhaseResult & {
  needsMrWhiteGuess: boolean;
  eliminatedSeat: SeatNumber | null;
};

// ─── Stream writing helper ───────────────────────────────────────────────────

async function withWriter(
  fn: (emit: (event: GameStreamEvent) => void) => Promise<void>,
): Promise<number> {
  const writable = getWritable<GameStreamEvent>();
  const writer = writable.getWriter();
  const pending: Promise<void>[] = [];
  let count = 0;

  function emit(event: GameStreamEvent) {
    pending.push(writer.write(event));
    count++;
  }

  try {
    await fn(emit);
    await Promise.all(pending);
  } finally {
    writer.releaseLock();
  }

  return count;
}

// ─── Thinking entry builder ──────────────────────────────────────────────────

function buildThinkingEntry(
  seat: SeatNumber,
  state: GameState,
  result: ActionResult<unknown>,
  pass?: number,
): ThinkingEntry {
  const entry: ThinkingEntry = {
    seat,
    phase: state.currentPhase,
    round: state.currentRound,
    at: new Date().toISOString(),
    text: result.reasoning,
    actionSummary: result.actionSummary,
  };
  if (pass !== undefined) entry.pass = pass;
  return entry;
}

// ─── Snapshot builder ────────────────────────────────────────────────────────

function buildSnapshot(
  index: number,
  label: string,
  state: GameState,
  thinking: ThinkingEntry[],
  newThinkingStartIndex: number,
): GameSnapshot {
  return { index, label, state, thinking: [...thinking], newThinkingStartIndex };
}

// ─── Step functions ──────────────────────────────────────────────────────────

async function configStep() {
  "use step";
  const env = getEnv();
  return {
    maxDiscussionPasses: env.WORKFLOW_MAX_DISCUSSION_PASSES,
    delayMs: env.WORKFLOW_GAME_DELAY_MS,
  };
}

async function gameIdStep() {
  "use step";
  return `game-${Date.now()}`;
}

async function wordPairStep(): Promise<{ wordPair: WordPair }> {
  "use step";
  const result = await streamWordPair();
  console.log(
    `[workflow] Word pair: "${result.output.civilianWord}" / "${result.output.impostorWord}"`,
  );
  return { wordPair: result.output };
}

async function setupStep(
  gameId: string,
  wordPair: WordPair,
  streamOffset: number,
): Promise<{ state: GameState; nextSnapshotIndex: number; eventsWritten: number }> {
  "use step";

  await setGameStartIndex(streamOffset);

  const state = createInitialGameState({ gameId, wordPair });

  console.log(`[${gameId}] Seat order: ${state.seatOrder.join(", ")}`);
  console.log(
    `[${gameId}] Roles: ${state.seatOrder.map((s) => `${s}=${state.rolesBySeat[s]}`).join(", ")}`,
  );

  const eventsWritten = await withWriter(async (emit) => {
    emit({ kind: "game:start", gameId });
    emit({
      kind: "snapshot",
      snapshot: buildSnapshot(0, "Game started", state, [], 0),
    });
  });

  return { state, nextSnapshotIndex: 1, eventsWritten };
}

async function cluePhaseStep(
  state: GameState,
  priorThinking: ThinkingEntry[],
  snapshotIndex: number,
): Promise<PhaseResult> {
  "use step";

  let currentState = state;
  let idx = snapshotIndex;
  const allThinking = [...priorThinking];
  const newThinking: ThinkingEntry[] = [];
  const aliveSeats = orderedAliveSeats(currentState);

  console.log(`[${currentState.gameId}] Clue phase (${aliveSeats.length} players)`);

  const eventsWritten = await withWriter(async (emit) => {
    for (const seat of aliveSeats) {
      const prevLen = allThinking.length;

      emit({
        kind: "thinking:start",
        seat,
        phase: currentState.currentPhase,
        round: currentState.currentRound,
      });
      emit({ kind: "answer:start", seat, actionKind: "clue" });

      const result = await streamClue(
        currentState,
        seat,
        (delta) => emit({ kind: "thinking:delta", text: delta }),
        (delta) => emit({ kind: "answer:delta", text: delta }),
      );

      emit({ kind: "answer:end" });
      emit({ kind: "thinking:end", actionSummary: result.actionSummary });

      const entry = buildThinkingEntry(seat, currentState, result);
      newThinking.push(entry);
      allThinking.push(entry);

      currentState = submitClue(currentState, { seat, text: result.output.clue });
      console.log(`[${currentState.gameId}]   Player ${seat}: "${result.output.clue}"`);

      emit({
        kind: "snapshot",
        snapshot: buildSnapshot(
          idx++,
          `${playerName(seat)} gave clue`,
          currentState,
          allThinking,
          prevLen,
        ),
      });
    }
  });

  return { state: currentState, newThinking, nextSnapshotIndex: idx, eventsWritten };
}

async function discussionPhaseStep(
  state: GameState,
  priorThinking: ThinkingEntry[],
  snapshotIndex: number,
  pass: number,
  maxPasses: number,
): Promise<PhaseResult> {
  "use step";

  let currentState = state;
  let idx = snapshotIndex;
  const allThinking = [...priorThinking];
  const newThinking: ThinkingEntry[] = [];
  const aliveSeats = orderedAliveSeats(currentState);

  console.log(
    `[${currentState.gameId}] Discussion pass ${pass} (${aliveSeats.length} players)`,
  );

  const eventsWritten = await withWriter(async (emit) => {
    for (const seat of aliveSeats) {
      const prevLen = allThinking.length;
      let result: ActionResult<{ message: string }>;

      emit({
        kind: "thinking:start",
        seat,
        phase: currentState.currentPhase,
        round: currentState.currentRound,
        pass,
      });

      try {
        emit({ kind: "answer:start", seat, actionKind: "discussion" });

        result = await streamDiscussionMessage(
          currentState,
          seat,
          (delta) => emit({ kind: "thinking:delta", text: delta }),
          (delta) => emit({ kind: "answer:delta", text: delta }),
        );

        emit({ kind: "answer:end" });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `[${currentState.gameId}] P${seat} discussion failed: ${msg}`,
        );

        const fallbackText = "I need more time to think about this.";
        emit({ kind: "answer:start", seat, actionKind: "discussion" });
        for (const ch of fallbackText) {
          emit({ kind: "answer:delta", text: ch });
        }
        emit({ kind: "answer:end" });

        result = {
          output: { message: fallbackText },
          reasoning: "(fallback: AI generation failed)",
          actionSummary: "Discussion failed — used fallback",
        };
      }

      emit({ kind: "thinking:end", actionSummary: result.actionSummary });

      const entry = buildThinkingEntry(seat, currentState, result, pass);
      newThinking.push(entry);
      allThinking.push(entry);

      currentState = submitDiscussionMessage(
        currentState,
        { seat, text: result.output.message },
        maxPasses,
      );
      console.log(
        `[${currentState.gameId}]   Player ${seat}: "${result.output.message}"`,
      );

      emit({
        kind: "snapshot",
        snapshot: buildSnapshot(
          idx++,
          `${playerName(seat)} discussed`,
          currentState,
          allThinking,
          prevLen,
        ),
      });
    }
  });

  return { state: currentState, newThinking, nextSnapshotIndex: idx, eventsWritten };
}

async function votePhaseStep(
  state: GameState,
  priorThinking: ThinkingEntry[],
  snapshotIndex: number,
): Promise<PhaseResult> {
  "use step";

  let currentState = state;
  let idx = snapshotIndex;
  const allThinking = [...priorThinking];
  const newThinking: ThinkingEntry[] = [];
  const aliveSeats = orderedAliveSeats(currentState);

  console.log(`[${currentState.gameId}] Vote phase (${aliveSeats.length} players)`);

  const eventsWritten = await withWriter(async (emit) => {
    for (const seat of aliveSeats) {
      const prevLen = allThinking.length;

      emit({
        kind: "thinking:start",
        seat,
        phase: currentState.currentPhase,
        round: currentState.currentRound,
      });

      const result = await streamVote(
        currentState,
        seat,
        (delta) => emit({ kind: "thinking:delta", text: delta }),
      );

      emit({ kind: "thinking:end", actionSummary: result.actionSummary });

      const entry = buildThinkingEntry(seat, currentState, result);
      newThinking.push(entry);
      allThinking.push(entry);

      currentState = submitVote(currentState, {
        voterSeat: seat,
        targetSeat: result.output.targetPlayer as SeatNumber,
      });
      console.log(
        `[${currentState.gameId}]   Player ${seat} voted for Player ${result.output.targetPlayer}`,
      );

      emit({
        kind: "snapshot",
        snapshot: buildSnapshot(
          idx++,
          `${playerName(seat)} voted`,
          currentState,
          allThinking,
          prevLen,
        ),
      });
    }
  });

  return { state: currentState, newThinking, nextSnapshotIndex: idx, eventsWritten };
}

async function resolutionStep(
  state: GameState,
  priorThinking: ThinkingEntry[],
  snapshotIndex: number,
): Promise<ResolutionResult> {
  "use step";

  let currentState = state;
  let idx = snapshotIndex;

  console.log(`[${currentState.gameId}] Resolving round...`);
  const resolved = resolveRound(currentState);
  currentState = resolved.state;

  if (resolved.result.eliminatedSeat === null) {
    console.log(`[${currentState.gameId}] Tie — no elimination.`);

    const eventsWritten = await withWriter(async (emit) => {
      emit({
        kind: "snapshot",
        snapshot: buildSnapshot(
          idx++,
          "Tie — no elimination",
          currentState,
          priorThinking,
          priorThinking.length,
        ),
      });
    });

    return {
      state: currentState,
      newThinking: [],
      nextSnapshotIndex: idx,
      eventsWritten,
      needsMrWhiteGuess: false,
      eliminatedSeat: null,
    };
  }

  const eliminatedSeat = resolved.result.eliminatedSeat;
  const eliminatedRole = currentState.rolesBySeat[eliminatedSeat];
  currentState = applyElimination(currentState, resolved.result);

  console.log(
    `[${currentState.gameId}] Eliminated: Player ${eliminatedSeat} (${eliminatedRole})`,
  );

  const needsMrWhiteGuess =
    eliminatedRole === "mr_white" && currentState.currentPhase === "elimination";

  const eventsWritten = await withWriter(async (emit) => {
    emit({
      kind: "snapshot",
      snapshot: buildSnapshot(
        idx++,
        `${playerName(eliminatedSeat)} eliminated`,
        currentState,
        priorThinking,
        priorThinking.length,
      ),
    });
  });

  return {
    state: currentState,
    newThinking: [],
    nextSnapshotIndex: idx,
    eventsWritten,
    needsMrWhiteGuess,
    eliminatedSeat: needsMrWhiteGuess ? eliminatedSeat : null,
  };
}

async function mrWhiteGuessStep(
  state: GameState,
  priorThinking: ThinkingEntry[],
  snapshotIndex: number,
  seat: SeatNumber,
): Promise<PhaseResult> {
  "use step";

  let currentState = state;
  let idx = snapshotIndex;
  const allThinking = [...priorThinking];
  const newThinking: ThinkingEntry[] = [];
  const prevLen = allThinking.length;

  console.log(`[${currentState.gameId}] Mr. White gets a final guess...`);

  const eventsWritten = await withWriter(async (emit) => {
    emit({
      kind: "thinking:start",
      seat,
      phase: currentState.currentPhase,
      round: currentState.currentRound,
    });
    emit({ kind: "answer:start", seat, actionKind: "mr_white_guess" });

    const result = await streamMrWhiteGuess(
      currentState,
      seat,
      (delta) => emit({ kind: "thinking:delta", text: delta }),
      (delta) => emit({ kind: "answer:delta", text: delta }),
    );

    emit({ kind: "answer:end" });
    emit({ kind: "thinking:end", actionSummary: result.actionSummary });

    const entry = buildThinkingEntry(seat, currentState, result);
    newThinking.push(entry);
    allThinking.push(entry);

    currentState = resolveMrWhiteGuess(currentState, result.output.guess);

    console.log(
      `[${currentState.gameId}] Mr. White guessed: "${result.output.guess}" — ${currentState.outcome?.winner === "mr_white" ? "CORRECT!" : "WRONG"}`,
    );

    emit({
      kind: "snapshot",
      snapshot: buildSnapshot(
        idx++,
        `Mr. White guessed: "${result.output.guess}"`,
        currentState,
        allThinking,
        prevLen,
      ),
    });
  });

  return { state: currentState, newThinking, nextSnapshotIndex: idx, eventsWritten };
}

async function emitGameOverSnapshotStep(
  state: GameState,
  thinking: ThinkingEntry[],
  snapshotIndex: number,
): Promise<{ eventsWritten: number }> {
  "use step";

  const eventsWritten = await withWriter(async (emit) => {
    emit({
      kind: "snapshot",
      snapshot: buildSnapshot(
        snapshotIndex,
        "Game over",
        state,
        thinking,
        thinking.length,
      ),
    });
  });

  return { eventsWritten };
}

async function emitFinishedStep(): Promise<{ eventsWritten: number }> {
  "use step";

  const eventsWritten = await withWriter(async (emit) => {
    emit({ kind: "game:finished" });
  });

  return { eventsWritten };
}

async function persistGameStep(
  state: GameState,
  thinking: ThinkingEntry[],
): Promise<void> {
  "use step";
  const game = buildPersistedGame(state, thinking);
  await persistGame(game);
  console.log(`[${state.gameId}] Persisted to Redis (${game.summary.durationMs}ms game)`);
}

// ─── Main workflow ───────────────────────────────────────────────────────────

export async function gameLoopWorkflow() {
  "use workflow";

  const config = await configStep();
  let streamOffset = 0;

  while (true) {
    const gameId = await gameIdStep();

    // 1. Generate word pair
    const { wordPair } = await wordPairStep();

    // 2. Setup game — writes game:start + initial snapshot, stores gameStartIndex
    const setup = await setupStep(gameId, wordPair, streamOffset);
    let state = setup.state;
    let thinking: ThinkingEntry[] = [];
    let snapshotIndex = setup.nextSnapshotIndex;
    streamOffset += setup.eventsWritten;

    // 3. Game loop
    let roundCount = 0;
    while (state.currentPhase !== "finished" && roundCount < MAX_ROUNDS) {
      roundCount++;

      // --- Clue phase ---
      const clue = await cluePhaseStep(state, thinking, snapshotIndex);
      state = clue.state;
      thinking = [...thinking, ...clue.newThinking];
      snapshotIndex = clue.nextSnapshotIndex;
      streamOffset += clue.eventsWritten;

      // --- Discussion phase (multiple passes) ---
      for (let pass = 1; pass <= config.maxDiscussionPasses; pass++) {
        const disc = await discussionPhaseStep(
          state,
          thinking,
          snapshotIndex,
          pass,
          config.maxDiscussionPasses,
        );
        state = disc.state;
        thinking = [...thinking, ...disc.newThinking];
        snapshotIndex = disc.nextSnapshotIndex;
        streamOffset += disc.eventsWritten;
      }

      // --- Vote phase ---
      const vote = await votePhaseStep(state, thinking, snapshotIndex);
      state = vote.state;
      thinking = [...thinking, ...vote.newThinking];
      snapshotIndex = vote.nextSnapshotIndex;
      streamOffset += vote.eventsWritten;

      // --- Resolution ---
      const res = await resolutionStep(state, thinking, snapshotIndex);
      state = res.state;
      thinking = [...thinking, ...res.newThinking];
      snapshotIndex = res.nextSnapshotIndex;
      streamOffset += res.eventsWritten;

      // --- Mr. White guess (if applicable) ---
      if (res.needsMrWhiteGuess && res.eliminatedSeat) {
        const mrw = await mrWhiteGuessStep(
          state,
          thinking,
          snapshotIndex,
          res.eliminatedSeat,
        );
        state = mrw.state;
        thinking = [...thinking, ...mrw.newThinking];
        snapshotIndex = mrw.nextSnapshotIndex;
        streamOffset += mrw.eventsWritten;
      }

      if (state.currentPhase === "finished") break;
    }

    // 4. Emit final snapshot + finished event
    if (state.currentPhase !== "finished") {
      console.warn(
        `[${gameId}] Game did not finish within ${MAX_ROUNDS} rounds.`,
      );
    }

    console.log(
      `[${gameId}] Game finished. Outcome: ${JSON.stringify(state.outcome)}`,
    );

    const over = await emitGameOverSnapshotStep(state, thinking, snapshotIndex);
    streamOffset += over.eventsWritten;

    if (state.outcome) {
      await persistGameStep(state, thinking);
    }

    const fin = await emitFinishedStep();
    streamOffset += fin.eventsWritten;

    // 5. Sleep between games
    if (config.delayMs > 0) {
      await sleep(config.delayMs);
    } else {
      await sleep(1000);
    }
  }
}
