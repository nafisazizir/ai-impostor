export const PLAYER_COUNT = 6 as const;

export const ROLE_COUNTS = {
  civilian: 4,
  impostor: 1,
  mr_white: 1,
} as const;

export type Role = keyof typeof ROLE_COUNTS;
export type SeatNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type GamePhase = "setup" | "clue" | "discussion" | "vote" | "elimination" | "finished";

export type RolesBySeat = Record<SeatNumber, Role>;

export type WordPair = {
  civilianWord: string;
  impostorWord: string;
};

export type Clue = {
  seat: SeatNumber;
  text: string;
};

export type DiscussionMessage = {
  seat: SeatNumber;
  pass: number;
  text: string;
};

export type Vote = {
  voterSeat: SeatNumber;
  targetSeat: SeatNumber;
};

export type VoteTally = Record<SeatNumber, number>;

export type EliminationResult =
  | {
      eliminatedSeat: null;
      reason: "tie";
    }
  | {
      eliminatedSeat: SeatNumber;
      reason: "plurality";
    };

export type GameOutcome =
  | {
      winner: "civilians";
      reason: "both_special_roles_eliminated";
    }
  | {
      winner: "impostor";
      reason: "reached_final_two";
    }
  | {
      winner: "mr_white";
      reason: "final_guess_correct";
    }
  | {
      winner: "mr_white";
      reason: "reached_final_two";
    };

export type ThinkingEntry = {
  seat: SeatNumber;
  phase: GamePhase;
  round: number;
  pass?: number;
  at: string;
  text: string;
  actionSummary: string;
};
