import type { GameState } from "@/lib/game/state";
import type { SeatNumber } from "@/lib/game/types";
import { deriveSeatAction, deriveVoteCounts } from "@/lib/game/ui-helpers";

import { SeatCard } from "@/components/game/seat-card";

export function SeatRing({
  state,
  activeSeat,
}: {
  state: GameState;
  activeSeat: SeatNumber | null;
}) {
  const voteCounts = deriveVoteCounts(state);

  // Mr. White who won by correct guess should appear alive on the finished screen
  const mrWhiteWon =
    state.outcome?.winner === "mr_white" &&
    state.outcome.reason === "final_guess_correct";

  // Determine the winning role for green name highlight
  const winnerRole = state.outcome?.winner === "civilians" ? "civilian"
    : state.outcome?.winner === "impostor" ? "impostor"
    : state.outcome?.winner === "mr_white" ? "mr_white"
    : null;

  return (
    <div className="grid max-w-lg grid-cols-3 gap-3 lg:gap-4">
      {state.seatOrder.map((seat) => {
        const role = state.rolesBySeat[seat];
        const isAlive =
          state.aliveSeats.includes(seat) ||
          (mrWhiteWon && role === "mr_white");

        return (
          <SeatCard
            key={seat}
            seat={seat}
            role={role}
            isAlive={isAlive}
            isActive={activeSeat === seat}
            isRevealed={
              state.currentPhase === "finished" ||
              state.eliminations.some((e) => e.seat === seat)
            }
            isWinner={
              state.currentPhase === "finished" &&
              isAlive &&
              role === winnerRole
            }
            lastAction={deriveSeatAction(state, seat)}
            voteCount={voteCounts?.[seat] ?? 0}
          />
        );
      })}
    </div>
  );
}
