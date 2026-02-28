import type { GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";
import type { Role, SeatNumber, GamePhase, ThinkingEntry } from "@/lib/game/types";

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

const CLUE_REASONING: Record<Role, string[]> = {
  civilian: [
    `I know the word is "Ocean." I need to signal that\nwithout giving it away to the impostor.\nSomething evocative but not too literal…\n"Vast blue expanse" — that feels safe.\nIt could hint at a lake too, but the depth\nand scale should resonate with fellow civilians.`,
    `My word is "Ocean." The first clues\nwere solid — "salty" and "deep" both track.\nI want to reinforce that theme.\n"Crashing on the shore" is specific enough\nthat the impostor would struggle to fake it\nbut vague enough to not spell it out.`,
    `Okay, "Ocean" again. Two clues down and\nthey all feel consistent to me.\nI'll go with geography: "Pacific to Atlantic."\nThat's a strong civilian signal without\nsaying the word directly. Should help\nus identify anyone who's off.`,
    `Thinking about "Ocean"… the other clues\nhave been great so far.\nI need to add something complementary.\n"Salty and deep" — it's a classic association.\nShould pair well with what's been said\nand keep the civilian consensus tight.`,
  ],
  impostor: [
    `My word is "River" but I need to blend in.\nThe civilians clearly have something related to water.\nI'll stay vague: "Steady current" works for both\nrivers and oceans. Not too specific,\nnot too generic. Just enough to pass\nwithout raising suspicion.`,
  ],
  mr_white: [
    `I have no idea what the word is.\nI need to say something that sounds plausible.\n"Quite natural" is vague enough to fit\nalmost anything nature-related.\nHopefully the others won't press me on it.\nJust need to survive this round.`,
  ],
};

const DISCUSSION_REASONING: Record<Role, string[]> = {
  civilian: [
    `Reviewing all the clues carefully…\nMost of them clearly point to something vast\nand oceanic. But one clue felt off —\n"Quite natural" is suspiciously vague.\nIt could apply to literally anything.\nI think that player might be Mr. White.`,
    `The discussion is going well.\nSeems like most people caught the odd clue out.\nI'm fairly confident about who to vote for.\nLet's consolidate and not split the vote —\nthat's how the impostor survives.`,
    `Second round now, fewer players.\nThe clues should be even more telling.\nI'm watching for anyone who's being\ntoo careful or too generic with their words.\nThe impostor has to be sweating.`,
    `Alright, I think I've identified the impostor.\nTheir clue was close but not quite right —\n"Steady current" works for a river,\nnot really for the ocean in context.\nTime to vote with conviction.`,
  ],
  impostor: [
    `I need to deflect attention away from myself.\nThe clue about "natural" was pretty weak —\nI should subtly point suspicion there.\n"Some clues felt off" — that's safe enough.\nI'm blending in with the group consensus\nwhile steering them toward Mr. White.`,
    `Good, they're focused on the Mr. White player.\nI just need to keep agreeing and voting\nwith the majority. Don't stand out.\nDon't say anything too specific about the word.\nJust nod along and survive another round.`,
  ],
  mr_white: [
    `I'm in trouble. I have no word and my clue\nwas vague. People are getting suspicious.\nI need to act confident and point fingers\nat someone else. Maybe if I seem certain\nabout who the impostor is, they'll think\nI'm a civilian. Worth a shot.`,
    `Okay, things aren't looking good for me.\nI'll try to blend in with whatever\nthe group consensus seems to be.\nIf I go down, I need to guess the word.\nFrom the clues I've heard… water-related,\nvast, salty… could be "Ocean" or "Sea."`,
  ],
};

const VOTE_REASONING: Record<Role, string[]> = {
  civilian: [
    `The evidence points clearly to one player.\nTheir clue didn't fit the pattern at all.\nVoting them out is the safest play.\nWe need to eliminate the unknowns first\nbefore the impostor can manipulate us\ninto voting out our own.`,
    `Round 2 vote. I'm more confident now.\n"Steady current" was a decent cover\nbut it doesn't quite fit "Ocean."\nI'm voting for the impostor this time.\nLet's close this out for the civilians.`,
  ],
  impostor: [
    `Voting with the group to stay hidden.\nIf Mr. White goes down, that's fine by me —\none less threat, and I look like a team player.\nI just need to survive until the final two.\nKeep playing the loyal civilian role.`,
    `This is my last chance to hide.\nI'll vote with the majority again,\nbut I think they're onto me now.\nThe clues are getting too specific\nfor me to keep faking it.`,
  ],
  mr_white: [
    `I'm voting for whoever seems most suspicious\nto the group. If I go along with them,\nmaybe I'll survive one more round.\nBut if I'm eliminated, I need to be ready\nwith my word guess. "Ocean" seems right\nbased on all the clues about saltwater.`,
  ],
};

const MR_WHITE_GUESS_REASONING = `I've been eliminated. Time to guess the word.\nFrom the clues: "vast blue expanse," "salty and deep,"\n"crashing on the shore," "Pacific to Atlantic."\nAll water-related, all suggesting something huge.\nI'm torn between "Ocean" and "Sea"…\nI'll go with "Lake" — wait, no, the clues\nare too grand for a lake. But it's my gut.\nFinal answer: "Lake."`;

function pickReasoning(pool: string[], index: number): string {
  return pool[index % pool.length];
}

type ThinkingOpts = {
  seat: SeatNumber;
  phase: GamePhase;
  round: number;
  text: string;
  at: string;
  actionSummary: string;
  pass?: number;
};

function thinkingEntry(opts: ThinkingOpts): ThinkingEntry {
  const entry: ThinkingEntry = {
    seat: opts.seat,
    phase: opts.phase,
    round: opts.round,
    at: opts.at,
    text: opts.text,
    actionSummary: opts.actionSummary,
  };
  if (opts.pass !== undefined) entry.pass = opts.pass;
  return entry;
}

export type MockSnapshot = {
  label: string;
  description: string;
  state: GameState;
  thinking: ThinkingEntry[];
  newThinkingStartIndex: number;
};

function pushSnapshot(
  snapshots: MockSnapshot[],
  label: string,
  description: string,
  state: GameState,
  thinking: ThinkingEntry[],
  prevLength: number,
): void {
  snapshots.push({
    label,
    description,
    state,
    thinking: [...thinking],
    newThinkingStartIndex: prevLength,
  });
}

function generateSnapshots(): MockSnapshot[] {
  const now = createNowFactory();
  const snapshots: MockSnapshot[] = [];
  let thinking: ThinkingEntry[] = [];

  let state = createInitialGameState({
    gameId: "mock-game-1",
    wordPair: WORD_PAIR,
    rng: createSeededRng(42),
    now,
  });

  pushSnapshot(snapshots, "After Setup", "Game just started, waiting for first clue", state, thinking, 0);

  const alive = orderedAliveSeats(state);
  const mrWhiteSeat = alive.find((s) => state.rolesBySeat[s] === "mr_white")!;
  const impostorSeat = alive.find((s) => state.rolesBySeat[s] === "impostor")!;

  // Track per-role reasoning index
  const clueIdx: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };
  const discIdx: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };
  const voteIdx: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };

  // --- Round 1: Clues ---
  let civilianIdx = 0;
  for (let i = 0; i < 3; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    if (role === "civilian") civilianIdx++;
    const text = clueText(role, civilianIdx - (role === "civilian" ? 1 : 0));
    thinking = [...thinking, thinkingEntry({
      seat, phase: "clue", round: 1, at: ts,
      text: pickReasoning(CLUE_REASONING[role], clueIdx[role]++),
      actionSummary: `Gave clue: "${text}"`,
    })];
    state = submitClue(state, { seat, text }, () => ts);
  }

  let prev = thinking.length;
  pushSnapshot(snapshots, "Mid-Clue", "Three players have given clues", state, thinking, prev - 3);

  for (let i = 3; i < alive.length; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    if (role === "civilian") civilianIdx++;
    const text = clueText(role, civilianIdx - (role === "civilian" ? 1 : 0));
    thinking = [...thinking, thinkingEntry({
      seat, phase: "clue", round: 1, at: ts,
      text: pickReasoning(CLUE_REASONING[role], clueIdx[role]++),
      actionSummary: `Gave clue: "${text}"`,
    })];
    state = submitClue(state, { seat, text }, () => ts);
  }

  // --- Round 1: Discussion pass 1 ---
  for (let i = 0; i < alive.length; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    const msg = DISCUSSION_R1_P1[i];
    thinking = [...thinking, thinkingEntry({
      seat, phase: "discussion", round: 1, pass: 1, at: ts,
      text: pickReasoning(DISCUSSION_REASONING[role], discIdx[role]++),
      actionSummary: `Said: "${msg}"`,
    })];
    state = submitDiscussionMessage(state, { seat, text: msg }, 2, () => ts);
  }

  // --- Round 1: Discussion pass 2 (partial) ---
  for (let i = 0; i < 3; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    const msg = DISCUSSION_R1_P2[i];
    thinking = [...thinking, thinkingEntry({
      seat, phase: "discussion", round: 1, pass: 2, at: ts,
      text: pickReasoning(DISCUSSION_REASONING[role], discIdx[role]++),
      actionSummary: `Said: "${msg}"`,
    })];
    state = submitDiscussionMessage(state, { seat, text: msg }, 2, () => ts);
  }

  prev = thinking.length;
  pushSnapshot(snapshots, "Mid-Discussion", "Second discussion pass underway", state, thinking, prev - 3);

  for (let i = 3; i < alive.length; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    const msg = DISCUSSION_R1_P2[i];
    thinking = [...thinking, thinkingEntry({
      seat, phase: "discussion", round: 1, pass: 2, at: ts,
      text: pickReasoning(DISCUSSION_REASONING[role], discIdx[role]++),
      actionSummary: `Said: "${msg}"`,
    })];
    state = submitDiscussionMessage(state, { seat, text: msg }, 2, () => ts);
  }

  // --- Round 1: Votes (partial) ---
  for (let i = 0; i < 3; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    thinking = [...thinking, thinkingEntry({
      seat, phase: "vote", round: 1, at: ts,
      text: pickReasoning(VOTE_REASONING[role], voteIdx[role]++),
      actionSummary: `Voted for ${playerName(mrWhiteSeat)}`,
    })];
    state = submitVote(state, { voterSeat: seat, targetSeat: mrWhiteSeat }, () => ts);
  }

  prev = thinking.length;
  pushSnapshot(snapshots, "Mid-Vote", "Three votes cast, three remaining", state, thinking, prev - 3);

  for (let i = 3; i < alive.length; i++) {
    const seat = alive[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    thinking = [...thinking, thinkingEntry({
      seat, phase: "vote", round: 1, at: ts,
      text: pickReasoning(VOTE_REASONING[role], voteIdx[role]++),
      actionSummary: `Voted for ${playerName(mrWhiteSeat)}`,
    })];
    state = submitVote(state, { voterSeat: seat, targetSeat: mrWhiteSeat }, () => ts);
  }

  // --- Round 1: Elimination ---
  const resolved = resolveRound(state, now);
  state = resolved.state;
  state = applyElimination(state, resolved.result, now);

  prev = thinking.length;
  pushSnapshot(snapshots, "Elimination", `${playerName(mrWhiteSeat)} has been eliminated`, state, thinking, prev);

  // --- Mr. White guess ---
  const guessTs = now();
  thinking = [...thinking, thinkingEntry({
    seat: mrWhiteSeat, phase: "elimination", round: 1, at: guessTs,
    text: MR_WHITE_GUESS_REASONING,
    actionSummary: `Guessed: "Lake"`,
  })];
  state = resolveMrWhiteGuess(state, "Lake", () => guessTs);

  prev = thinking.length;
  pushSnapshot(snapshots, "Mr. White Guess", "Mr. White guessed wrong — the game continues", state, thinking, prev - 1);

  // --- Round 2: Clues ---
  const alive2 = orderedAliveSeats(state);
  const clueIdx2: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };
  const discIdx2: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };
  const voteIdx2: Record<Role, number> = { civilian: 0, impostor: 0, mr_white: 0 };

  civilianIdx = 0;
  for (const seat of alive2) {
    const role = state.rolesBySeat[seat];
    const ts = now();
    if (role === "civilian") civilianIdx++;
    const text = clueText(role, civilianIdx - (role === "civilian" ? 1 : 0));
    thinking = [...thinking, thinkingEntry({
      seat, phase: "clue", round: 2, at: ts,
      text: pickReasoning(CLUE_REASONING[role], clueIdx2[role]++),
      actionSummary: `Gave clue: "${text}"`,
    })];
    state = submitClue(state, { seat, text }, () => ts);
  }

  prev = thinking.length;
  pushSnapshot(snapshots, "R2 Clues", "Round 2 clues complete", state, thinking, prev - alive2.length);

  // --- Round 2: Discussion pass 1 ---
  for (let i = 0; i < alive2.length; i++) {
    const seat = alive2[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    const msg = DISCUSSION_R2_P1[i];
    thinking = [...thinking, thinkingEntry({
      seat, phase: "discussion", round: 2, pass: 1, at: ts,
      text: pickReasoning(DISCUSSION_REASONING[role], discIdx2[role]++),
      actionSummary: `Said: "${msg}"`,
    })];
    state = submitDiscussionMessage(state, { seat, text: msg }, 2, () => ts);
  }

  // --- Round 2: Discussion pass 2 ---
  for (let i = 0; i < alive2.length; i++) {
    const seat = alive2[i];
    const role = state.rolesBySeat[seat];
    const ts = now();
    const msg = DISCUSSION_R2_P2[i];
    thinking = [...thinking, thinkingEntry({
      seat, phase: "discussion", round: 2, pass: 2, at: ts,
      text: pickReasoning(DISCUSSION_REASONING[role], discIdx2[role]++),
      actionSummary: `Said: "${msg}"`,
    })];
    state = submitDiscussionMessage(state, { seat, text: msg }, 2, () => ts);
  }

  prev = thinking.length;
  pushSnapshot(snapshots, "R2 Discussion", "Round 2 discussion complete", state, thinking, prev - alive2.length * 2);

  // --- Round 2: Votes ---
  for (const seat of alive2) {
    const role = state.rolesBySeat[seat];
    const ts = now();
    thinking = [...thinking, thinkingEntry({
      seat, phase: "vote", round: 2, at: ts,
      text: pickReasoning(VOTE_REASONING[role], voteIdx2[role]++),
      actionSummary: `Voted for ${playerName(impostorSeat)}`,
    })];
    state = submitVote(state, { voterSeat: seat, targetSeat: impostorSeat }, () => ts);
  }

  prev = thinking.length;
  pushSnapshot(snapshots, "R2 Votes", "Round 2 votes cast", state, thinking, prev - alive2.length);

  // --- Round 2: Elimination → Game Over ---
  const resolved2 = resolveRound(state, now);
  state = resolved2.state;
  state = applyElimination(state, resolved2.result, now);

  prev = thinking.length;
  pushSnapshot(snapshots, "Game Over", "Civilians win! Both special roles eliminated", state, thinking, prev);

  return snapshots;
}

export const mockSnapshots = generateSnapshots();

export const afterSetup = mockSnapshots[0].state;
export const midClue = mockSnapshots[1].state;
export const midDiscussion = mockSnapshots[2].state;
export const midVote = mockSnapshots[3].state;
export const elimination = mockSnapshots[4].state;
export const mrWhiteGuess = mockSnapshots[5].state;
export const r2Clues = mockSnapshots[6].state;
export const r2Discussion = mockSnapshots[7].state;
export const r2Votes = mockSnapshots[8].state;
export const finished = mockSnapshots[9].state;
