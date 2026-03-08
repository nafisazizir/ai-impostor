import { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/config/env";
import type { GameSummary, PersistedGame } from "@/lib/game/persisted";

const PREFIX = "ai-impostor";

let _redis: Redis | null = null;

function redis(): Redis {
  if (!_redis) {
    const env = getEnv();
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export async function getRunId(): Promise<string | null> {
  return redis().get<string>(`${PREFIX}:runId`);
}

export async function setRunId(runId: string): Promise<void> {
  await redis().set(`${PREFIX}:runId`, runId);
}

export async function getGameStartIndex(): Promise<number> {
  return (await redis().get<number>(`${PREFIX}:gameStartIndex`)) ?? 0;
}

export async function setGameStartIndex(index: number): Promise<void> {
  await redis().set(`${PREFIX}:gameStartIndex`, index);
}

// ─── Game persistence ───────────────────────────────────────────────────────

function summaryKey(gameId: string) {
  return `${PREFIX}:games:${gameId}:summary`;
}

function fullKey(gameId: string) {
  return `${PREFIX}:games:${gameId}:full`;
}

const INDEX_KEY = `${PREFIX}:games:index`;

export async function persistGame(game: PersistedGame): Promise<void> {
  const r = redis();
  const timestamp = new Date(game.summary.finishedAt).getTime();
  const pipe = r.pipeline();
  pipe.set(summaryKey(game.summary.gameId), game.summary);
  pipe.set(fullKey(game.summary.gameId), game);
  pipe.zadd(INDEX_KEY, { score: timestamp, member: game.summary.gameId });
  await pipe.exec();
}

export async function getGameSummary(gameId: string): Promise<GameSummary | null> {
  return redis().get<GameSummary>(summaryKey(gameId));
}

export async function getPersistedGame(gameId: string): Promise<PersistedGame | null> {
  return redis().get<PersistedGame>(fullKey(gameId));
}

export async function listRecentGameIds(limit: number, offset = 0): Promise<string[]> {
  return redis().zrange<string[]>(INDEX_KEY, offset, offset + limit - 1, { rev: true });
}

export async function listRecentGameSummaries(
  limit: number,
  offset = 0,
): Promise<GameSummary[]> {
  const ids = await listRecentGameIds(limit, offset);
  if (ids.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of ids) pipe.get(summaryKey(id));
  const results = await pipe.exec<(GameSummary | null)[]>();
  return results.filter((s): s is GameSummary => s !== null);
}

export async function getGameCount(): Promise<number> {
  return redis().zcard(INDEX_KEY);
}

export async function getRandomPersistedGame(): Promise<PersistedGame | null> {
  const count = await redis().zcard(INDEX_KEY);
  if (count === 0) return null;
  const randomIndex = Math.floor(Math.random() * count);
  const ids = await redis().zrange<string[]>(INDEX_KEY, randomIndex, randomIndex);
  if (ids.length === 0) return null;
  return getPersistedGame(ids[0]);
}

// ─── Active replay tracking ─────────────────────────────────────────────────

const REPLAY_RUN_KEY = `${PREFIX}:replay:runId`;
const REPLAY_TTL_SECONDS = 900; // 15 minutes

export async function setActiveReplayRunId(runId: string): Promise<boolean> {
  // NX = set-if-not-exists — prevents race when multiple viewers arrive simultaneously
  const result = await redis().set(REPLAY_RUN_KEY, runId, { nx: true, ex: REPLAY_TTL_SECONDS });
  return result === "OK";
}

export async function getActiveReplayRunId(): Promise<string | null> {
  return redis().get<string>(REPLAY_RUN_KEY);
}

export async function clearActiveReplayRunId(): Promise<void> {
  await redis().del(REPLAY_RUN_KEY);
}

// ─── Spectator presence (for on-demand mode) ────────────────────────────────

const SPECTATOR_PREFIX = `${PREFIX}:spectators`;
const SPECTATOR_TTL_SECONDS = 60;

export async function refreshSpectatorPresence(connectionId: string): Promise<void> {
  await redis().set(`${SPECTATOR_PREFIX}:${connectionId}`, "1", { ex: SPECTATOR_TTL_SECONDS });
}

export async function removeSpectatorPresence(connectionId: string): Promise<void> {
  await redis().del(`${SPECTATOR_PREFIX}:${connectionId}`);
}

export async function getSpectatorCount(): Promise<number> {
  const r = redis();
  const keys = await r.keys(`${SPECTATOR_PREFIX}:*`);
  return keys.length;
}

// ─── Live game flag ──────────────────────────────────────────────────────────

const LIVE_GAME_KEY = `${PREFIX}:liveGame`;

export async function setLiveGameId(gameId: string): Promise<void> {
  await redis().set(LIVE_GAME_KEY, gameId);
}

export async function clearLiveGameId(): Promise<void> {
  await redis().del(LIVE_GAME_KEY);
}

export async function getLiveGameId(): Promise<string | null> {
  return redis().get<string>(LIVE_GAME_KEY);
}
