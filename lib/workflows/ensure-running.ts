import { start, getRun } from "workflow/api";

import { getRunId, setRunId } from "@/lib/storage/redis";
import { gameLoopWorkflow } from "@/lib/workflows/game-loop";

export async function ensureWorkflowRunning(): Promise<{
  runId: string;
  isNew: boolean;
}> {
  const existingRunId = await getRunId();

  if (existingRunId) {
    try {
      const existingRun = getRun(existingRunId);
      const status = await existingRun.status;
      if (status === "running" || status === "pending") {
        return { runId: existingRunId, isNew: false };
      }
    } catch {
      // Run not found or error checking — proceed to create new one
    }
  }

  const run = await start(gameLoopWorkflow);
  await setRunId(run.runId);
  return { runId: run.runId, isNew: true };
}
