import { streamText, Output } from "ai";
import type { z } from "zod";

import type { GameState } from "@/lib/game/state";
import { playerName, seatForName } from "@/lib/game/players";
import type { SeatNumber, WordPair } from "@/lib/game/types";
import { orderedAliveSeats } from "@/lib/game/engine";

import {
  WordPairSchema,
  ClueSchema,
  DiscussionSchema,
  MrWhiteGuessSchema,
  createVoteSchema,
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

type OnReasoningDelta = (text: string) => void;

type StreamCallbacks = {
  onReasoningDelta?: OnReasoningDelta;
  onAnswerDelta?: (text: string) => void;
  answerField?: string;
};

async function drainStream(
  result: ReturnType<typeof streamText>,
  callbacks?: StreamCallbacks,
): Promise<void> {
  await Promise.all([
    (async () => {
      for await (const part of result.fullStream) {
        if (part.type === "reasoning-delta") {
          callbacks?.onReasoningDelta?.(part.text);
        }
      }
    })(),
    (async () => {
      if (!callbacks?.onAnswerDelta || !callbacks?.answerField) return;
      let prev = "";
      for await (const partial of result.partialOutputStream) {
        const val = (partial as Record<string, unknown>)?.[
          callbacks.answerField
        ];
        if (typeof val === "string" && val.length > prev.length) {
          callbacks.onAnswerDelta(val.slice(prev.length));
          prev = val;
        }
      }
    })(),
  ]);
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
 * Resolve structured output from a streamText result.
 * No silent fallbacks — fails with rich diagnostics so we can see exactly
 * what the model returned when structured output doesn't work.
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[${label}] Structured output failed: ${msg}`);
  }

  const reasoningText = (await result.reasoningText) ?? "";

  if (output !== undefined) {
    return { output, reasoningText };
  }

  // Diagnostics: inspect raw text to understand what the model actually returned
  const text = await result.text;
  const parsed = extractJsonFromText(text);
  if (parsed !== null && typeof parsed === "object") {
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      console.warn(
        `[${label}] Raw text contained JSON but schema validation failed:\n  parsed=${JSON.stringify(parsed)}, error="${validated.error.message}"`,
      );
    }
  }

  const truncated = text.slice(0, 200);
  const finishReason = await result.finishReason;
  throw new Error(
    `[${label}] No output generated. finishReason=${finishReason}, raw text (${text.length} chars): "${truncated}"`,
  );
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

  await drainStream(result, { onReasoningDelta });

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
  onAnswerDelta?: (text: string) => void,
): Promise<ActionResult<{ clue: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: ClueSchema }),
    system: playerSystemPrompt(state, player),
    prompt: clueUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainStream(result, {
    onReasoningDelta,
    onAnswerDelta,
    answerField: "clue",
  });

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
  onAnswerDelta?: (text: string) => void,
): Promise<ActionResult<{ message: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: DiscussionSchema }),
    system: playerSystemPrompt(state, player),
    prompt: discussionUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainStream(result, {
    onReasoningDelta,
    onAnswerDelta,
    answerField: "message",
  });

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

const MAX_SEMANTIC_RETRIES = 3;

export async function streamVote(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
): Promise<ActionResult<{ targetPlayer: number }>> {
  const alive = orderedAliveSeats(state);
  const validTargets = alive.filter((seat) => seat !== player);
  const validTargetNames = validTargets.map((seat) => playerName(seat));

  const voteSchema = createVoteSchema(validTargetNames);
  const label = playerModelId(player);

  for (let attempt = 0; attempt < MAX_SEMANTIC_RETRIES; attempt++) {
    const result = streamText({
      model: playerModel(player),
      providerOptions: playerProviderOptions(player),
      output: Output.object({ schema: voteSchema }),
      system: playerSystemPrompt(state, player),
      prompt: voteUserPrompt(state, player),
      maxRetries: 2,
    });

    await drainStream(result, { onReasoningDelta });

    const { output, reasoningText } = await resolveOutput(
      result,
      voteSchema,
      label,
    );

    const targetName = output.targetPlayer;
    if (validTargetNames.includes(targetName)) {
      const targetSeat = seatForName(targetName);
      return {
        output: { targetPlayer: targetSeat },
        reasoning: reasoningText,
        actionSummary: `Voted for ${targetName}`,
      };
    }

    console.warn(
      `[${playerName(player)}] Invalid vote target "${targetName}" (attempt ${attempt + 1}/${MAX_SEMANTIC_RETRIES}). Valid: ${validTargetNames.join(", ")}`,
    );
  }

  // Fallback: random valid target
  const fallbackTarget =
    validTargets[Math.floor(Math.random() * validTargets.length)];
  console.warn(
    `[${playerName(player)}] All vote attempts invalid. Falling back to random target: ${playerName(fallbackTarget)}`,
  );

  return {
    output: { targetPlayer: fallbackTarget },
    reasoning: "(fallback: model returned invalid targets after retries)",
    actionSummary: `Voted for ${playerName(fallbackTarget)} (fallback)`,
  };
}

export async function streamMrWhiteGuess(
  state: GameState,
  player: SeatNumber,
  onReasoningDelta?: OnReasoningDelta,
  onAnswerDelta?: (text: string) => void,
): Promise<ActionResult<{ guess: string }>> {
  const result = streamText({
    model: playerModel(player),
    providerOptions: playerProviderOptions(player),
    output: Output.object({ schema: MrWhiteGuessSchema }),
    system: playerSystemPrompt(state, player),
    prompt: mrWhiteGuessUserPrompt(state, player),
    maxRetries: 2,
  });

  await drainStream(result, {
    onReasoningDelta,
    onAnswerDelta,
    answerField: "guess",
  });

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
