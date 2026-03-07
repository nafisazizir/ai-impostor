import type { CallUsage } from "@/lib/ai/usage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

export type CostEstimate = {
  totalUsd: number;
  byModel: Record<string, number>;
};

// ─── Static pricing table (USD) ─────────────────────────────────────────────

const PRICING: Record<string, ModelPricing> = {
  // Budget models (current)
  "openai/gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "openai/gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "google/gemini-2.0-flash-lite": { inputPer1M: 0.07, outputPer1M: 0.3 },
  "meta/llama-4-scout": { inputPer1M: 0.17, outputPer1M: 0.66 },
  "mistral/mistral-small": { inputPer1M: 0.1, outputPer1M: 0.3 },
  "xai/grok-4.1-fast-non-reasoning": { inputPer1M: 0.2, outputPer1M: 0.5 },
  // Archived reasoning models
  "openai/gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "anthropic/claude-haiku-4-5": { inputPer1M: 1.0, outputPer1M: 5.0 },
  "google/gemini-3-flash": { inputPer1M: 0.5, outputPer1M: 3.0 },
  "xai/grok-4.1-fast-reasoning": { inputPer1M: 0.2, outputPer1M: 0.5 },
  "deepseek/deepseek-v3.2-thinking": { inputPer1M: 0.28, outputPer1M: 0.42 },
  "meta/llama-4-maverick": { inputPer1M: 0.24, outputPer1M: 0.97 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 0.5, outputPer1M: 1.5 };

// ─── Cost estimation ─────────────────────────────────────────────────────────

function modelCost(modelId: string, usage: CallUsage): number {
  const pricing = PRICING[modelId] ?? DEFAULT_PRICING;
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPer1M +
    (usage.outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

export function estimateCost(byModel: Record<string, CallUsage>): CostEstimate {
  const byModelCost: Record<string, number> = {};
  let totalUsd = 0;

  for (const [modelId, usage] of Object.entries(byModel)) {
    const cost = modelCost(modelId, usage);
    byModelCost[modelId] = cost;
    totalUsd += cost;
  }

  return { totalUsd, byModel: byModelCost };
}
