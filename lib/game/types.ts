export const PLAYER_COUNT = 6 as const;

export const ROLE_COUNTS = {
  civilian: 4,
  impostor: 1,
  mr_white: 1,
} as const;

export const GAME_PHASES = [
  "setup",
  "clue",
  "discussion",
  "vote",
  "elimination",
  "finished",
] as const;

export const WINNERS = ["civilians", "impostor", "mr_white"] as const;

export type Role = keyof typeof ROLE_COUNTS;
export type SeatNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type GamePhase = (typeof GAME_PHASES)[number];
export type Winner = (typeof WINNERS)[number];

export type SeatsByRole = Record<Role, SeatNumber[]>;
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

export type MrWhiteGuessResult = {
  guess: string;
  wasCorrect: boolean;
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
    };

export function isSeatNumber(value: number): value is SeatNumber {
  return Number.isInteger(value) && value >= 1 && value <= PLAYER_COUNT;
}

export function toSeatNumber(value: number): SeatNumber {
  if (!isSeatNumber(value)) {
    throw new Error(`Invalid seat number: ${value}. Expected an integer from 1 to 6.`);
  }

  return value;
}
