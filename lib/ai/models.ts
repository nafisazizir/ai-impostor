import { gateway } from "ai";

import { PLAYERS } from "@/lib/game/players";
import type { SeatNumber } from "@/lib/game/types";

const HOST_MODEL = gateway("openai/gpt-4.1-mini");

export function playerModel(seat: SeatNumber) {
  return gateway(PLAYERS[seat].gatewayId);
}

export function playerProviderOptions(seat: SeatNumber) {
  return PLAYERS[seat].providerOptions;
}

export function playerModelId(seat: SeatNumber): string {
  return PLAYERS[seat].model;
}

export function hostModel() {
  return HOST_MODEL;
}
