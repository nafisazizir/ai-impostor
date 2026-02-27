import type { SeatNumber, WordPair } from "@/lib/game/types";

export type Rng = () => number;

export type TimestampFactory = () => string;

export type EngineOptions = {
  gameId: string;
  wordPair: WordPair;
  rng?: Rng;
  now?: TimestampFactory;
};

export type ClueSubmission = {
  seat: SeatNumber;
  text: string;
};

export type DiscussionSubmission = {
  seat: SeatNumber;
  text: string;
};

export type VoteSubmission = {
  voterSeat: SeatNumber;
  targetSeat: SeatNumber;
};

export const DEFAULT_DISCUSSION_PASSES = 2;
export const INITIAL_ROUND = 1;
export const ALL_SEATS: SeatNumber[] = [1, 2, 3, 4, 5, 6];
