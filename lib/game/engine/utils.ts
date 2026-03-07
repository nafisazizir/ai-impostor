import type { GameState } from "@/lib/game/state";
import type { RolesBySeat, SeatNumber } from "@/lib/game/types";

import type { Rng, TimestampFactory } from "@/lib/game/engine/types";

export const defaultNow: TimestampFactory = () => new Date().toISOString();

export function orderedAliveSeats(state: GameState): SeatNumber[] {
  return state.seatOrder.filter((seat) => state.aliveSeats.includes(seat));
}

export function nextExpectedSeat(state: GameState, actedSeats: SeatNumber[]): SeatNumber {
  const ordered = orderedAliveSeats(state);
  const expected = ordered[actedSeats.length];
  if (!expected) {
    throw new Error("All alive seats have already acted in this phase.");
  }

  return expected;
}

export function assertActorTurn(state: GameState, seat: SeatNumber, actedSeats: SeatNumber[]): void {
  const expected = nextExpectedSeat(state, actedSeats);
  if (seat !== expected) {
    throw new Error(`Out-of-order action. Expected seat ${expected}, received ${seat}.`);
  }
}

export function shuffleInPlace<T>(values: T[], rng: Rng): T[] {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

export function cloneRoundMap<T>(map: Record<number, T[]>): Record<number, T[]> {
  return Object.fromEntries(
    Object.entries(map).map(([round, items]) => [Number(round), [...items]]),
  );
}

export function assignRoles(
  seatOrder: SeatNumber[],
  rolePool: Array<RolesBySeat[SeatNumber]>,
  rng: Rng,
): RolesBySeat {
  const shuffledRoles = shuffleInPlace([...rolePool], rng);

  return seatOrder.reduce<RolesBySeat>((acc, seat, index) => {
    acc[seat] = shuffledRoles[index];
    return acc;
  }, {} as RolesBySeat);
}
