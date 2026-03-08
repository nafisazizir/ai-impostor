import { start, getRun } from "workflow/api";

import {
  getActiveReplayRunId,
  setActiveReplayRunId,
  clearActiveReplayRunId,
  getRandomPersistedGame,
} from "@/lib/storage/redis";
import { replayLoopWorkflow } from "@/lib/workflows/replay-loop";

export async function ensureReplayRunning(): Promise<{
  runId: string;
} | null> {
  // Check for an existing active replay
  const existingRunId = await getActiveReplayRunId();

  if (existingRunId) {
    try {
      const existingRun = getRun(existingRunId);
      const status = await existingRun.status;
      if (status === "running" || status === "pending") {
        return { runId: existingRunId };
      }
    } catch {
      // Run not found or error — clear stale key and proceed
    }
    await clearActiveReplayRunId();
  }

  // Pick a random game to replay
  const game = await getRandomPersistedGame();
  if (!game) return null;

  // Start a new replay workflow
  const run = await start(replayLoopWorkflow, [game.summary.gameId]);
  const stored = await setActiveReplayRunId(run.runId);

  if (!stored) {
    // Another viewer won the race — use their runId
    const racedRunId = await getActiveReplayRunId();
    if (racedRunId) return { runId: racedRunId };
  }

  return { runId: run.runId };
}
