import type { GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";
import type { Role } from "@/lib/game/types";

import {
  applyElimination,
  createInitialGameState,
  createSeededRng,
  orderedAliveSeats,
  resolveMrWhiteGuess,
  resolveRound,
  submitClue,
  submitDiscussionMessage,
  submitVote,
} from "@/lib/game/engine";

const WORD_PAIR = { civilianWord: "Ocean", impostorWord: "River" };

function createNowFactory(): () => string {
  let tick = 0;
  return () => {
    const totalSeconds = tick * 3;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    tick += 1;
    return `2026-01-01T14:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000Z`;
  };
}

const CIVILIAN_CLUES = [
  "Vast blue expanse",
  "Salty and deep",
  "Crashing on the shore",
  "Pacific to Atlantic",
];

function clueText(role: Role, civilianIndex: number): string {
  if (role === "civilian") return CIVILIAN_CLUES[civilianIndex % CIVILIAN_CLUES.length];
  if (role === "impostor") return "Steady current";
  return "Quite natural";
}

const DISCUSSION_R1_P1 = [
  "Some clues felt a bit off. Anyone else notice?",
  "Interesting round. A couple of answers stood out.",
  "I noticed one clue didn't quite fit the pattern.",
  "Hard to tell yet. Let's see what others think.",
  "My answer was straightforward. Can everyone say the same?",
  "One answer seemed oddly vague to me.",
];

const DISCUSSION_R1_P2 = [
  "I'm fairly confident now. Ready to vote.",
  "Agreed — let's not split the vote.",
  "Focusing my vote on the vaguest clue.",
  "Time to decide. Going with my gut.",
  "I have a strong feeling about one player.",
  "I'll follow the group consensus here.",
];

const DISCUSSION_R2_P1 = [
  "Good progress. Now let's find the impostor.",
  "The clues should be clearer with fewer players.",
  "I noticed something suspicious this round.",
  "Pay attention to who's being too careful.",
  "Nice work last round, team.",
];

const DISCUSSION_R2_P2 = [
  "I'm confident this time.",
  "Let's finish this. I think I know who it is.",
  "Agreed on the target.",
  "Voting with conviction.",
  "Time to end the game.",
];

export type MockSnapshot = {
  label: string;
  description: string;
  state: GameState;
};

function generateSnapshots(): MockSnapshot[] {
  const now = createNowFactory();
  const snapshots: MockSnapshot[] = [];

  let state = createInitialGameState({
    gameId: "mock-game-1",
    wordPair: WORD_PAIR,
    rng: createSeededRng(42),
    now,
  });

  snapshots.push({
    label: "After Setup",
    description: "Game just started, waiting for first clue",
    state,
  });

  const alive = orderedAliveSeats(state);
  const mrWhiteSeat = alive.find((s) => state.rolesBySeat[s] === "mr_white")!;
  const impostorSeat = alive.find((s) => state.rolesBySeat[s] === "impostor")!;

  // --- Round 1: Clues ---
  let civilianIdx = 0;
  for (let i = 0; i < 3; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    if (role === "civilian") civilianIdx++;
    state = submitClue(state, { seat, text: clueText(role, civilianIdx - (role === "civilian" ? 1 : 0)) }, now);
  }

  snapshots.push({
    label: "Mid-Clue",
    description: "Three players have given clues",
    state,
  });

  for (let i = 3; i < alive.length; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    if (role === "civilian") civilianIdx++;
    state = submitClue(state, { seat, text: clueText(role, civilianIdx - (role === "civilian" ? 1 : 0)) }, now);
  }

  // --- Round 1: Discussion pass 1 ---
  for (let i = 0; i < alive.length; i++) {
    state = submitDiscussionMessage(state, { seat: alive[i], text: DISCUSSION_R1_P1[i] }, 2, now);
  }

  // --- Round 1: Discussion pass 2 (partial) ---
  for (let i = 0; i < 3; i++) {
    state = submitDiscussionMessage(state, { seat: alive[i], text: DISCUSSION_R1_P2[i] }, 2, now);
  }

  snapshots.push({
    label: "Mid-Discussion",
    description: "Second discussion pass underway",
    state,
  });

  for (let i = 3; i < alive.length; i++) {
    state = submitDiscussionMessage(state, { seat: alive[i], text: DISCUSSION_R1_P2[i] }, 2, now);
  }

  // --- Round 1: Votes (partial) ---
  for (let i = 0; i < 3; i++) {
    state = submitVote(state, { voterSeat: alive[i], targetSeat: mrWhiteSeat }, now);
  }

  snapshots.push({
    label: "Mid-Vote",
    description: "Three votes cast, three remaining",
    state,
  });

  for (let i = 3; i < alive.length; i++) {
    state = submitVote(state, { voterSeat: alive[i], targetSeat: mrWhiteSeat }, now);
  }

  // --- Round 1: Elimination ---
  const resolved = resolveRound(state, now);
  state = resolved.state;
  state = applyElimination(state, resolved.result, now);

  snapshots.push({
    label: "Elimination",
    description: `${playerName(mrWhiteSeat)} has been eliminated`,
    state,
  });

  // --- Mr. White guess ---
  state = resolveMrWhiteGuess(state, "Lake", now);

  snapshots.push({
    label: "Mr. White Guess",
    description: "Mr. White guessed wrong — the game continues",
    state,
  });

  // --- Round 2: Fast forward ---
  const alive2 = orderedAliveSeats(state);
  civilianIdx = 0;
  for (const seat of alive2) {
    const role = state.rolesBySeat[seat];
    if (role === "civilian") civilianIdx++;
    state = submitClue(state, { seat, text: clueText(role, civilianIdx - (role === "civilian" ? 1 : 0)) }, now);
  }
  for (let i = 0; i < alive2.length; i++) {
    state = submitDiscussionMessage(state, { seat: alive2[i], text: DISCUSSION_R2_P1[i] }, 2, now);
  }
  for (let i = 0; i < alive2.length; i++) {
    state = submitDiscussionMessage(state, { seat: alive2[i], text: DISCUSSION_R2_P2[i] }, 2, now);
  }
  for (const seat of alive2) {
    state = submitVote(state, { voterSeat: seat, targetSeat: impostorSeat }, now);
  }
  const resolved2 = resolveRound(state, now);
  state = resolved2.state;
  state = applyElimination(state, resolved2.result, now);

  snapshots.push({
    label: "Game Over",
    description: "Civilians win! Both special roles eliminated",
    state,
  });

  return snapshots;
}

export const mockSnapshots = generateSnapshots();

export const afterSetup = mockSnapshots[0].state;
export const midClue = mockSnapshots[1].state;
export const midDiscussion = mockSnapshots[2].state;
export const midVote = mockSnapshots[3].state;
export const elimination = mockSnapshots[4].state;
export const mrWhiteGuess = mockSnapshots[5].state;
export const finished = mockSnapshots[6].state;
