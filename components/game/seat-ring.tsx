import type { GameState } from "@/lib/game/state";
import type { Role, SeatNumber } from "@/lib/game/types";
import { deriveSeatAction, deriveVoteCounts } from "@/lib/game/ui-helpers";

import { SeatCard } from "@/components/game/seat-card";

const WINNER_TO_ROLE: Record<string, Role> = {
  civilians: "civilian",
  impostor: "impostor",
  mr_white: "mr_white",
};

export function SeatRing({
  state,
  activeSeat,
}: {
  state: GameState;
  activeSeat: SeatNumber | null;
}) {
  const voteCounts = deriveVoteCounts(state);

  const mrWhiteWon =
    state.outcome?.winner === "mr_white" &&
    state.outcome.reason === "final_guess_correct";

  const winnerRole = state.outcome ? WINNER_TO_ROLE[state.outcome.winner] ?? null : null;

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
