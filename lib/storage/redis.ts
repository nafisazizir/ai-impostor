import { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/config/env";

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
