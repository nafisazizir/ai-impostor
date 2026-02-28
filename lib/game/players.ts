import type { SeatNumber } from "@/lib/game/types";
import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek";
import { type XaiLanguageModelResponsesOptions } from "@ai-sdk/xai";

type PlayerConfig = {
  provider: string;
  model: string;
  logo: string;
  gatewayId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerOptions: Record<string, any>;
};

export const PLAYERS: Record<SeatNumber, PlayerConfig> = {
  1: {
    provider: "openai",
    model: "gpt-5-mini",
    logo: "/openai.svg",
    gatewayId: "openai/gpt-5-mini",
    providerOptions: {
      openai: {
        reasoningEffort: "low",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  2: {
    provider: "anthropic",
    model: "claude-sonnet-4.6",
    logo: "/anthropic.svg",
    gatewayId: "anthropic/claude-sonnet-4.6",
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 4000 },
      } satisfies AnthropicLanguageModelOptions,
    },
  },
  3: {
    provider: "google",
    model: "gemini-2.5-flash",
    logo: "/google.svg",
    gatewayId: "google/gemini-2.5-flash",
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 4000, includeThoughts: true },
      } satisfies GoogleLanguageModelOptions,
    },
  },
  4: {
    provider: "xai",
    model: "grok-4.1-fast-reasoning",
    logo: "/xai.svg",
    gatewayId: "xai/grok-4.1-fast-reasoning",
    providerOptions: {},
  },
  5: {
    provider: "deepseek",
    model: "deepseek-v3.2-thinking",
    logo: "/deepseek.svg",
    gatewayId: "deepseek/deepseek-v3.2-thinking",
    providerOptions: {
      deepseek: {
        thinking: { type: "enabled" },
      } satisfies DeepSeekLanguageModelOptions,
    },
  },
  6: {
    provider: "openai",
    model: "gpt-5.1-codex-mini",
    logo: "/openai.svg",
    gatewayId: "openai/gpt-5.1-codex-mini",
    providerOptions: {
      openai: {
        reasoningEffort: "low",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
};

export function playerName(seat: SeatNumber): string {
  return PLAYERS[seat].model;
}

export function playerLogo(seat: SeatNumber): string {
  return PLAYERS[seat].logo;
}
