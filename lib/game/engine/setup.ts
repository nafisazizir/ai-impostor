import { appendGameEvent, type GameState } from "@/lib/game/state";
import { ROLE_COUNTS, type Role, type RolesBySeat } from "@/lib/game/types";

import { ALL_SEATS, INITIAL_ROUND, type EngineOptions } from "@/lib/game/engine/types";
import { assignRoles, shuffleInPlace } from "@/lib/game/engine/utils";

export function createInitialGameState(options: EngineOptions): GameState {
  const now = options.now ?? (() => new Date().toISOString());
  const rng = options.rng ?? Math.random;
  const seatOrder = shuffleInPlace([...ALL_SEATS], rng);
  const rolePool: Role[] = [
    ...Array.from({ length: ROLE_COUNTS.civilian }, () => "civilian" as const),
    "impostor",
    "mr_white",
  ];
  const rolesBySeat = assignRoles(seatOrder, rolePool, rng);
  const at = now();

  const initialState: GameState = {
    gameId: options.gameId,
    currentRound: INITIAL_ROUND,
    currentPhase: "clue",
    discussionPass: 1,
    createdAt: at,
    updatedAt: at,
    seatOrder,
    rolesBySeat,
    aliveSeats: [...seatOrder],
    cluesByRound: {},
    discussionByRound: {},
    votesByRound: {},
    latestTallyByRound: {},
    eliminations: [],
    wordPair: options.wordPair,
    outcome: null,
    events: [],
  };

  return appendGameEvent(initialState, {
    type: "game_started",
    gameId: options.gameId,
    round: INITIAL_ROUND,
    at,
    seatOrder,
    rolesBySeat: rolesBySeat as RolesBySeat,
    wordPair: options.wordPair,
  });
}
