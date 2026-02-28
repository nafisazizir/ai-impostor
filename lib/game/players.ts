import type { SeatNumber } from "@/lib/game/types";

type PlayerInfo = {
  provider: string;
  model: string;
  logo: string;
};

const PLAYERS: Record<SeatNumber, PlayerInfo> = {
  1: { provider: "openai", model: "gpt-5-mini", logo: "/openai.svg" },
  2: { provider: "anthropic", model: "claude-sonnet-4.6", logo: "/anthropic.svg" },
  3: { provider: "google", model: "gemini-2.5-flash", logo: "/google.svg" },
  4: { provider: "xai", model: "grok-4.1-fast-reasoning", logo: "/xai.svg" },
  5: { provider: "deepseek", model: "deepseek-v3.2-thinking", logo: "/deepseek.svg" },
  6: { provider: "moonshotai", model: "kimi-k2.5", logo: "/moonshotai.svg" },
};

export function playerName(seat: SeatNumber): string {
  return PLAYERS[seat].model;
}

export function playerLogo(seat: SeatNumber): string {
  return PLAYERS[seat].logo;
}
