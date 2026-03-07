import type { SeatNumber, ThinkingEntry } from "@/lib/game/types";
import type { GameState } from "@/lib/game/state";
import { PLAYERS } from "@/lib/game/players";
import type { GameTokenUsage } from "@/lib/ai/usage";
import type { CostEstimate } from "@/lib/ai/pricing";
import { estimateCost } from "@/lib/ai/pricing";

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
  tokenUsage?: GameTokenUsage;
  costEstimate?: CostEstimate;
};

export type PersistedGame = {
  summary: GameSummary;
  state: GameState;
  thinking: ThinkingEntry[];
};

// ─── Builders ───────────────────────────────────────────────────────────────

export function buildGameSummary(
  state: GameState,
  tokenUsage?: GameTokenUsage,
): GameSummary {
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

  const summary: GameSummary = {
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

  if (tokenUsage) {
    summary.tokenUsage = tokenUsage;
    summary.costEstimate = estimateCost(tokenUsage.byModel);
  }

  return summary;
}

export function buildPersistedGame(
  state: GameState,
  thinking: ThinkingEntry[],
  tokenUsage?: GameTokenUsage,
): PersistedGame {
  return {
    summary: buildGameSummary(state, tokenUsage),
    state,
    thinking,
  };
}
