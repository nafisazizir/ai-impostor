import type { PersistedGame } from "@/lib/game/persisted";
import type { GameStreamEvent } from "@/lib/workflows/types";
import type { GameSnapshot } from "@/lib/game/snapshot";
import type {
  Clue,
  DiscussionMessage,
  GameOutcome,
  GamePhase,
  Role,
  SeatNumber,
  ThinkingEntry,
  Vote,
  VoteTally,
} from "@/lib/game/types";
import type { GameEvent, GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";

// ─── Timing constants ────────────────────────────────────────────────────────

const THINKING_CHUNK_DELAY_MS = 15;
const ANSWER_CHAR_DELAY_MS = 20;
const POST_SNAPSHOT_DELAY_MS = 300;
const POST_GAME_START_DELAY_MS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

type ActionKind = "clue" | "discussion" | "mr_white_guess";

function phaseToActionKind(phase: string): ActionKind {
  if (phase === "clue") return "clue";
  if (phase === "elimination") return "mr_white_guess";
  return "discussion";
}

function getAnswerText(state: GameState, entry: ThinkingEntry): string {
  const { seat, phase, round, pass } = entry;

  if (phase === "clue") {
    const clues = state.cluesByRound[round] ?? [];
    const clue = clues.find((c) => c.seat === seat);
    return clue?.text ?? "";
  }

  if (phase === "discussion") {
    const messages = state.discussionByRound[round] ?? [];
    const msg = messages.find(
      (m) => m.seat === seat && m.pass === (pass ?? 1),
    );
    return msg?.text ?? "";
  }

  if (phase === "elimination") {
    const guessEvent = state.events.find(
      (e) => e.type === "mr_white_guess_made" && e.seat === seat,
    );
    if (guessEvent && guessEvent.type === "mr_white_guess_made") {
      return guessEvent.guess;
    }
  }

  return "";
}

// ─── Event-sourced state reconstruction ─────────────────────────────────────

/**
 * Infer maxDiscussionPasses from the events by finding the highest pass number.
 */
function inferMaxDiscussionPasses(events: GameEvent[]): number {
  let max = 1;
  for (const event of events) {
    if (event.type === "discussion_message" && event.message.pass > max) {
      max = event.message.pass;
    }
  }
  return max;
}

/**
 * Reconstruct intermediate GameStates by replaying the event log.
 * Returns:
 *   - initialState: the state before any player actions
 *   - actionStates: one state per action event (clue_submitted, discussion_message,
 *     vote_cast, mr_white_guess_made), in order — these map 1:1 to thinking entries
 *   - resolutionSnapshots: snapshots for resolution events (round_resolved,
 *     player_eliminated) that should be emitted between action groups
 */
function reconstructStates(finalState: GameState): {
  initialState: GameState;
  actionStates: GameState[];
  resolutionSnapshots: { afterActionIndex: number; state: GameState; label: string }[];
} {
  const { events } = finalState;
  const maxPasses = inferMaxDiscussionPasses(events);

  // Build running state manually from events
  let currentPhase: GamePhase = "clue";
  let currentRound = 1;
  let discussionPass = 1;
  let aliveSeats = [...finalState.seatOrder];
  const cluesByRound: Record<number, Clue[]> = {};
  const discussionByRound: Record<number, DiscussionMessage[]> = {};
  const votesByRound: Record<number, Vote[]> = {};
  const latestTallyByRound: Record<number, VoteTally | undefined> = {};
  const eliminations: { round: number; seat: SeatNumber; role: Role }[] = [];
  let outcome: GameOutcome | null = null;
  const processedEvents: GameEvent[] = [];

  function snapshot(): GameState {
    return {
      gameId: finalState.gameId,
      currentRound,
      currentPhase,
      discussionPass,
      createdAt: finalState.createdAt,
      updatedAt:
        processedEvents.length > 0
          ? processedEvents[processedEvents.length - 1].at
          : finalState.createdAt,
      seatOrder: finalState.seatOrder,
      rolesBySeat: finalState.rolesBySeat,
      aliveSeats: [...aliveSeats],
      cluesByRound: structuredClone(cluesByRound),
      discussionByRound: structuredClone(discussionByRound),
      votesByRound: structuredClone(votesByRound),
      latestTallyByRound: structuredClone(latestTallyByRound),
      eliminations: [...eliminations],
      wordPair: finalState.wordPair,
      outcome,
      events: [...processedEvents],
    };
  }

  // Skip game_started event — it's the initial setup
  const startEvent = events[0];
  if (startEvent) processedEvents.push(startEvent);

  const initialState = snapshot();
  const actionStates: GameState[] = [];
  const resolutionSnapshots: {
    afterActionIndex: number;
    state: GameState;
    label: string;
  }[] = [];
  let actionCount = 0;

  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    processedEvents.push(event);

    switch (event.type) {
      case "clue_submitted": {
        if (!cluesByRound[event.round]) cluesByRound[event.round] = [];
        cluesByRound[event.round].push(event.clue);
        if (cluesByRound[event.round].length >= aliveSeats.length) {
          currentPhase = "discussion";
          discussionPass = 1;
        }
        actionStates.push(snapshot());
        actionCount++;
        break;
      }
      case "discussion_message": {
        if (!discussionByRound[event.round])
          discussionByRound[event.round] = [];
        discussionByRound[event.round].push(event.message);
        const passMessages = discussionByRound[event.round].filter(
          (m) => m.pass === event.message.pass,
        );
        if (passMessages.length >= aliveSeats.length) {
          if (event.message.pass >= maxPasses) {
            currentPhase = "vote";
          } else {
            discussionPass = event.message.pass + 1;
          }
        }
        actionStates.push(snapshot());
        actionCount++;
        break;
      }
      case "vote_cast": {
        if (!votesByRound[event.round]) votesByRound[event.round] = [];
        votesByRound[event.round].push(event.vote);
        if (votesByRound[event.round].length >= aliveSeats.length) {
          currentPhase = "elimination";
        }
        actionStates.push(snapshot());
        actionCount++;
        break;
      }
      case "round_resolved": {
        latestTallyByRound[event.round] = event.tally;
        if (event.elimination.eliminatedSeat === null) {
          // Tie — advance to next round
          currentRound++;
          currentPhase = "clue";
          discussionPass = 1;
          resolutionSnapshots.push({
            afterActionIndex: actionCount - 1,
            state: snapshot(),
            label: "Tie — no elimination",
          });
        }
        break;
      }
      case "player_eliminated": {
        aliveSeats = aliveSeats.filter((s) => s !== event.eliminatedSeat);
        eliminations.push({
          round: event.round,
          seat: event.eliminatedSeat,
          role: event.revealedRole,
        });
        // If mr_white eliminated, stay in elimination phase for guess
        if (event.revealedRole !== "mr_white") {
          // Check if next event is game_finished — if not, advance round
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.type === "game_finished") {
            // Will be handled by game_finished
          } else if (nextEvent) {
            currentRound++;
            currentPhase = "clue";
            discussionPass = 1;
          }
        }
        resolutionSnapshots.push({
          afterActionIndex: actionCount - 1,
          state: snapshot(),
          label: `${playerName(event.eliminatedSeat)} eliminated`,
        });
        break;
      }
      case "mr_white_guess_made": {
        // This is an action event (has a thinking entry)
        actionStates.push(snapshot());
        actionCount++;
        break;
      }
      case "game_finished": {
        currentPhase = "finished";
        outcome = event.outcome;
        // Don't push — the game-over snapshot is emitted separately
        break;
      }
    }
  }

  return { initialState, actionStates, resolutionSnapshots };
}

// ─── Replay stream builder ──────────────────────────────────────────────────

export function createReplayStream(
  game: PersistedGame,
): ReadableStream<GameStreamEvent> {
  const { state, thinking } = game;

  return new ReadableStream<GameStreamEvent>({
    async start(controller) {
      try {
        await emitReplay(controller, state, thinking);
      } catch {
        // Stream cancelled
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });
}

async function emitReplay(
  controller: ReadableStreamDefaultController<GameStreamEvent>,
  finalState: GameState,
  thinking: ThinkingEntry[],
): Promise<void> {
  const enqueue = (event: GameStreamEvent) => {
    controller.enqueue(event);
  };

  const { initialState, actionStates, resolutionSnapshots } =
    reconstructStates(finalState);

  // game:start
  enqueue({ kind: "game:start", gameId: finalState.gameId });
  await delay(POST_GAME_START_DELAY_MS);

  // Initial snapshot (index 0)
  const initialSnapshot: GameSnapshot = {
    index: 0,
    label: "Game started",
    state: initialState,
    thinking: [],
    newThinkingStartIndex: 0,
  };
  enqueue({ kind: "snapshot", snapshot: initialSnapshot });
  await delay(POST_SNAPSHOT_DELAY_MS);

  // Walk through each thinking entry and emit corresponding events
  let snapshotIndex = 1;
  const accumulatedThinking: ThinkingEntry[] = [];

  for (let i = 0; i < thinking.length; i++) {
    const entry = thinking[i];
    const seat = entry.seat;
    const prevThinkingLen = accumulatedThinking.length;

    // Use the reconstructed state for this action
    const stateForSnapshot = actionStates[i] ?? finalState;

    // thinking:start
    const thinkingStart: GameStreamEvent = {
      kind: "thinking:start",
      seat,
      phase: entry.phase,
      round: entry.round,
    };
    if (entry.pass !== undefined) {
      (thinkingStart as GameStreamEvent & { pass?: number }).pass =
        entry.pass;
    }
    enqueue(thinkingStart);

    // Stream thinking text in chunks
    const thinkingChunks = chunkText(entry.text, 8);
    for (const chunk of thinkingChunks) {
      enqueue({ kind: "thinking:delta", text: chunk });
      await delay(THINKING_CHUNK_DELAY_MS);
    }

    // thinking:end
    enqueue({ kind: "thinking:end", actionSummary: entry.actionSummary });

    // answer:start
    const actionKind = phaseToActionKind(entry.phase);
    enqueue({ kind: "answer:start", seat, actionKind });

    // Stream answer text char-by-char (from the reconstructed state, not final)
    const answerText = getAnswerText(stateForSnapshot, entry);
    const answerChunks = chunkText(answerText, 2);
    for (const chunk of answerChunks) {
      enqueue({ kind: "answer:delta", text: chunk });
      await delay(ANSWER_CHAR_DELAY_MS);
    }

    // answer:end
    enqueue({ kind: "answer:end" });

    // Build and emit snapshot with correct intermediate state
    accumulatedThinking.push(entry);
    const label = buildSnapshotLabel(entry);
    const snapshot: GameSnapshot = {
      index: snapshotIndex,
      label,
      state: stateForSnapshot,
      thinking: [...accumulatedThinking],
      newThinkingStartIndex: prevThinkingLen,
    };
    enqueue({ kind: "snapshot", snapshot });
    snapshotIndex++;
    await delay(POST_SNAPSHOT_DELAY_MS);

    // Emit any resolution snapshots that follow this action
    for (const res of resolutionSnapshots) {
      if (res.afterActionIndex === i) {
        const resSnapshot: GameSnapshot = {
          index: snapshotIndex,
          label: res.label,
          state: res.state,
          thinking: [...accumulatedThinking],
          newThinkingStartIndex: accumulatedThinking.length,
        };
        enqueue({ kind: "snapshot", snapshot: resSnapshot });
        snapshotIndex++;
        await delay(POST_SNAPSHOT_DELAY_MS);
      }
    }
  }

  // Game over snapshot
  const gameOverSnapshot: GameSnapshot = {
    index: snapshotIndex,
    label: "Game over",
    state: finalState,
    thinking: [...accumulatedThinking],
    newThinkingStartIndex: accumulatedThinking.length,
  };
  enqueue({ kind: "snapshot", snapshot: gameOverSnapshot });
  await delay(POST_SNAPSHOT_DELAY_MS);

  // game:finished
  enqueue({ kind: "game:finished" });
}

function buildSnapshotLabel(entry: ThinkingEntry): string {
  const name = playerName(entry.seat as SeatNumber);
  switch (entry.phase) {
    case "clue":
      return `${name} gave clue`;
    case "discussion":
      return `${name} discussed`;
    case "vote":
      return `${name} voted`;
    case "elimination":
      return `Mr. White guessed`;
    default:
      return `${name} acted`;
  }
}
