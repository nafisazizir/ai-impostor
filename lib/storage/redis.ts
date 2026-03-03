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
