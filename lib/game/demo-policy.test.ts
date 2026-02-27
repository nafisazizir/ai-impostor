import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/game/state";
import { createInitialGameState, createSeededRng, orderedAliveSeats } from "@/lib/game/engine";
import {
  DEMO_WORD_PAIR,
  chooseDemoVoteTarget,
  createDemoClue,
  createDemoDiscussionMessage,
  createDemoMrWhiteFinalGuess,
} from "@/lib/game/demo-policy";
import type { RolesBySeat, SeatNumber } from "@/lib/game/types";

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

function createState(overrides?: Partial<GameState>): GameState {
  const base = createInitialGameState({
    gameId: "demo-policy",
    wordPair: DEMO_WORD_PAIR,
    rng: createSeededRng(99),
  });

  return {
    ...base,
    seatOrder: [1, 2, 3, 4, 5, 6],
    aliveSeats: [1, 2, 3, 4, 5, 6],
    rolesBySeat: controlledRoles(),
    ...overrides,
  };
}

describe("demo policy", () => {
  it("returns alive seats in fixed seat order", () => {
    const state = createState({
      aliveSeats: [1, 3, 6] satisfies SeatNumber[],
    });

    expect(orderedAliveSeats(state)).toEqual([1, 3, 6]);
  });

  it("generates deterministic clue and discussion text", () => {
    const state = createState({
      currentRound: 2,
      discussionPass: 1,
    });

    expect(createDemoClue(state, 4)).toBe("round-2-seat-4-clue");
    expect(createDemoDiscussionMessage(state, 4)).toBe("round-2-pass-1-seat-4-discussion");
  });

  it("votes out Mr. White first when alive", () => {
    const state = createState();

    expect(chooseDemoVoteTarget(state, 1)).toBe(6);
  });

  it("votes out impostor when Mr. White is already eliminated", () => {
    const state = createState({
      aliveSeats: [1, 2, 3, 4, 5] satisfies SeatNumber[],
    });

    expect(chooseDemoVoteTarget(state, 1)).toBe(5);
  });

  it("uses a deterministic wrong guess for Mr. White", () => {
    expect(createDemoMrWhiteFinalGuess()).toBe("demo-wrong-guess");
  });
});
