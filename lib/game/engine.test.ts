import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/game/state";
import {
  applyElimination,
  assertSetupInvariants,
  createInitialGameState,
  createSeededRng,
  evaluateWinCondition,
  resolveMrWhiteGuess,
  resolveRound,
  submitClue,
  submitDiscussionMessage,
  submitVote,
} from "@/lib/game/engine";
import type { EliminationResult, RolesBySeat, SeatNumber, WordPair } from "@/lib/game/types";

const WORD_PAIR: WordPair = {
  civilianWord: "Ocean",
  impostorWord: "River",
};

function createNowFactory() {
  let tick = 0;
  return () => {
    const value = String(tick).padStart(2, "0");
    tick += 1;
    return `2026-01-01T00:00:${value}.000Z`;
  };
}

function createState(seed = 7): GameState {
  return createInitialGameState({
    gameId: "game-1",
    wordPair: WORD_PAIR,
    rng: createSeededRng(seed),
    now: createNowFactory(),
  });
}

function controlledRoles(): RolesBySeat {
  return {
    1: "civilian",
    2: "civilian",
    3: "civilian",
    4: "civilian",
    5: "impostor",
    6: "mr_white",
  };
}

function withControlledTableState(overrides?: Partial<GameState>): GameState {
  const base = createState();
  return {
    ...base,
    seatOrder: [1, 2, 3, 4, 5, 6],
    aliveSeats: [1, 2, 3, 4, 5, 6],
    rolesBySeat: controlledRoles(),
    ...overrides,
  };
}

describe("engine setup", () => {
  it("creates deterministic setup with expected role counts", () => {
    const now = createNowFactory();
    const a = createInitialGameState({
      gameId: "seeded",
      wordPair: WORD_PAIR,
      rng: createSeededRng(1234),
      now,
    });
    const b = createInitialGameState({
      gameId: "seeded",
      wordPair: WORD_PAIR,
      rng: createSeededRng(1234),
      now: createNowFactory(),
    });

    expect(a.seatOrder).toEqual(b.seatOrder);
    expect(a.rolesBySeat).toEqual(b.rolesBySeat);
    expect(a.currentPhase).toBe("clue");
    expect(a.currentRound).toBe(1);
    expect(a.aliveSeats).toHaveLength(6);
    expect(a.events[0]?.type).toBe("game_started");
    expect(() => assertSetupInvariants(a)).not.toThrow();
  });
});

describe("phase and order guards", () => {
  it("rejects out-of-phase actions", () => {
    const state = createState();
    expect(() =>
      submitVote(
        state,
        {
          voterSeat: state.seatOrder[0],
          targetSeat: state.seatOrder[1],
        },
        createNowFactory(),
      ),
    ).toThrow('Invalid phase transition from "clue". Allowed: vote.');
  });

  it("enforces alive seat turn order through clue -> discussion -> vote", () => {
    let state = withControlledTableState();
    const now = createNowFactory();

    expect(() =>
      submitClue(
        state,
        {
          seat: 2,
          text: "too early",
        },
        now,
      ),
    ).toThrow("Out-of-order action. Expected seat 1, received 2.");

    for (const seat of state.seatOrder) {
      state = submitClue(state, { seat, text: `clue-${seat}` }, now);
    }
    expect(state.currentPhase).toBe("discussion");
    expect(state.discussionPass).toBe(1);

    for (const seat of state.seatOrder) {
      state = submitDiscussionMessage(state, { seat, text: `d1-${seat}` }, 2, now);
    }
    expect(state.currentPhase).toBe("discussion");
    expect(state.discussionPass).toBe(2);

    for (const seat of state.seatOrder) {
      state = submitDiscussionMessage(state, { seat, text: `d2-${seat}` }, 2, now);
    }
    expect(state.currentPhase).toBe("vote");

    for (const seat of state.seatOrder) {
      state = submitVote(state, { voterSeat: seat, targetSeat: 6 }, now);
    }
    expect(state.currentPhase).toBe("elimination");
  });

  it("rejects actions from eliminated players", () => {
    const state = withControlledTableState({
      currentPhase: "clue",
      aliveSeats: [1, 2, 3, 4, 5] satisfies SeatNumber[],
    });

    expect(() => submitClue(state, { seat: 6, text: "ghost clue" }, createNowFactory())).toThrow(
      "Seat 6 is eliminated and cannot act.",
    );
  });
});

describe("round resolution and elimination handling", () => {
  it("handles tie votes by advancing to next round without elimination", () => {
    let state = withControlledTableState({
      currentPhase: "vote",
      aliveSeats: [1, 2, 3, 4] satisfies SeatNumber[],
      cluesByRound: { 1: [] },
      discussionByRound: { 1: [] },
      votesByRound: {},
    });
    const now = createNowFactory();

    state = submitVote(state, { voterSeat: 1, targetSeat: 2 }, now);
    state = submitVote(state, { voterSeat: 2, targetSeat: 1 }, now);
    state = submitVote(state, { voterSeat: 3, targetSeat: 4 }, now);
    state = submitVote(state, { voterSeat: 4, targetSeat: 3 }, now);

    const resolved = resolveRound(state, now);
    expect(resolved.result).toEqual({ eliminatedSeat: null, reason: "tie" });
    expect(resolved.state.currentRound).toBe(2);
    expect(resolved.state.currentPhase).toBe("clue");
    expect(resolved.state.eliminations).toHaveLength(0);
  });

  it("applies elimination and records reveal event", () => {
    const now = createNowFactory();
    const state = withControlledTableState({
      currentPhase: "elimination",
      currentRound: 2,
      aliveSeats: [1, 2, 3, 4, 5] satisfies SeatNumber[],
    });
    const result: EliminationResult = { eliminatedSeat: 5, reason: "plurality" };

    const next = applyElimination(state, result, now);
    expect(next.aliveSeats).toEqual([1, 2, 3, 4]);
    expect(next.eliminations).toEqual([{ round: 2, seat: 5, role: "impostor" }]);
    expect(next.currentPhase).toBe("finished");
    expect(next.currentRound).toBe(2);
    expect(next.events.at(-1)?.type).toBe("game_finished");
    expect(next.outcome).toEqual({
      winner: "civilians",
      reason: "both_special_roles_eliminated",
    });
  });

  it("Mr. White wins when elimination brings alive count to 2 with mr_white still alive", () => {
    const now = createNowFactory();
    // Impostor (seat 5) already eliminated; seats 1, 2, 6 remain (civilian, civilian, mr_white)
    const state = withControlledTableState({
      currentPhase: "elimination",
      currentRound: 3,
      aliveSeats: [1, 2, 6] satisfies SeatNumber[],
      eliminations: [
        { round: 1, seat: 5, role: "impostor" as const },
        { round: 2, seat: 3, role: "civilian" as const },
      ],
    });

    // Eliminate civilian seat 1 → only seats 2 (civilian) and 6 (mr_white) remain
    const next = applyElimination(state, { eliminatedSeat: 1, reason: "plurality" }, now);
    expect(next.aliveSeats).toEqual([2, 6]);
    expect(next.currentPhase).toBe("finished");
    expect(next.outcome).toEqual({
      winner: "mr_white",
      reason: "reached_final_two",
    });
  });

  it("supports Mr. White guess flow after Mr. White elimination", () => {
    const now = createNowFactory();
    const state = withControlledTableState({
      currentPhase: "elimination",
      currentRound: 1,
      aliveSeats: [1, 2, 3, 4, 5, 6] satisfies SeatNumber[],
    });

    const afterElimination = applyElimination(state, { eliminatedSeat: 6, reason: "plurality" }, now);
    expect(afterElimination.currentPhase).toBe("elimination");
    expect(afterElimination.outcome).toBeNull();

    const withGuess = resolveMrWhiteGuess(afterElimination, "ocean", now);
    expect(withGuess.currentPhase).toBe("finished");
    expect(withGuess.outcome).toEqual({
      winner: "mr_white",
      reason: "final_guess_correct",
    });
    expect(withGuess.events.at(-1)?.type).toBe("game_finished");
  });
});

describe("win-condition branches", () => {
  it("returns civilians when both special roles are eliminated", () => {
    const state = withControlledTableState({
      aliveSeats: [1, 2, 3, 4] satisfies SeatNumber[],
    });
    expect(evaluateWinCondition(state)).toEqual({
      winner: "civilians",
      reason: "both_special_roles_eliminated",
    });
  });

  it("returns impostor when final two includes impostor", () => {
    const state = withControlledTableState({
      aliveSeats: [2, 5] satisfies SeatNumber[],
    });
    expect(evaluateWinCondition(state)).toEqual({
      winner: "impostor",
      reason: "reached_final_two",
    });
  });

  it("returns Mr. White when final two includes mr_white (impostor already eliminated)", () => {
    const state = withControlledTableState({
      aliveSeats: [2, 6] satisfies SeatNumber[],
    });
    expect(evaluateWinCondition(state)).toEqual({
      winner: "mr_white",
      reason: "reached_final_two",
    });
  });

  it("returns Mr. White when final guess is correct", () => {
    const state = withControlledTableState();
    expect(evaluateWinCondition(state, true)).toEqual({
      winner: "mr_white",
      reason: "final_guess_correct",
    });
  });
});

describe("deterministic simulation", () => {
  it("runs to a stable terminal outcome with fixed seed", () => {
    const now = createNowFactory();
    let state = createInitialGameState({
      gameId: "sim-1",
      wordPair: WORD_PAIR,
      rng: createSeededRng(42),
      now,
    });

    for (let i = 0; i < 10 && state.currentPhase !== "finished"; i += 1) {
      if (state.currentPhase === "clue") {
        for (const seat of state.seatOrder.filter((candidate) => state.aliveSeats.includes(candidate))) {
          state = submitClue(state, { seat, text: `clue-${i}-${seat}` }, now);
        }
        continue;
      }

      if (state.currentPhase === "discussion") {
        for (const seat of state.seatOrder.filter((candidate) => state.aliveSeats.includes(candidate))) {
          state = submitDiscussionMessage(state, { seat, text: `talk-${i}-${seat}` }, 1, now);
        }
        continue;
      }

      if (state.currentPhase === "vote") {
        const aliveSeats = state.seatOrder.filter((candidate) => state.aliveSeats.includes(candidate));
        const mrWhiteTarget = aliveSeats.find((seat) => state.rolesBySeat[seat] === "mr_white");
        const impostorTarget = aliveSeats.find((seat) => state.rolesBySeat[seat] === "impostor");
        const targetSeat = mrWhiteTarget ?? impostorTarget ?? aliveSeats[0];

        for (const voterSeat of aliveSeats) {
          state = submitVote(state, { voterSeat, targetSeat }, now);
        }
        continue;
      }

      if (state.currentPhase === "elimination") {
        const resolved = resolveRound(state, now);
        state = resolved.state;
        if (resolved.result.eliminatedSeat !== null) {
          state = applyElimination(state, resolved.result, now);
          if (state.currentPhase === "elimination" && state.outcome === null) {
            state = resolveMrWhiteGuess(state, "wrong-guess", now);
          }
        }
      }
    }

    expect(state.currentPhase).toBe("finished");
    expect(state.outcome).toEqual({
      winner: "civilians",
      reason: "both_special_roles_eliminated",
    });

    const eventTypes = state.events.map((event) => event.type);
    expect(eventTypes[0]).toBe("game_started");
    expect(eventTypes.at(-1)).toBe("game_finished");
    expect(eventTypes).toContain("round_resolved");
    expect(eventTypes).toContain("player_eliminated");
  });
});
