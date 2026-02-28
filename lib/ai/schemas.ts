import { z } from "zod";

export const WordPairSchema = z.object({
  civilianWord: z.string().describe("The word given to civilian players"),
  impostorWord: z
    .string()
    .describe("A related but distinct word given to the impostor"),
});

export const ClueSchema = z.object({
  clue: z.string().describe("A short word or phrase clue about your word"),
});

export const DiscussionSchema = z.object({
  message: z.string().describe("Your discussion statement for this round"),
});

export const VoteSchema = z.object({
  targetPlayer: z
    .int()
    .min(1)
    .max(6)
    .describe("The player number (1-6) you vote to eliminate"),
});

export const MrWhiteGuessSchema = z.object({
  guess: z.string().describe("Your guess for the civilian word"),
});
