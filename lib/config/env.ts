type RequiredEnvKey =
  | "AI_GATEWAY_API_KEY"
  | "UPSTASH_REDIS_REST_URL"
  | "UPSTASH_REDIS_REST_TOKEN"
  | "WORKFLOW_START_SECRET";

export type GameMode = "seed" | "on-demand";

export type AppEnv = {
  AI_GATEWAY_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  WORKFLOW_START_SECRET: string;
  WORKFLOW_LOOP_ID: string;
  WORKFLOW_MAX_DISCUSSION_PASSES: number;
  WORKFLOW_GAME_DELAY_MS: number;
  GAME_MODE: GameMode;
  REPLAY_BUFFER_TARGET: number;
};

const DEFAULT_WORKFLOW_LOOP_ID = "ai-impostor-main-loop";
const DEFAULT_MAX_DISCUSSION_PASSES = 1;
const DEFAULT_GAME_DELAY_MS = 0;
const DEFAULT_GAME_MODE: GameMode = "seed";
const DEFAULT_REPLAY_BUFFER_TARGET = 20;
const VALID_GAME_MODES: readonly GameMode[] = ["seed", "on-demand"];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid WORKFLOW_MAX_DISCUSSION_PASSES value "${value}". Expected a positive integer.`,
    );
  }

  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid WORKFLOW_GAME_DELAY_MS value "${value}". Expected a non-negative integer.`,
    );
  }

  return parsed;
}

function assertRequiredKeys(
  env: NodeJS.ProcessEnv,
  keys: readonly RequiredEnvKey[],
): void {
  const missing = keys.filter(
    (key) => !env[key] || env[key]?.trim().length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Set them in .env.local.`,
    );
  }
}

export function getEnv(): AppEnv {
  assertRequiredKeys(process.env, [
    "AI_GATEWAY_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "WORKFLOW_START_SECRET",
  ]);

  const gameMode = (process.env.GAME_MODE ?? DEFAULT_GAME_MODE) as string;
  if (!VALID_GAME_MODES.includes(gameMode as GameMode)) {
    throw new Error(
      `Invalid GAME_MODE value "${gameMode}". Expected one of: ${VALID_GAME_MODES.join(", ")}.`,
    );
  }

  return {
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY as string,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL as string,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    WORKFLOW_START_SECRET: process.env.WORKFLOW_START_SECRET as string,
    WORKFLOW_LOOP_ID: process.env.WORKFLOW_LOOP_ID ?? DEFAULT_WORKFLOW_LOOP_ID,
    WORKFLOW_MAX_DISCUSSION_PASSES: parsePositiveInt(
      process.env.WORKFLOW_MAX_DISCUSSION_PASSES,
      DEFAULT_MAX_DISCUSSION_PASSES,
    ),
    WORKFLOW_GAME_DELAY_MS: parseNonNegativeInt(
      process.env.WORKFLOW_GAME_DELAY_MS,
      DEFAULT_GAME_DELAY_MS,
    ),
    GAME_MODE: gameMode as GameMode,
    REPLAY_BUFFER_TARGET: parsePositiveInt(
      process.env.REPLAY_BUFFER_TARGET,
      DEFAULT_REPLAY_BUFFER_TARGET,
    ),
  };
}
