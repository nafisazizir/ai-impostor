import { appendGameEvent, assertPhase, assertSeatAlive, type GameState } from "@/lib/game/state";
import {
  type EliminationResult,
  type GameOutcome,
  type Role,
  type RolesBySeat,
  type VoteTally,
} from "@/lib/game/types";

import type { TimestampFactory } from "@/lib/game/engine/types";
import { ALL_SEATS } from "@/lib/game/engine/types";
import { orderedAliveSeats, timestamp } from "@/lib/game/engine/utils";

export function resolveRound(state: GameState, now?: TimestampFactory): {
  state: GameState;
  result: EliminationResult;
} {
  assertPhase(state, ["elimination"]);
  const roundVotes = state.votesByRound[state.currentRound] ?? [];
  const aliveOrdered = orderedAliveSeats(state);

  if (roundVotes.length !== aliveOrdered.length) {
    throw new Error(
      `Cannot resolve round ${state.currentRound}: expected ${aliveOrdered.length} votes, got ${roundVotes.length}.`,
    );
  }

  const tally = aliveOrdered.reduce<VoteTally>((acc, seat) => {
    acc[seat] = 0;
    return acc;
  }, {} as VoteTally);

  for (const vote of roundVotes) {
    tally[vote.targetSeat] += 1;
  }

  let topSeats: Array<keyof RolesBySeat> = [];
  let topVotes = -1;
  for (const seat of aliveOrdered) {
    const seatVotes = tally[seat];
    if (seatVotes > topVotes) {
      topVotes = seatVotes;
      topSeats = [seat];
    } else if (seatVotes === topVotes) {
      topSeats.push(seat);
    }
  }

  const result: EliminationResult =
    topSeats.length === 1
      ? { eliminatedSeat: topSeats[0], reason: "plurality" }
      : { eliminatedSeat: null, reason: "tie" };

  const baseResolvedState: GameState = {
    ...state,
    latestTallyByRound: {
      ...state.latestTallyByRound,
      [state.currentRound]: tally,
    },
  };

  let nextState = appendGameEvent(baseResolvedState, {
    type: "round_resolved",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    tally,
    elimination: result,
  });

  if (result.eliminatedSeat === null) {
    nextState = {
      ...nextState,
      currentRound: state.currentRound + 1,
      currentPhase: "clue",
      discussionPass: 1,
    };
  }

  return { state: nextState, result };
}

export function evaluateWinCondition(
  state: GameState,
  mrWhiteGuessWasCorrect?: boolean,
): GameOutcome | null {
  if (mrWhiteGuessWasCorrect) {
    return {
      winner: "mr_white",
      reason: "final_guess_correct",
    };
  }

  const aliveRoles = state.aliveSeats.map((seat) => state.rolesBySeat[seat]);
  const impostorAlive = aliveRoles.includes("impostor");
  const mrWhiteAlive = aliveRoles.includes("mr_white");

  if (!impostorAlive && !mrWhiteAlive) {
    return {
      winner: "civilians",
      reason: "both_special_roles_eliminated",
    };
  }

  if (impostorAlive && state.aliveSeats.length <= 2) {
    return {
      winner: "impostor",
      reason: "reached_final_two",
    };
  }

  return null;
}

function applyOutcomeOrAdvance(
  state: GameState,
  outcome: GameOutcome | null,
  now?: TimestampFactory,
): GameState {
  if (outcome) {
    const withFinishedState: GameState = {
      ...state,
      currentPhase: "finished",
      outcome,
    };

    return appendGameEvent(withFinishedState, {
      type: "game_finished",
      gameId: state.gameId,
      round: state.currentRound,
      at: timestamp(now ?? (() => new Date().toISOString())),
      outcome,
    });
  }

  return {
    ...state,
    currentRound: state.currentRound + 1,
    currentPhase: "clue",
    discussionPass: 1,
  };
}

export function applyElimination(
  state: GameState,
  result: EliminationResult,
  now?: TimestampFactory,
): GameState {
  assertPhase(state, ["elimination"]);
  if (result.eliminatedSeat === null) {
    throw new Error("applyElimination requires a non-tie elimination result.");
  }

  assertSeatAlive(state, result.eliminatedSeat);
  const revealedRole = state.rolesBySeat[result.eliminatedSeat];

  const eliminatedState: GameState = {
    ...state,
    aliveSeats: state.aliveSeats.filter((seat) => seat !== result.eliminatedSeat),
    eliminations: [
      ...state.eliminations,
      {
        round: state.currentRound,
        seat: result.eliminatedSeat,
        role: revealedRole,
      },
    ],
  };

  const withEvent = appendGameEvent(eliminatedState, {
    type: "player_eliminated",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    eliminatedSeat: result.eliminatedSeat,
    revealedRole,
  });

  if (revealedRole === "mr_white") {
    return withEvent;
  }

  const outcome = evaluateWinCondition(withEvent);
  return applyOutcomeOrAdvance(withEvent, outcome, now);
}

export function resolveMrWhiteGuess(
  state: GameState,
  guess: string,
  now?: TimestampFactory,
): GameState {
  assertPhase(state, ["elimination"]);
  const mrWhiteSeat = ALL_SEATS.find((seat) => state.rolesBySeat[seat] === "mr_white");
  if (!mrWhiteSeat) {
    throw new Error("Mr. White seat was not found in rolesBySeat.");
  }

  const wasEliminated = !state.aliveSeats.includes(mrWhiteSeat);
  if (!wasEliminated) {
    throw new Error("Mr. White guess is only valid after Mr. White is eliminated.");
  }

  const normalizedGuess = guess.trim().toLowerCase();
  const target = state.wordPair.civilianWord.trim().toLowerCase();
  const wasCorrect = normalizedGuess.length > 0 && normalizedGuess === target;

  const withGuessEvent = appendGameEvent(state, {
    type: "mr_white_guess_made",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    seat: mrWhiteSeat,
    guess,
    wasCorrect,
  });

  const outcome = evaluateWinCondition(withGuessEvent, wasCorrect);
  return applyOutcomeOrAdvance(withGuessEvent, outcome, now);
}

export function getSeatRoleCounts(rolesBySeat: RolesBySeat): Record<Role, number> {
  return Object.values(rolesBySeat).reduce<Record<Role, number>>(
    (acc, role) => {
      acc[role] += 1;
      return acc;
    },
    {
      civilian: 0,
      impostor: 0,
      mr_white: 0,
    },
  );
}
