import { describe, expect, it } from "vitest";

import {
  createInitialGameState,
  createSeededRng,
  orderedAliveSeats,
  submitClue,
  submitDiscussionMessage,
  submitVote,
  resolveRound,
  applyElimination,
} from "@/lib/game/engine";
import type { SeatNumber } from "@/lib/game/types";
import { playerName } from "@/lib/game/players";

import {
  playerSystemPrompt,
  voteUserPrompt,
  mrWhiteGuessUserPrompt,
  gameContextSummary,
  hostWordPairSystemPrompt,
} from "@/lib/ai/prompts";

const WORD_PAIR = { civilianWord: "Ocean", impostorWord: "River" };

function createTestState() {
  return createInitialGameState({
    gameId: "test-game",
    wordPair: WORD_PAIR,
    rng: createSeededRng(42),
  });
}

function findSeatByRole(
  state: ReturnType<typeof createTestState>,
  role: string,
): SeatNumber {
  const seats = Object.entries(state.rolesBySeat);
  const match = seats.find(([, r]) => r === role);
  if (!match) throw new Error(`No seat found for role ${role}`);
  return Number(match[0]) as SeatNumber;
}

describe("Information hiding", () => {
  it("civilian sees only their own word, not the other", () => {
    const state = createTestState();
    const civSeat = findSeatByRole(state, "civilian");
    const prompt = playerSystemPrompt(state, civSeat);

    expect(prompt).toContain('"Ocean"');
    expect(prompt).not.toContain('"River"');
    // Should NOT reveal the role
    expect(prompt).not.toContain("CIVILIAN");
    expect(prompt).not.toContain("IMPOSTOR");
  });

  it("impostor sees only their own word, not the other", () => {
    const state = createTestState();
    const impSeat = findSeatByRole(state, "impostor");
    const prompt = playerSystemPrompt(state, impSeat);

    expect(prompt).toContain('"River"');
    expect(prompt).not.toContain('"Ocean"');
    // Should NOT reveal the role
    expect(prompt).not.toContain("CIVILIAN");
    expect(prompt).not.toContain("IMPOSTOR");
  });

  it("civilian and impostor get identical prompt structure", () => {
    const state = createTestState();
    const civSeat = findSeatByRole(state, "civilian");
    const impSeat = findSeatByRole(state, "impostor");
    const civPrompt = playerSystemPrompt(state, civSeat);
    const impPrompt = playerSystemPrompt(state, impSeat);

    // Both should mention "YOUR WORD" and not knowing which group they're in
    expect(civPrompt).toContain("YOUR WORD:");
    expect(impPrompt).toContain("YOUR WORD:");
    expect(civPrompt).toContain("do NOT know");
    expect(impPrompt).toContain("do NOT know");
  });

  it("mr_white sees neither word but knows they are Mr. White", () => {
    const state = createTestState();
    const mwSeat = findSeatByRole(state, "mr_white");
    const prompt = playerSystemPrompt(state, mwSeat);

    expect(prompt).not.toContain('"Ocean"');
    expect(prompt).not.toContain('"River"');
    expect(prompt).toContain("MR. WHITE");
  });
});

describe("Model name terminology", () => {
  it("system prompt uses model name format", () => {
    const state = createTestState();
    const civSeat = findSeatByRole(state, "civilian");
    const prompt = playerSystemPrompt(state, civSeat);

    expect(prompt).toContain(`You are ${playerName(civSeat)}`);
    expect(prompt).not.toMatch(/You are Player \d/);
  });

  it("game context lists players by model name", () => {
    const state = createTestState();
    const seat = orderedAliveSeats(state)[0];
    const context = gameContextSummary(state, seat);

    expect(context).toContain(playerName(seat));
    expect(context).not.toMatch(/Player \d+ \(/);
  });

  it("host system prompt is static and does not depend on game state", () => {
    const prompt = hostWordPairSystemPrompt();

    // It should contain generation guidelines
    expect(prompt).toContain("civilianWord");
    expect(prompt).toContain("impostorWord");
    // Examples are acceptable — the prompt has no access to the current game's words
    expect(prompt).toContain("Examples");
  });
});

describe("Vote prompt valid targets", () => {
  it("excludes self from vote targets", () => {
    const state = createTestState();
    const alive = orderedAliveSeats(state);
    const voter = alive[0];
    const prompt = voteUserPrompt(state, voter);

    const targetSection = prompt.split(
      "You MUST vote for one of the following",
    )[1];
    expect(targetSection).toBeDefined();

    // Self should not be listed as a target
    const targetLines = targetSection!
      .split("\n")
      .filter((line) => line.trim().startsWith("-"));
    const selfLine = targetLines.find((line) =>
      line.includes(playerName(voter)),
    );
    expect(selfLine).toBeUndefined();

    // All other alive players should be listed
    const otherAlive = alive.filter((s) => s !== voter);
    for (const seat of otherAlive) {
      expect(targetSection).toContain(playerName(seat));
    }
  });

  it("excludes eliminated players from vote targets", () => {
    let state = createTestState();
    const alive = orderedAliveSeats(state);

    // Play through a round to eliminate someone
    for (const seat of alive) {
      state = submitClue(state, { seat, text: "test clue" });
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const seat of orderedAliveSeats(state)) {
        state = submitDiscussionMessage(state, {
          seat,
          text: "test discussion",
        });
      }
    }

    // Everyone votes for the first player
    const target = alive[0];
    for (const seat of orderedAliveSeats(state)) {
      state = submitVote(state, { voterSeat: seat, targetSeat: target });
    }

    const resolved = resolveRound(state);
    state = resolved.state;
    if (resolved.result.eliminatedSeat !== null) {
      state = applyElimination(state, resolved.result);
    }

    // If game continues, check vote prompt for next round
    if (state.currentPhase !== "finished") {
      const aliveNow = orderedAliveSeats(state);
      const voter = aliveNow[0];
      const prompt = voteUserPrompt(state, voter);

      // Extract only the vote target section
      const targetSection = prompt.split(
        "You MUST vote for one of the following",
      )[1];
      expect(targetSection).toBeDefined();

      // Eliminated player should not be in vote targets
      const targetLines = targetSection!
        .split("\n")
        .filter((line) => line.trim().startsWith("-"));
      const eliminatedLine = targetLines.find((line) =>
        line.includes(playerName(target)),
      );
      expect(eliminatedLine).toBeUndefined();

      // But they should appear in the history context
      expect(prompt).toContain(playerName(target));
    }
  });
});

describe("Mr. White guess prompt", () => {
  it("instructs to guess the majority word", () => {
    const state = createTestState();
    const mwSeat = findSeatByRole(state, "mr_white");
    const prompt = mrWhiteGuessUserPrompt(state, mwSeat);

    expect(prompt).toContain("guess the MAJORITY word");
    // Should NOT contain either word
    expect(prompt).not.toContain('"Ocean"');
    expect(prompt).not.toContain('"River"');
  });
});

describe("Context summary", () => {
  it("includes round and phase", () => {
    const state = createTestState();
    const seat = orderedAliveSeats(state)[0];
    const context = gameContextSummary(state, seat);

    expect(context).toContain("Round: 1");
    expect(context).toContain("Phase: clue");
  });

  it("marks the current player with (you)", () => {
    const state = createTestState();
    const seat = orderedAliveSeats(state)[0];
    const context = gameContextSummary(state, seat);

    expect(context).toContain("(you)");
  });

  it("shows clue history after clues are given", () => {
    let state = createTestState();
    const alive = orderedAliveSeats(state);
    state = submitClue(state, { seat: alive[0], text: "test clue" });

    const context = gameContextSummary(state, alive[1]);
    expect(context).toContain("Round 1 clues:");
    expect(context).toContain('"test clue"');
  });
});
