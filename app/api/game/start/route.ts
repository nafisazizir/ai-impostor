import { start, getRun } from "workflow/api";

import { getEnv } from "@/lib/config/env";
import { getRunId, setRunId } from "@/lib/storage/redis";
import { gameLoopWorkflow } from "@/lib/workflows/game-loop";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  const { WORKFLOW_START_SECRET } = getEnv();

  if (auth !== `Bearer ${WORKFLOW_START_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing running workflow (singleton guard)
  const existingRunId = await getRunId();
  if (existingRunId) {
    try {
      const existingRun = getRun(existingRunId);
      const status = await existingRun.status;
      if (status === "running" || status === "pending") {
        return Response.json({
          ok: true,
          runId: existingRunId,
          status,
          message: "Already running",
        });
      }
    } catch {
      // Run not found or error checking — proceed to create new one
    }
  }

  // Start new workflow
  const run = await start(gameLoopWorkflow);
  await setRunId(run.runId);

  return Response.json({ ok: true, runId: run.runId });
}
