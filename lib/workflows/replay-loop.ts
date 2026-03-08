import { sleep, getWritable } from "workflow";

import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type { GameState } from "@/lib/game/state";
import type { GameStreamEvent } from "@/lib/workflows/types";
import type { PersistedGame } from "@/lib/game/persisted";
import { getPersistedGame, getRandomPersistedGame, clearActiveReplayRunId } from "@/lib/storage/redis";
import {
  reconstructStates,
  getAnswerText,
  buildSnapshotLabel,
  phaseToActionKind,
} from "@/lib/game/replay";

// ─── Timing constants ────────────────────────────────────────────────────────

const POST_SNAPSHOT_DELAY_MS = 600;
const POST_GAME_START_DELAY_MS = 800;
const PRE_THINKING_MIN_MS = 800;
const PRE_THINKING_MAX_MS = 1800;

// Client typewriter drains at ~3 chars/frame (180 chars/sec normal) or
// ~12 chars/frame (720 chars/sec burst when buffer > 200 chars).
// Use a conservative estimate to compute how long to wait before sending
// the snapshot (which resets the typewriter).
const TYPEWRITER_CHARS_PER_SEC = 500; // blended estimate
const MIN_DRAIN_MS = 1200;

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

// ─── Step functions ──────────────────────────────────────────────────────────

async function loadGameStep(gameId: string | null): Promise<PersistedGame | null> {
  "use step";
  if (gameId) {
    return getPersistedGame(gameId);
  }
  return getRandomPersistedGame();
}

async function emitGameStartStep(
  gameId: string,
  initialState: GameState,
): Promise<void> {
  "use step";
  await withWriter(async (emit) => {
    emit({ kind: "game:start", gameId });
    const snapshot: GameSnapshot = {
      index: 0,
      label: "Game started",
      state: initialState,
      thinking: [],
      newThinkingStartIndex: 0,
    };
    emit({ kind: "snapshot", snapshot });
  });
}

/**
 * Emit the streaming events for a turn (thinking + answer).
 * These arrive as a burst — the client typewriter buffers and animates them.
 */
async function emitTurnStreamStep(
  entry: ThinkingEntry,
  stateForSnapshot: GameState,
): Promise<void> {
  "use step";

  await withWriter(async (emit) => {
    // thinking:start
    const thinkingStart: GameStreamEvent & { pass?: number } = {
      kind: "thinking:start",
      seat: entry.seat as SeatNumber,
      phase: entry.phase,
      round: entry.round,
    };
    if (entry.pass !== undefined) {
      thinkingStart.pass = entry.pass;
    }
    emit(thinkingStart as GameStreamEvent);

    // Emit full thinking text in a single delta (client typewriter handles animation)
    emit({ kind: "thinking:delta", text: entry.text });
    emit({ kind: "thinking:end", actionSummary: entry.actionSummary });

    // answer
    const actionKind = phaseToActionKind(entry.phase);
    emit({ kind: "answer:start", seat: entry.seat as SeatNumber, actionKind });

    const answerText = getAnswerText(stateForSnapshot, entry);
    emit({ kind: "answer:delta", text: answerText });
    emit({ kind: "answer:end" });
  });
}

/**
 * Emit the snapshot(s) for a turn — sent after the typewriter has had time to drain.
 */
async function emitTurnSnapshotStep(
  entry: ThinkingEntry,
  stateForSnapshot: GameState,
  accumulatedThinking: ThinkingEntry[],
  snapshotIndex: number,
  resolutionSnapshots: { afterActionIndex: number; state: GameState; label: string }[],
  actionIndex: number,
): Promise<void> {
  "use step";

  const prevLen = accumulatedThinking.length - 1; // entry already added before this step
  let idx = snapshotIndex;

  await withWriter(async (emit) => {
    const label = buildSnapshotLabel(entry);
    const snapshot: GameSnapshot = {
      index: idx++,
      label,
      state: stateForSnapshot,
      thinking: [...accumulatedThinking],
      newThinkingStartIndex: prevLen,
    };
    emit({ kind: "snapshot", snapshot });

    // Resolution snapshots that follow this action
    for (const res of resolutionSnapshots) {
      if (res.afterActionIndex === actionIndex) {
        const resSnapshot: GameSnapshot = {
          index: idx++,
          label: res.label,
          state: res.state,
          thinking: [...accumulatedThinking],
          newThinkingStartIndex: accumulatedThinking.length,
        };
        emit({ kind: "snapshot", snapshot: resSnapshot });
      }
    }
  });
}

async function emitGameOverStep(
  finalState: GameState,
  accumulatedThinking: ThinkingEntry[],
  snapshotIndex: number,
): Promise<void> {
  "use step";
  await withWriter(async (emit) => {
    const gameOverSnapshot: GameSnapshot = {
      index: snapshotIndex,
      label: "Game over",
      state: finalState,
      thinking: [...accumulatedThinking],
      newThinkingStartIndex: accumulatedThinking.length,
    };
    emit({ kind: "snapshot", snapshot: gameOverSnapshot });
  });
}

async function emitFinishedAndCleanupStep(): Promise<void> {
  "use step";
  await withWriter(async (emit) => {
    emit({ kind: "game:finished" });
  });
  await clearActiveReplayRunId();
}

// ─── Main workflow ───────────────────────────────────────────────────────────

export async function replayLoopWorkflow(gameId: string | null = null) {
  "use workflow";

  const game = await loadGameStep(gameId);
  if (!game) {
    console.log("[replay] No game found to replay");
    await emitFinishedAndCleanupStep();
    return;
  }

  const { state: finalState, thinking } = game;
  console.log(
    `[replay] Starting replay — gameId=${finalState.gameId}, turns=${thinking.length}`,
  );

  // Reconstruct intermediate states
  const { initialState, actionStates, resolutionSnapshots } =
    reconstructStates(finalState);

  // Emit game start + initial snapshot
  await emitGameStartStep(finalState.gameId, initialState);
  await sleep(POST_GAME_START_DELAY_MS);

  // Walk through each thinking entry
  let snapshotIndex = 1;
  const accumulatedThinking: ThinkingEntry[] = [];

  for (let i = 0; i < thinking.length; i++) {
    const entry = thinking[i];
    const stateForSnapshot = actionStates[i] ?? finalState;
    accumulatedThinking.push(entry);

    // Count resolution snapshots for this action to calculate next index
    const resCount = resolutionSnapshots.filter((r) => r.afterActionIndex === i).length;

    // Pre-thinking pause — simulates AI "warming up"
    const preDelay = PRE_THINKING_MIN_MS + Math.random() * (PRE_THINKING_MAX_MS - PRE_THINKING_MIN_MS);
    await sleep(preDelay);

    // Step 1: Emit streaming events (thinking + answer)
    await emitTurnStreamStep(entry, stateForSnapshot);

    // Wait for client typewriter to drain before sending the snapshot
    // (snapshot resets the typewriter — must arrive after animation completes)
    const answerText = getAnswerText(stateForSnapshot, entry);
    const totalChars = entry.text.length + answerText.length;
    const drainMs = Math.max(MIN_DRAIN_MS, Math.ceil(totalChars / TYPEWRITER_CHARS_PER_SEC * 1000));
    await sleep(drainMs);

    // Step 2: Emit snapshot(s)
    await emitTurnSnapshotStep(
      entry,
      stateForSnapshot,
      accumulatedThinking,
      snapshotIndex,
      resolutionSnapshots,
      i,
    );

    // Post-snapshot pause
    await sleep(POST_SNAPSHOT_DELAY_MS);

    snapshotIndex += 1 + resCount;
  }

  // Game over + finished
  await emitGameOverStep(finalState, accumulatedThinking, snapshotIndex);
  await sleep(POST_SNAPSHOT_DELAY_MS);
  await emitFinishedAndCleanupStep();

  console.log(`[replay] Replay finished — gameId=${finalState.gameId}`);
}
