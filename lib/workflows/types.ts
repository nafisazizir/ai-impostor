import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, GamePhase } from "@/lib/game/types";

export type GameStreamEvent =
  | { kind: "game:start"; gameId: string }
  | { kind: "snapshot"; snapshot: GameSnapshot }
  | {
      kind: "thinking:start";
      seat: SeatNumber;
      phase: GamePhase;
      round: number;
      pass?: number;
    }
  | { kind: "thinking:delta"; text: string }
  | { kind: "thinking:end"; actionSummary: string }
  | {
      kind: "answer:start";
      seat: SeatNumber;
      actionKind: "clue" | "discussion" | "mr_white_guess";
    }
  | { kind: "answer:delta"; text: string }
  | { kind: "answer:end" }
  | { kind: "game:finished" };
