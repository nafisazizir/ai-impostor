import { describe, expect, it } from "vitest";
import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  VoteSchema,
  MrWhiteGuessSchema,
} from "@/lib/ai/schemas";

describe("WordPairSchema", () => {
  it("accepts valid word pairs", () => {
    const result = WordPairSchema.safeParse({
      civilianWord: "Ocean",
      impostorWord: "River",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing civilianWord", () => {
    const result = WordPairSchema.safeParse({ impostorWord: "River" });
    expect(result.success).toBe(false);
  });

  it("rejects missing impostorWord", () => {
    const result = WordPairSchema.safeParse({ civilianWord: "Ocean" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string values", () => {
    const result = WordPairSchema.safeParse({
      civilianWord: 123,
      impostorWord: "River",
    });
    expect(result.success).toBe(false);
  });
});

describe("ClueSchema", () => {
  it("accepts valid clue", () => {
    const result = ClueSchema.safeParse({ clue: "salty and deep" });
    expect(result.success).toBe(true);
  });

  it("rejects missing clue", () => {
    const result = ClueSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string clue", () => {
    const result = ClueSchema.safeParse({ clue: 42 });
    expect(result.success).toBe(false);
  });
});

describe("DiscussionSchema", () => {
  it("accepts valid message", () => {
    const result = DiscussionSchema.safeParse({
      message: "I think Player 3 is suspicious.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing message", () => {
    const result = DiscussionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("VoteSchema", () => {
  it("accepts valid player numbers", () => {
    for (let i = 1; i <= 6; i++) {
      const result = VoteSchema.safeParse({ targetPlayer: i });
      expect(result.success).toBe(true);
    }
  });

  it("rejects 0", () => {
    const result = VoteSchema.safeParse({ targetPlayer: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects 7", () => {
    const result = VoteSchema.safeParse({ targetPlayer: 7 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer", () => {
    const result = VoteSchema.safeParse({ targetPlayer: 2.5 });
    expect(result.success).toBe(false);
  });

  it("rejects string", () => {
    const result = VoteSchema.safeParse({ targetPlayer: "3" });
    expect(result.success).toBe(false);
  });
});

describe("MrWhiteGuessSchema", () => {
  it("accepts valid guess", () => {
    const result = MrWhiteGuessSchema.safeParse({ guess: "Ocean" });
    expect(result.success).toBe(true);
  });

  it("rejects missing guess", () => {
    const result = MrWhiteGuessSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
