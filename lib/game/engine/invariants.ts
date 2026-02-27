import type { GameState } from "@/lib/game/state";
import { PLAYER_COUNT, ROLE_COUNTS } from "@/lib/game/types";

import { getSeatRoleCounts } from "@/lib/game/engine/resolution";

export function assertSetupInvariants(state: GameState): void {
  if (state.seatOrder.length !== PLAYER_COUNT) {
    throw new Error(`Invalid seatOrder length: expected ${PLAYER_COUNT}, got ${state.seatOrder.length}.`);
  }
  if (state.aliveSeats.length !== PLAYER_COUNT) {
    throw new Error(`Invalid aliveSeats length: expected ${PLAYER_COUNT}, got ${state.aliveSeats.length}.`);
  }

  const counts = getSeatRoleCounts(state.rolesBySeat);
  if (
    counts.civilian !== ROLE_COUNTS.civilian ||
    counts.impostor !== ROLE_COUNTS.impostor ||
    counts.mr_white !== ROLE_COUNTS.mr_white
  ) {
    throw new Error(
      `Role assignment mismatch. Expected 4/1/1, got civilians=${counts.civilian}, impostor=${counts.impostor}, mr_white=${counts.mr_white}.`,
    );
  }
}
