import { appendGameEvent, assertPhase, assertSeatAlive, type GameState } from "@/lib/game/state";
import type { Clue, DiscussionMessage, Vote } from "@/lib/game/types";

import {
  DEFAULT_DISCUSSION_PASSES,
  type ClueSubmission,
  type DiscussionSubmission,
  type TimestampFactory,
  type VoteSubmission,
} from "@/lib/game/engine/types";
import {
  assertActorTurn,
  cloneCluesByRound,
  cloneDiscussionByRound,
  cloneVotesByRound,
  orderedAliveSeats,
  timestamp,
} from "@/lib/game/engine/utils";

export function submitClue(state: GameState, input: ClueSubmission, now?: TimestampFactory): GameState {
  assertPhase(state, ["clue"]);
  assertSeatAlive(state, input.seat);

  const roundClues = state.cluesByRound[state.currentRound] ?? [];
  assertActorTurn(
    state,
    input.seat,
    roundClues.map((clue) => clue.seat),
  );

  const clue: Clue = {
    seat: input.seat,
    text: input.text,
  };

  const nextState: GameState = {
    ...state,
    cluesByRound: {
      ...cloneCluesByRound(state.cluesByRound),
      [state.currentRound]: [...roundClues, clue],
    },
  };

  const aliveCount = orderedAliveSeats(state).length;
  if (roundClues.length + 1 >= aliveCount) {
    nextState.currentPhase = "discussion";
    nextState.discussionPass = 1;
  }

  return appendGameEvent(nextState, {
    type: "clue_submitted",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    clue,
  });
}

export function submitDiscussionMessage(
  state: GameState,
  input: DiscussionSubmission,
  maxDiscussionPasses = DEFAULT_DISCUSSION_PASSES,
  now?: TimestampFactory,
): GameState {
  assertPhase(state, ["discussion"]);
  assertSeatAlive(state, input.seat);
  if (!Number.isInteger(maxDiscussionPasses) || maxDiscussionPasses <= 0) {
    throw new Error("maxDiscussionPasses must be a positive integer.");
  }

  const roundMessages = state.discussionByRound[state.currentRound] ?? [];
  const currentPassMessages = roundMessages.filter((message) => message.pass === state.discussionPass);

  assertActorTurn(
    state,
    input.seat,
    currentPassMessages.map((message) => message.seat),
  );

  const message: DiscussionMessage = {
    seat: input.seat,
    pass: state.discussionPass,
    text: input.text,
  };

  const nextState: GameState = {
    ...state,
    discussionByRound: {
      ...cloneDiscussionByRound(state.discussionByRound),
      [state.currentRound]: [...roundMessages, message],
    },
  };

  const aliveCount = orderedAliveSeats(state).length;
  const passComplete = currentPassMessages.length + 1 >= aliveCount;
  if (passComplete) {
    if (state.discussionPass >= maxDiscussionPasses) {
      nextState.currentPhase = "vote";
    } else {
      nextState.discussionPass += 1;
    }
  }

  return appendGameEvent(nextState, {
    type: "discussion_message",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    message,
  });
}

export function submitVote(state: GameState, input: VoteSubmission, now?: TimestampFactory): GameState {
  assertPhase(state, ["vote"]);
  assertSeatAlive(state, input.voterSeat);
  assertSeatAlive(state, input.targetSeat);

  const roundVotes = state.votesByRound[state.currentRound] ?? [];
  assertActorTurn(
    state,
    input.voterSeat,
    roundVotes.map((vote) => vote.voterSeat),
  );

  const vote: Vote = {
    voterSeat: input.voterSeat,
    targetSeat: input.targetSeat,
  };

  const nextState: GameState = {
    ...state,
    votesByRound: {
      ...cloneVotesByRound(state.votesByRound),
      [state.currentRound]: [...roundVotes, vote],
    },
  };

  const aliveCount = orderedAliveSeats(state).length;
  if (roundVotes.length + 1 >= aliveCount) {
    nextState.currentPhase = "elimination";
  }

  return appendGameEvent(nextState, {
    type: "vote_cast",
    gameId: state.gameId,
    round: state.currentRound,
    at: timestamp(now ?? (() => new Date().toISOString())),
    vote,
  });
}
