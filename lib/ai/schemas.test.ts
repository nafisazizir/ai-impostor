import { describe, expect, it } from "vitest";
import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  VoteSchema,
  MrWhiteGuessSchema,
  createVoteSchema,
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
      message: "I think gemini-2.0-flash-lite is suspicious.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing message", () => {
    const result = DiscussionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("VoteSchema", () => {
  it("accepts valid model name strings", () => {
    const result = VoteSchema.safeParse({ targetPlayer: "gpt-5-nano" });
    expect(result.success).toBe(true);
  });

  it("accepts any string (base schema is permissive)", () => {
    const result = VoteSchema.safeParse({ targetPlayer: "claude-3-haiku" });
    expect(result.success).toBe(true);
  });

  it("rejects numbers", () => {
    const result = VoteSchema.safeParse({ targetPlayer: 3 });
    expect(result.success).toBe(false);
  });

  it("rejects missing targetPlayer", () => {
    const result = VoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createVoteSchema", () => {
  const validNames = ["gpt-5-nano", "claude-3-haiku", "gemini-2.0-flash-lite"];
  const schema = createVoteSchema(validNames);

  it("accepts valid model names", () => {
    for (const name of validNames) {
      const result = schema.safeParse({ targetPlayer: name });
      expect(result.success).toBe(true);
    }
  });

  it("rejects model names not in valid list", () => {
    const result = schema.safeParse({ targetPlayer: "llama-4-scout" });
    expect(result.success).toBe(false);
  });

  it("rejects numbers", () => {
    const result = schema.safeParse({ targetPlayer: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = schema.safeParse({ targetPlayer: "" });
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
