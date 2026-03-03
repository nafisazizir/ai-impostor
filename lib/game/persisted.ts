import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type { GameState } from "@/lib/game/state";
import { PLAYERS } from "@/lib/game/players";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlayerIdentity = {
  provider: string;
  model: string;
};

export type GameSummary = {
  gameId: string;
  createdAt: string;
  finishedAt: string;
  durationMs: number;
  wordPair: { civilianWord: string; impostorWord: string };
  outcome: NonNullable<GameState["outcome"]>;
  roundCount: number;
  seatOrder: SeatNumber[];
  rolesBySeat: Record<SeatNumber, string>;
  eliminations: { round: number; seat: SeatNumber; role: string }[];
  players: Record<SeatNumber, PlayerIdentity>;
};

export type PersistedGame = {
  summary: GameSummary;
  state: GameState;
  thinking: ThinkingEntry[];
};

// ─── Builders ───────────────────────────────────────────────────────────────

export function buildGameSummary(state: GameState): GameSummary {
  if (!state.outcome) {
    throw new Error(`Cannot build summary: game ${state.gameId} has no outcome`);
  }

  const players = {} as Record<SeatNumber, PlayerIdentity>;
  for (const seat of state.seatOrder) {
    players[seat] = {
      provider: PLAYERS[seat].provider,
      model: PLAYERS[seat].model,
    };
  }

  const createdMs = new Date(state.createdAt).getTime();
  const finishedMs = new Date(state.updatedAt).getTime();

  return {
    gameId: state.gameId,
    createdAt: state.createdAt,
    finishedAt: state.updatedAt,
    durationMs: finishedMs - createdMs,
    wordPair: state.wordPair,
    outcome: state.outcome,
    roundCount: state.currentRound,
    seatOrder: state.seatOrder,
    rolesBySeat: state.rolesBySeat,
    eliminations: state.eliminations,
    players,
  };
}

export function buildPersistedGame(
  state: GameState,
  thinking: ThinkingEntry[],
): PersistedGame {
  return {
    summary: buildGameSummary(state),
    state,
    thinking,
  };
}
