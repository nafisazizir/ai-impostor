import type { GameState } from "@/lib/game/state";
import type { SeatNumber } from "@/lib/game/types";

import { SeatCard } from "@/components/game/seat-card";

export function SeatRing({
  state,
  activeSeat,
}: {
  state: GameState;
  activeSeat: SeatNumber | null;
}) {
  return (
    <div className="grid max-w-lg grid-cols-3 gap-3 lg:gap-4">
      {state.seatOrder.map((seat) => (
        <SeatCard
          key={seat}
          seat={seat}
          role={state.rolesBySeat[seat]}
          isAlive={state.aliveSeats.includes(seat)}
          isActive={activeSeat === seat}
          isRevealed={
            state.currentPhase === "finished" ||
            state.eliminations.some((e) => e.seat === seat)
          }
        />
      ))}
    </div>
  );
}
