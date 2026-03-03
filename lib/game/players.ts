import type { ComponentType } from "react";
import type { JSONValue } from "ai";
import type { SeatNumber } from "@/lib/game/types";
import type { IconProps } from "@/components/icons/player-icons";
import {
  OpenAIIcon,
  GoogleIcon,
  MetaIcon,
  MistralIcon,
  XAIIcon,
} from "@/components/icons/player-icons";

type PlayerConfig = {
  provider: string;
  model: string;
  logo: ComponentType<IconProps>;
  gatewayId: string;
  providerOptions: Record<string, Record<string, JSONValue | undefined>>;
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

