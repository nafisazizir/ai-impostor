import type { ComponentType } from "react";
import type { SeatNumber } from "@/lib/game/types";
import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek";
import { type XaiLanguageModelResponsesOptions } from "@ai-sdk/xai";
import type { IconProps } from "@/components/icons/player-icons";
import {
  OpenAIIcon,
  GoogleIcon,
  MetaIcon,
  MistralIcon,
  DeepSeekIcon,
  AnthropicIcon,
  AlibabaIcon,
  XAIIcon,
} from "@/components/icons/player-icons";

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = {
  [key: string]: JSONValue | undefined;
};
type JSONArray = JSONValue[];

type PlayerConfig = {
  provider: string;
  model: string;
  logo: ComponentType<IconProps>;
  gatewayId: string;
  providerOptions: Record<string, JSONObject>;
};

/**
 * Budget models for continuous/infinite gameplay (~20-50x cheaper).
 * No reasoning/thinking tokens — no hidden cost multipliers.
 */
export const PLAYERS: Record<SeatNumber, PlayerConfig> = {
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

/** Original expensive reasoning/thinking models (archived for reference). */
export const ARCHIVED_PLAYERS: Record<SeatNumber, PlayerConfig> = {
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
    model: "claude-sonnet-4.6",
    logo: AnthropicIcon,
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
    logo: GoogleIcon,
    gatewayId: "google/gemini-2.5-flash",
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 4000, includeThoughts: true },
      } satisfies GoogleLanguageModelOptions,
    },
  },
  4: {
    provider: "xai",
    model: "grok-4-fast-reasoning",
    logo: XAIIcon,
    gatewayId: "xai/grok-4-fast-reasoning",
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
    provider: "openai",
    model: "gpt-5.1-codex-mini",
    logo: OpenAIIcon,
    gatewayId: "openai/gpt-5.1-codex-mini",
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
};

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

export function allPlayerNames(): string[] {
  return Object.values(PLAYERS).map((cfg) => cfg.model);
}
