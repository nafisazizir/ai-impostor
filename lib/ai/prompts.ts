import type { GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";
import type { SeatNumber } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";

// ---------------------------------------------------------------------------
// Host prompts
// ---------------------------------------------------------------------------

const WORD_PAIR_CATEGORIES = [
  "fruits",
  "vegetables",
  "animals",
  "birds",
  "sea creatures",
  "musical instruments",
  "sports",
  "board games",
  "card games",
  "bodies of water",
  "weather phenomena",
  "kitchen utensils",
  "fabrics",
  "dances",
  "currencies",
  "gemstones",
  "trees",
  "flowers",
  "desserts",
  "beverages",
  "vehicles",
  "tools",
  "furniture",
  "shoes",
  "hats",
  "capital cities",
  "landmarks",
  "planets or moons",
  "art forms",
  "martial arts",
  "pasta shapes",
  "cheeses",
  "spices",
  "dog breeds",
  "mythological creatures",
];

const WORD_PAIR_EXAMPLES = [
  "Ocean/River",
  "Apple/Pear",
  "Guitar/Violin",
  "Tokyo/Beijing",
  "Coffee/Tea",
  "Chess/Checkers",
  "Ballet/Salsa",
  "Silk/Cotton",
  "Tornado/Hurricane",
  "Diamond/Ruby",
  "Canoe/Kayak",
  "Yoga/Pilates",
  "Baguette/Croissant",
  "Eagle/Hawk",
  "Cinnamon/Nutmeg",
];

function pickRandom<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function hostWordPairSystemPrompt(): string {
  const examples = pickRandom(WORD_PAIR_EXAMPLES, 3).join(", ");

  return `You are the host of a word-based social deduction game called "AI Impostor."

Your job is to generate a pair of related words:
- civilianWord: the word given to the majority (civilians)
- impostorWord: a related but clearly distinct word given to the impostor

Guidelines:
- Both words should belong to the same broad category (e.g., both fruits, both animals, both cities).
- They should be similar enough that vague clues could apply to either, making deception possible.
- They should be different enough that specific clues can distinguish them.
- Use common, widely known English words. Avoid obscure or niche terms.
- Each word should be a single word or very short phrase (1-2 words max).

Examples of good pairs: ${examples}.
Examples of bad pairs: Cat/Quantum (unrelated), Happy/Joyful (too similar), Pneumonoultramicroscopicsilicovolcanoconiosis/Anything (too obscure).`;
}

export function hostWordPairUserPrompt(): string {
  const [category] = pickRandom(WORD_PAIR_CATEGORIES, 1);
  return `Generate a word pair for the next round of AI Impostor. The pair should be from the category: ${category}.`;
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function playerLabel(seat: SeatNumber): string {
  return playerName(seat);
}

export function gameContextSummary(state: GameState, player: SeatNumber): string {
  const lines: string[] = [];
  const alive = orderedAliveSeats(state);

  lines.push(`Round: ${state.currentRound}`);
  lines.push(`Phase: ${state.currentPhase}`);
  lines.push("");

  // Alive players
  lines.push("Alive players:");
  for (const seat of alive) {
    const marker = seat === player ? " (you)" : "";
    lines.push(`  - ${playerLabel(seat)}${marker}`);
  }

  // Eliminated players (with revealed roles)
  if (state.eliminations.length > 0) {
    lines.push("");
    lines.push("Eliminated players:");
    for (const elim of state.eliminations) {
      lines.push(
        `  - ${playerLabel(elim.seat)} — revealed role: ${elim.role} (round ${elim.round})`,
      );
    }
  }

  // History: clues from all rounds
  const roundKeys = Object.keys(state.cluesByRound)
    .map(Number)
    .sort((a, b) => a - b);
  for (const round of roundKeys) {
    const clues = state.cluesByRound[round];
    if (clues && clues.length > 0) {
      lines.push("");
      lines.push(`Round ${round} clues:`);
      for (const clue of clues) {
        lines.push(`  - ${playerLabel(clue.seat)}: "${clue.text}"`);
      }
    }
  }

  // History: discussion from all rounds
  const discRoundKeys = Object.keys(state.discussionByRound)
    .map(Number)
    .sort((a, b) => a - b);
  for (const round of discRoundKeys) {
    const messages = state.discussionByRound[round];
    if (messages && messages.length > 0) {
      lines.push("");
      lines.push(`Round ${round} discussion:`);
      for (const msg of messages) {
        lines.push(`  - [Pass ${msg.pass}] ${playerLabel(msg.seat)}: "${msg.text}"`);
      }
    }
  }

  // History: votes from all rounds
  const voteRoundKeys = Object.keys(state.votesByRound)
    .map(Number)
    .sort((a, b) => a - b);
  for (const round of voteRoundKeys) {
    const votes = state.votesByRound[round];
    if (votes && votes.length > 0) {
      lines.push("");
      lines.push(`Round ${round} votes:`);
      for (const vote of votes) {
        lines.push(
          `  - ${playerLabel(vote.voterSeat)} voted for ${playerLabel(vote.targetSeat)}`,
        );
      }
      const tally = state.latestTallyByRound[round];
      if (tally) {
        const tallyEntries = Object.entries(tally)
          .map(([seat, count]) => `${playerLabel(Number(seat) as SeatNumber)}: ${count}`)
          .join(", ");
        lines.push(`  Tally: ${tallyEntries}`);
      }
    }
  }

  // Mr. White guess results
  const guessEvents = state.events.filter((e) => e.type === "mr_white_guess_made");
  for (const event of guessEvents) {
    if (event.type === "mr_white_guess_made") {
      lines.push("");
      lines.push(
        `Mr. White (${playerLabel(event.seat)}) guessed "${event.guess}" — ${event.wasCorrect ? "CORRECT" : "WRONG"}`,
      );
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Player system prompt (role-aware)
// ---------------------------------------------------------------------------

export function playerSystemPrompt(state: GameState, player: SeatNumber): string {
  const role = state.rolesBySeat[player];
  const lines: string[] = [];

  lines.push(`You are ${playerLabel(player)} in a game of AI Impostor.`);
  lines.push("");

  // Game rules summary
  lines.push("GAME RULES:");
  lines.push("- 6 AI players play a word-based social deduction game.");
  lines.push("- 4 players receive the same word (the majority word).");
  lines.push("- 1 player receives a different but related word.");
  lines.push("- 1 player (Mr. White) receives no word at all and must bluff.");
  lines.push(
    "- If you receive a word, you do NOT know whether you have the majority word or the different word.",
  );
  lines.push("- Each round: players give clues, discuss, then vote to eliminate someone.");
  lines.push(
    "- If Mr. White is eliminated, they get one chance to guess the majority word to win.",
  );
  lines.push("- The majority group wins when both the odd-word player and Mr. White are eliminated.");
  lines.push("- The odd-word player wins by surviving to the final two players.");
  lines.push("- Mr. White wins by correctly guessing the majority word after elimination.");
  lines.push("");

  // Role-specific information
  switch (role) {
    case "civilian":
    case "impostor": {
      const word =
        role === "civilian"
          ? state.wordPair.civilianWord
          : state.wordPair.impostorWord;
      lines.push(`YOUR WORD: "${word}"`);
      lines.push("");
      lines.push(
        "You do NOT know if your word is the majority word or the different word.",
      );
      lines.push(
        "Your goal is to figure out whether you are in the majority or the minority by paying close attention to other players' clues.",
      );
      lines.push(
        "Give clues that hint at your word without saying it directly — this helps you find allies who share your word.",
      );
      lines.push(
        "Watch for players whose clues seem slightly off from yours — they might have the other word, or they could be Mr. White bluffing.",
      );
      lines.push(
        "Vote to eliminate players you believe have a different word than you, or who seem to be bluffing.",
      );
      break;
    }
    case "mr_white":
      lines.push("YOU ARE MR. WHITE.");
      lines.push("You do NOT know any word. You must bluff your way through the game.");
      lines.push("");
      lines.push(
        "Your goal: survive as long as possible. If you are eliminated, you get one chance to guess the majority word to win.",
      );
      lines.push(
        "Listen carefully to other players' clues to deduce what the words might be.",
      );
      lines.push(
        "Give clues that sound plausible based on what others have said. Don't be too specific or too vague.",
      );
      break;
  }

  lines.push("");
  lines.push(
    "THINKING GUIDANCE: Focus your reasoning on game strategy — " +
      "analyze each player's clues for consistency with yours, " +
      "identify which players seem aligned or suspicious, " +
      "and reason about deduction and deception.",
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Phase-specific user prompts
// ---------------------------------------------------------------------------

export function clueUserPrompt(state: GameState, player: SeatNumber): string {
  const context = gameContextSummary(state, player);

  return `${context}

It's the clue phase. Give a short word or phrase as your clue.
- Keep it brief (1-5 words).
- Hint at your word without saying it directly.
- Do not repeat a clue you or anyone else has already given.`;
}

export function discussionUserPrompt(state: GameState, player: SeatNumber): string {
  const context = gameContextSummary(state, player);

  return `${context}

It's the discussion phase (pass ${state.discussionPass}). Share your thoughts on who might be suspicious.
- Keep your message concise (1-3 sentences).
- Reference specific clues or behaviors that seem off or aligned with yours.
- Try to figure out who shares your word and who doesn't.`;
}

export function voteUserPrompt(state: GameState, player: SeatNumber): string {
  const context = gameContextSummary(state, player);
  const alive = orderedAliveSeats(state);
  const validTargets = alive.filter((seat) => seat !== player);

  const targetList = validTargets
    .map((seat) => `  - ${playerName(seat)}`)
    .join("\n");

  return `${context}

It's time to vote. Choose ONE player to eliminate.
You MUST vote for one of the following players (you cannot vote for yourself):
${targetList}

Respond with the model name of the player you want to eliminate.`;
}

export function mrWhiteGuessUserPrompt(state: GameState, player: SeatNumber): string {
  const context = gameContextSummary(state, player);

  return `${context}

You have been eliminated and revealed as Mr. White!
You get one final chance: guess the MAJORITY word to win the game.

Think about all the clues you've heard. What word was shared by most players?
Give your best single-word guess.`;
}
