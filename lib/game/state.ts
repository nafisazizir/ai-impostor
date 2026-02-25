import type {
  Clue,
  DiscussionMessage,
  EliminationResult,
  GameOutcome,
  GamePhase,
  Role,
  RolesBySeat,
  SeatNumber,
  Vote,
  VoteTally,
  WordPair,
} from "@/lib/game/types";

export type GameEventBase = {
  gameId: string;
  round: number;
  at: string;
};

export type GameStartedEvent = GameEventBase & {
  type: "game_started";
  seatOrder: SeatNumber[];
  rolesBySeat: RolesBySeat;
  wordPair: WordPair;
};

export type ClueSubmittedEvent = GameEventBase & {
  type: "clue_submitted";
  clue: Clue;
};

export type DiscussionMessageEvent = GameEventBase & {
  type: "discussion_message";
  message: DiscussionMessage;
};

export type VoteCastEvent = GameEventBase & {
  type: "vote_cast";
  vote: Vote;
};

export type RoundResolvedEvent = GameEventBase & {
  type: "round_resolved";
  tally: VoteTally;
  elimination: EliminationResult;
};

export type PlayerEliminatedEvent = GameEventBase & {
  type: "player_eliminated";
  eliminatedSeat: SeatNumber;
  revealedRole: Role;
};

export type MrWhiteGuessMadeEvent = GameEventBase & {
  type: "mr_white_guess_made";
  seat: SeatNumber;
  guess: string;
  wasCorrect: boolean;
};

export type GameFinishedEvent = GameEventBase & {
  type: "game_finished";
  outcome: GameOutcome;
};

export type GameEvent =
  | GameStartedEvent
  | ClueSubmittedEvent
  | DiscussionMessageEvent
  | VoteCastEvent
  | RoundResolvedEvent
  | PlayerEliminatedEvent
  | MrWhiteGuessMadeEvent
  | GameFinishedEvent;

export type GameState = {
  gameId: string;
  currentRound: number;
  currentPhase: GamePhase;
  discussionPass: number;
  createdAt: string;
  updatedAt: string;
  seatOrder: SeatNumber[];
  rolesBySeat: RolesBySeat;
  aliveSeats: SeatNumber[];
  cluesByRound: Record<number, Clue[]>;
  discussionByRound: Record<number, DiscussionMessage[]>;
  votesByRound: Record<number, Vote[]>;
  latestTallyByRound: Record<number, VoteTally | undefined>;
  eliminations: {
    round: number;
    seat: SeatNumber;
    role: Role;
  }[];
  wordPair: WordPair;
  outcome: GameOutcome | null;
  events: GameEvent[];
};

export function appendGameEvent(state: GameState, event: GameEvent): GameState {
  if (event.gameId !== state.gameId) {
    throw new Error(
      `Event gameId mismatch. Expected ${state.gameId}, received ${event.gameId}.`,
    );
  }

  return {
    ...state,
    updatedAt: event.at,
    events: [...state.events, event],
  };
}

export function assertPhase(state: GameState, allowedPhases: readonly GamePhase[]): void {
  if (!allowedPhases.includes(state.currentPhase)) {
    throw new Error(
      `Invalid phase transition from "${state.currentPhase}". Allowed: ${allowedPhases.join(", ")}.`,
    );
  }
}

export function assertSeatAlive(state: GameState, seat: SeatNumber): void {
  if (!state.aliveSeats.includes(seat)) {
    throw new Error(`Seat ${seat} is eliminated and cannot act.`);
  }
}

export function hasEventType<TType extends GameEvent["type"]>(
  state: GameState,
  type: TType,
): boolean {
  return state.events.some((event) => event.type === type);
}
