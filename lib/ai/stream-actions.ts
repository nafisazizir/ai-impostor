import { streamText, Output } from "ai";
import type { z } from "zod";

import type { GameState } from "@/lib/game/state";
import { playerName } from "@/lib/game/players";
import type { SeatNumber, WordPair } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";

import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  MrWhiteGuessSchema,
  VoteSchema,
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
import type { ActionResult } from "@/lib/ai/actions";

type OnReasoningDelta = (text: string) => void;

async function drainReasoning(
  result: ReturnType<typeof streamText>,
  onReasoningDelta?: OnReasoningDelta,
): Promise<void> {
  for await (const part of result.fullStream) {
    if (part.type === "reasoning-delta") {
      onReasoningDelta?.(part.text);
    }
  }
}

/**
 * Strip `<think>...</think>` blocks and extract the first JSON object from raw text.
 * Handles models (e.g. Gemini) that wrap responses in thinking tags.
 */
function extractJsonFromText(text: string): unknown | null {
  // Strip <think>...</think> blocks (greedy, handles nested content)
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Find the first JSON object
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Try `result.output` first. On failure, fall back to parsing raw text
 * with `<think>` tag stripping and schema validation.
 */
async function resolveOutput<T>(
  result: ReturnType<typeof streamText>,
  schema: z.ZodType<T>,
  label: string,
): Promise<{ output: T; reasoningText: string }> {
  let output: T | undefined;

  try {
    const raw = await result.output;
    if (raw !== undefined) output = raw as T;
  } catch {
    // Structured output parsing failed — try text fallback
  }

  const reasoningText = (await result.reasoningText) ?? "";

  if (output !== undefined) {
    return { output, reasoningText };
  }

  // Fallback: extract JSON from raw text (handles <think> tags)
  const text = await result.text;
  const parsed = extractJsonFromText(text);
  if (parsed !== null) {
    const validated = schema.safeParse(parsed);
    if (validated.success) {
      console.warn(
        `[${label}] Used text fallback — structured output failed but JSON extracted from raw text`,
      );
      return { output: validated.data, reasoningText };
    }
  }

  throw new Error(`[${label}] No output generated and text fallback failed`);
}

export async function streamWordPair(
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<WordPair>> {
  const result = streamText({
    model: hostModel(),
    output: Output.object({ schema: WordPairSchema }),
    system: hostWordPairSystemPrompt(),
    prompt: hostWordPairUserPrompt(),
    maxRetries: 2,
  });

  await drainReasoning(result, onReasoningDelta);

  const { output, reasoningText } = await resolveOutput(
    result,
    WordPairSchema,
    "host",
  );

  return {
    output,
    reasoning: reasoningText,
    actionSummary: `Generated word pair: "${output.civilianWord}" / "${output.impostorWord}"`,
  };
}

export async function streamClue(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<{ clue: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: ClueSchema }),
    system: playerSystemPrompt(state, player),
    prompt: clueUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainReasoning(result, onReasoningDelta);

  const { output, reasoningText } = await resolveOutput(
    result,
    ClueSchema,
    playerModelId(player),
  );

  return {
    output,
    reasoning: reasoningText,
    actionSummary: `Gave clue: "${output.clue}"`,
  };
}

export async function streamDiscussionMessage(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<{ message: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: DiscussionSchema }),
    system: playerSystemPrompt(state, player),
    prompt: discussionUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainReasoning(result, onReasoningDelta);

  const { output, reasoningText } = await resolveOutput(
    result,
    DiscussionSchema,
    playerModelId(player),
  );

  return {
    output,
    reasoning: reasoningText,
    actionSummary: `Said: "${output.message}"`,
  };
}

export async function streamVote(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<{ targetPlayer: number }>> {
  const alive = orderedAliveSeats(state);
  const validTargets = alive.filter((seat) => seat !== player);

  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: VoteSchema }),
    system: playerSystemPrompt(state, player),
    prompt: voteUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainReasoning(result, onReasoningDelta);

  const label = playerModelId(player);
  const { output, reasoningText } = await resolveOutput(
    result,
    VoteSchema,
    label,
  );

  if (!validTargets.includes(output.targetPlayer as SeatNumber)) {
    throw new Error(
      `[${label}] Voted for invalid target ${output.targetPlayer} (valid: ${validTargets.join(", ")})`,
    );
  }

  return {
    output,
    reasoning: reasoningText,
    actionSummary: `Voted for ${playerName(output.targetPlayer as SeatNumber)}`,
  };
}

export async function streamMrWhiteGuess(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<{ guess: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: MrWhiteGuessSchema }),
    system: playerSystemPrompt(state, player),
    prompt: mrWhiteGuessUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainReasoning(result, onReasoningDelta);

  const { output, reasoningText } = await resolveOutput(
    result,
    MrWhiteGuessSchema,
    playerModelId(player),
  );

  return {
    output,
    reasoning: reasoningText,
    actionSummary: `Guessed: "${output.guess}"`,
  };
}
