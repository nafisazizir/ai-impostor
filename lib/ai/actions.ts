import { generateText, NoOutputGeneratedError, Output } from "ai";

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
import {
  playerModel,
  playerModelId,
  playerProviderOptions,
  hostModel,
} from "@/lib/ai/models";
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

function extractOutput<T>(
  result: {
    readonly output: T | undefined;
    readonly finishReason: string;
    readonly usage: {
      readonly inputTokens: number | undefined;
      readonly outputTokens: number | undefined;
    };
    readonly text: string;
  },
  modelLabel: string,
): T {
  try {
    const output = result.output;
    if (output !== undefined) return output;
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error)) {
      throw new Error(
        `[${modelLabel}] No structured output generated — finishReason: ${result.finishReason}, ` +
          `tokens: {input: ${result.usage.inputTokens ?? "?"}, output: ${result.usage.outputTokens ?? "?"}}, ` +
          `raw text: "${result.text?.slice(0, 200) ?? "(empty)"}"`,
      );
    }
    throw error;
  }
  throw new Error(
    `[${modelLabel}] No structured output generated — output was undefined`,
  );
}

export async function generateWordPair(): Promise<ActionResult<WordPair>> {
  const result = await generateText({
    model: hostModel(),
    output: Output.object({ schema: WordPairSchema }),
    system: hostWordPairSystemPrompt(),
    prompt: hostWordPairUserPrompt(),
    maxRetries: 2,
  });

  const output = extractOutput(result, "host");
  return {
    output,
    reasoning: result.reasoningText ?? "",
    actionSummary: `Generated word pair: "${output.civilianWord}" / "${output.impostorWord}"`,
  };
}

export async function generateClue(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ clue: string }>> {
  const result = await generateText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: ClueSchema }),
    system: playerSystemPrompt(state, player),
    prompt: clueUserPrompt(state, player),
    maxRetries: 2,
  });

  const output = extractOutput(result, playerModelId(player));
  return {
    output,
    reasoning: result.reasoningText ?? "",
    actionSummary: `Gave clue: "${output.clue}"`,
  };
}

export async function generateDiscussionMessage(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ message: string }>> {
  const result = await generateText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: DiscussionSchema }),
    system: playerSystemPrompt(state, player),
    prompt: discussionUserPrompt(state, player),
    maxRetries: 2,
  });

  const output = extractOutput(result, playerModelId(player));
  return {
    output,
    reasoning: result.reasoningText ?? "",
    actionSummary: `Said: "${output.message}"`,
  };
}

export async function generateVote(
  state: GameState,
  player: SeatNumber,
): Promise<ActionResult<{ targetPlayer: number }>> {
  const alive = orderedAliveSeats(state);
  const validTargets = alive.filter((seat) => seat !== player);

  for (let attempt = 0; attempt < MAX_SEMANTIC_RETRIES; attempt++) {
    const result = await generateText({
      model: playerModel(player),
      providerOptions: playerProviderOptions(player),
      output: Output.object({ schema: VoteSchema }),
      system: playerSystemPrompt(state, player),
      prompt: voteUserPrompt(state, player),
      maxRetries: 2,
    });

    const output = extractOutput(result, playerModelId(player));
    const target = output.targetPlayer as SeatNumber;
    if (validTargets.includes(target)) {
      return {
        output,
        reasoning: result.reasoningText ?? "",
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
  const result = await generateText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: MrWhiteGuessSchema }),
    system: playerSystemPrompt(state, player),
    prompt: mrWhiteGuessUserPrompt(state, player),
    maxRetries: 2,
  });

  const output = extractOutput(result, playerModelId(player));
  return {
    output,
    reasoning: result.reasoningText ?? "",
    actionSummary: `Guessed: "${output.guess}"`,
  };
}
