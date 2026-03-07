import { describe, it, expect } from "vitest";
import { estimateCost } from "@/lib/ai/pricing";

describe("estimateCost", () => {
  it("returns zero for empty byModel", () => {
    const result = estimateCost({});
    expect(result.totalUsd).toBe(0);
    expect(result.byModel).toEqual({});
  });

  it("calculates cost for a known model", () => {
    const result = estimateCost({
      "openai/gpt-5-nano": {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      },
    });
    // $0.05/1M input + $0.40/1M output = $0.45
    expect(result.totalUsd).toBeCloseTo(0.45, 6);
    expect(result.byModel["openai/gpt-5-nano"]).toBeCloseTo(0.45, 6);
  });

  it("calculates cost for multiple models", () => {
    const result = estimateCost({
      "openai/gpt-5-nano": {
        inputTokens: 500_000,
        outputTokens: 100_000,
        totalTokens: 600_000,
      },
      "google/gemini-2.0-flash-lite": {
        inputTokens: 500_000,
        outputTokens: 100_000,
        totalTokens: 600_000,
      },
    });
    // gpt-5-nano: 0.5*0.05 + 0.1*0.4 = 0.025 + 0.04 = 0.065
    // gemini: 0.5*0.07 + 0.1*0.3 = 0.035 + 0.03 = 0.065
    expect(result.byModel["openai/gpt-5-nano"]).toBeCloseTo(0.065, 6);
    expect(result.byModel["google/gemini-2.0-flash-lite"]).toBeCloseTo(
      0.065,
      6,
    );
    expect(result.totalUsd).toBeCloseTo(0.13, 6);
  });

  it("uses default pricing for unknown models", () => {
    const result = estimateCost({
      "unknown/model": {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      },
    });
    // Default: $0.50/1M input + $1.50/1M output = $2.00
    expect(result.totalUsd).toBeCloseTo(2.0, 6);
  });

  it("handles small token counts", () => {
    const result = estimateCost({
      "openai/gpt-5-nano": {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
    });
    // 0.001 * 0.05 + 0.0005 * 0.4 = 0.00005 + 0.0002 = 0.00025
    expect(result.totalUsd).toBeCloseTo(0.00025, 6);
  });
});
