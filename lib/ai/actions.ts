import { generateObject } from "ai";

import type { GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";
import type { SeatNumber, WordPair } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";

import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  VoteSchema,
  MrWhiteGuessSchema,
} from "@/lib/ai/schemas";
import { playerModel, hostModel } from "@/lib/ai/models";
import {
  hostWordPairSystemPrompt,
  hostWordPairUserPrompt,
  playerSystemPrompt,
  clueUserPrompt,
  discussionUserPrompt,
  voteUserPrompt,
  mrWhiteGuessUserPrompt,
} from "@/lib/ai/prompts";

export type ActionResult<T> = {
  output: T;
  reasoning: string;
  actionSummary: string;
};

const MAX_SEMANTIC_RETRIES = 3;

export async function generateWordPair(): Promise<ActionResult<WordPair>> {
  const result = await generateObject({
    model: hostModel(),
    schema: WordPairSchema,
    system: hostWordPairSystemPrompt(),
    prompt: hostWordPairUserPrompt(),
    maxRetries: 2,
  });

  return {
    output: result.object,
    reasoning: result.reasoning ?? "",
    actionSummary: `Generated word pair: "${result.object.civilianWord}" / "${result.object.impostorWord}"`,
  };
}

export async function generateClue(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ clue: string }>> {
  const result = await generateObject({
    model: playerModel(player),
    schema: ClueSchema,
    system: playerSystemPrompt(state, player),
    prompt: clueUserPrompt(state, player),
    maxRetries: 2,
  });

  return {
    output: result.object,
    reasoning: result.reasoning ?? "",
    actionSummary: `Gave clue: "${result.object.clue}"`,
  };
}

export async function generateDiscussionMessage(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ message: string }>> {
  const result = await generateObject({
    model: playerModel(player),
    schema: DiscussionSchema,
    system: playerSystemPrompt(state, player),
    prompt: discussionUserPrompt(state, player),
    maxRetries: 2,
  });

  return {
    output: result.object,
    reasoning: result.reasoning ?? "",
    actionSummary: `Said: "${result.object.message}"`,
  };
}

export async function generateVote(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ targetPlayer: number }>> {
  const alive = orderedAliveSeats(state);
  const validTargets = alive.filter((seat) => seat !== player);

  for (let attempt = 0; attempt < MAX_SEMANTIC_RETRIES; attempt++) {
    const result = await generateObject({
      model: playerModel(player),
      schema: VoteSchema,
      system: playerSystemPrompt(state, player),
      prompt: voteUserPrompt(state, player),
      maxRetries: 2,
    });

    const target = result.object.targetPlayer as SeatNumber;
    if (validTargets.includes(target)) {
      return {
        output: result.object,
        reasoning: result.reasoning ?? "",
        actionSummary: `Voted for ${playerName(target)}`,
      };
    }

    console.warn(
      `[Player ${player}] Invalid vote target ${target} (attempt ${attempt + 1}/${MAX_SEMANTIC_RETRIES}). Valid: ${validTargets.join(", ")}`,
    );
  }

  // Fallback: random valid target
  const fallbackTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
  console.warn(
    `[Player ${player}] All vote attempts invalid. Falling back to random target: ${fallbackTarget}`,
  );

  return {
    output: { targetPlayer: fallbackTarget },
    reasoning: "(fallback: model returned invalid targets after retries)",
    actionSummary: `Voted for ${playerName(fallbackTarget)} (fallback)`,
  };
}

export async function generateMrWhiteGuess(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ guess: string }>> {
  const result = await generateObject({
    model: playerModel(player),
    schema: MrWhiteGuessSchema,
    system: playerSystemPrompt(state, player),
    prompt: mrWhiteGuessUserPrompt(state, player),
    maxRetries: 2,
  });

  return {
    output: result.object,
    reasoning: result.reasoning ?? "",
    actionSummary: `Guessed: "${result.object.guess}"`,
  };
}
