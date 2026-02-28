import { gateway } from "ai";

import type { SeatNumber } from "@/lib/game/types";

const PLAYER_MODELS: Record<SeatNumber, ReturnType<typeof gateway>> = {
  1: gateway("openai/gpt-5-mini"),
  2: gateway("anthropic/claude-sonnet-4.6"),
  3: gateway("google/gemini-2.5-flash"),
  4: gateway("xai/grok-4.1-fast-reasoning"),
  5: gateway("deepseek/deepseek-v3.2-thinking"),
  6: gateway("moonshotai/kimi-k2.5"),
};

const HOST_MODEL = gateway("openai/gpt-4.1-mini");

export function playerModel(player: SeatNumber) {
  return PLAYER_MODELS[player];
}

export function hostModel() {
  return HOST_MODEL;
}

export function playerModelId(player: SeatNumber): string {
  const info = PLAYER_MODELS[player];
  return info.modelId;
}
