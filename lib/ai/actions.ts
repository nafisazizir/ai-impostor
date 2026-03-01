import { generateText, NoOutputGeneratedError, Output } from "ai";

import type { GameState } from "@/lib/game/state";
import { playerName, seatForName } from "@/lib/game/players";
import type { SeatNumber, WordPair } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";

import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  createVoteSchema,
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
    temperature: 1.2,
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
  const validTargetNames = validTargets.map((seat) => playerName(seat));

  const voteSchema = createVoteSchema(validTargetNames);

  for (let attempt = 0; attempt < MAX_SEMANTIC_RETRIES; attempt++) {
    const result = await generateText({
      model: playerModel(player),
      providerOptions: playerProviderOptions(player),
      output: Output.object({ schema: voteSchema }),
      system: playerSystemPrompt(state, player),
      prompt: voteUserPrompt(state, player),
      maxRetries: 2,
    });

    const output = extractOutput(result, playerModelId(player));
    const targetName = output.targetPlayer;
    if (validTargetNames.includes(targetName)) {
      const targetSeat = seatForName(targetName);
      return {
        output: { targetPlayer: targetSeat },
        reasoning: result.reasoningText ?? "",
        actionSummary: `Voted for ${targetName}`,
      };
    }

    console.warn(
      `[${playerName(player)}] Invalid vote target "${targetName}" (attempt ${attempt + 1}/${MAX_SEMANTIC_RETRIES}). Valid: ${validTargetNames.join(", ")}`,
    );
  }

  // Fallback: random valid target
  const fallbackTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
  console.warn(
    `[${playerName(player)}] All vote attempts invalid. Falling back to random target: ${playerName(fallbackTarget)}`,
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
