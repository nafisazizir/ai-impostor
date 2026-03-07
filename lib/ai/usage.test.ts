import { describe, it, expect } from "vitest";
import {
  emptyCallUsage,
  emptyGameTokenUsage,
  addCallUsage,
  accumulateUsage,
  mergeGameUsage,
} from "@/lib/ai/usage";

describe("emptyCallUsage", () => {
  it("returns zeroed usage", () => {
    expect(emptyCallUsage()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });
});

describe("emptyGameTokenUsage", () => {
  it("returns zeroed game usage", () => {
    const g = emptyGameTokenUsage();
    expect(g.total).toEqual(emptyCallUsage());
    expect(g.byModel).toEqual({});
    expect(g.callCount).toBe(0);
  });
});

describe("addCallUsage", () => {
  it("sums two call usages", () => {
    const a = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    const b = { inputTokens: 200, outputTokens: 75, totalTokens: 275 };
    expect(addCallUsage(a, b)).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      totalTokens: 425,
    });
  });

  it("handles adding to empty", () => {
    const a = emptyCallUsage();
    const b = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
    expect(addCallUsage(a, b)).toEqual(b);
  });
});

describe("accumulateUsage", () => {
  it("accumulates a single call into empty game usage", () => {
    const game = emptyGameTokenUsage();
    const call = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    const result = accumulateUsage(game, "openai/gpt-5-nano", call);

    expect(result.total).toEqual(call);
    expect(result.byModel["openai/gpt-5-nano"]).toEqual(call);
    expect(result.callCount).toBe(1);
  });

  it("accumulates multiple calls for the same model", () => {
    let game = emptyGameTokenUsage();
    const call = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    game = accumulateUsage(game, "openai/gpt-5-nano", call);
    game = accumulateUsage(game, "openai/gpt-5-nano", call);

    expect(game.total).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
    });
    expect(game.byModel["openai/gpt-5-nano"]).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
    });
    expect(game.callCount).toBe(2);
  });

  it("accumulates calls across different models", () => {
    let game = emptyGameTokenUsage();
    game = accumulateUsage(game, "openai/gpt-5-nano", {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    game = accumulateUsage(game, "google/gemini-2.0-flash-lite", {
      inputTokens: 200,
      outputTokens: 75,
      totalTokens: 275,
    });

    expect(game.total).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      totalTokens: 425,
    });
    expect(game.callCount).toBe(2);
    expect(Object.keys(game.byModel)).toHaveLength(2);
  });
});

describe("mergeGameUsage", () => {
  it("merges two empty game usages", () => {
    const result = mergeGameUsage(emptyGameTokenUsage(), emptyGameTokenUsage());
    expect(result).toEqual(emptyGameTokenUsage());
  });

  it("merges non-overlapping models", () => {
    let a = emptyGameTokenUsage();
    a = accumulateUsage(a, "openai/gpt-5-nano", {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    let b = emptyGameTokenUsage();
    b = accumulateUsage(b, "google/gemini-2.0-flash-lite", {
      inputTokens: 200,
      outputTokens: 75,
      totalTokens: 275,
    });

    const result = mergeGameUsage(a, b);
    expect(result.total).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      totalTokens: 425,
    });
    expect(result.callCount).toBe(2);
    expect(Object.keys(result.byModel)).toHaveLength(2);
  });

  it("merges overlapping models correctly", () => {
    let a = emptyGameTokenUsage();
    a = accumulateUsage(a, "openai/gpt-5-nano", {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    let b = emptyGameTokenUsage();
    b = accumulateUsage(b, "openai/gpt-5-nano", {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    const result = mergeGameUsage(a, b);
    expect(result.byModel["openai/gpt-5-nano"]).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
    });
    expect(result.callCount).toBe(2);
  });
});
