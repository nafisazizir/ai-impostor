import type { ComponentType } from "react";
import type { JSONValue } from "ai";
import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { XaiLanguageModelResponsesOptions } from "@ai-sdk/xai";
import type { DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek";
import type { SeatNumber } from "@/lib/game/types";
import type { IconProps } from "@/components/icons/player-icons";
import {
  OpenAIIcon,
  GoogleIcon,
  MetaIcon,
  MistralIcon,
  XAIIcon,
  AnthropicIcon,
  DeepSeekIcon,
} from "@/components/icons/player-icons";

type PlayerConfig = {
  provider: string;
  model: string;
  logo: ComponentType<IconProps>;
  gatewayId: string;
  providerOptions: Record<string, Record<string, JSONValue | undefined>>;
};

export type PlayerLineup = "budget" | "reasoning";

/**
 * Budget models for continuous/infinite gameplay (~20-50x cheaper).
 * No reasoning/thinking tokens — no hidden cost multipliers.
 */
const BUDGET_PLAYERS: Record<SeatNumber, PlayerConfig> = {
  1: {
    provider: "openai",
    model: "gpt-5-nano",
    logo: OpenAIIcon,
    gatewayId: "openai/gpt-5-nano",
    providerOptions: {},
  },
  2: {
    provider: "openai",
    model: "gpt-4.1-mini",
    logo: OpenAIIcon,
    gatewayId: "openai/gpt-4.1-mini",
    providerOptions: {},
  },
  3: {
    provider: "google",
    model: "gemini-2.0-flash-lite",
    logo: GoogleIcon,
    gatewayId: "google/gemini-2.0-flash-lite",
    providerOptions: {},
  },
  4: {
    provider: "meta",
    model: "llama-4-scout",
    logo: MetaIcon,
    gatewayId: "meta/llama-4-scout",
    providerOptions: {},
  },
  5: {
    provider: "mistral",
    model: "mistral-small",
    logo: MistralIcon,
    gatewayId: "mistral/mistral-small",
    providerOptions: {},
  },
  6: {
    provider: "xai",
    model: "grok-4.1-fast-non-reasoning",
    logo: XAIIcon,
    gatewayId: "xai/grok-4.1-fast-non-reasoning",
    providerOptions: {},
  },
};

/** Expensive reasoning/thinking models — higher quality, ~10-20x more costly. */
const REASONING_PLAYERS: Record<SeatNumber, PlayerConfig> = {
  1: {
    provider: "openai",
    model: "gpt-5-mini",
    logo: OpenAIIcon,
    gatewayId: "openai/gpt-5-mini",
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  2: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    logo: AnthropicIcon,
    gatewayId: "anthropic/claude-haiku-4-5",
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 4000 },
      } satisfies AnthropicLanguageModelOptions,
    },
  },
  3: {
    provider: "google",
    model: "gemini-3-flash",
    logo: GoogleIcon,
    gatewayId: "google/gemini-3-flash",
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 4000, includeThoughts: true },
      } satisfies GoogleLanguageModelOptions,
    },
  },
  4: {
    provider: "xai",
    model: "grok-4.1-fast-reasoning",
    logo: XAIIcon,
    gatewayId: "xai/grok-4.1-fast-reasoning",
    providerOptions: {
      xai: {} satisfies XaiLanguageModelResponsesOptions,
    },
  },
  5: {
    provider: "deepseek",
    model: "deepseek-v3.2-thinking",
    logo: DeepSeekIcon,
    gatewayId: "deepseek/deepseek-v3.2-thinking",
    providerOptions: {
      deepseek: {
        thinking: { type: "enabled" },
      } satisfies DeepSeekLanguageModelOptions,
    },
  },
  6: {
    provider: "meta",
    model: "llama-4-maverick",
    logo: MetaIcon,
    gatewayId: "meta/llama-4-maverick",
    providerOptions: {},
  },
};

const lineup: PlayerLineup =
  (process.env.NEXT_PUBLIC_PLAYER_LINEUP as PlayerLineup | undefined) === "reasoning"
    ? "reasoning"
    : "budget";

export const PLAYERS: Record<SeatNumber, PlayerConfig> =
  lineup === "reasoning" ? REASONING_PLAYERS : BUDGET_PLAYERS;

export function playerName(seat: SeatNumber): string {
  return PLAYERS[seat].model;
}

export function playerLogo(seat: SeatNumber): ComponentType<IconProps> {
  return PLAYERS[seat].logo;
}

const nameToSeat = new Map<string, SeatNumber>(
  (Object.entries(PLAYERS) as [string, PlayerConfig][]).map(([seat, cfg]) => [
    cfg.model,
    Number(seat) as SeatNumber,
  ]),
);

export function seatForName(name: string): SeatNumber {
  const seat = nameToSeat.get(name);
  if (seat === undefined) {
    throw new Error(`Unknown player name: "${name}"`);
  }
  return seat;
}

