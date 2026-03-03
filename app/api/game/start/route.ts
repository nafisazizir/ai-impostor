import { getEnv } from "@/lib/config/env";
import { ensureWorkflowRunning } from "@/lib/workflows/ensure-running";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  const { WORKFLOW_START_SECRET } = getEnv();

  if (auth !== `Bearer ${WORKFLOW_START_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, isNew } = await ensureWorkflowRunning();

  return Response.json({
    ok: true,
    runId,
    message: isNew ? "Started" : "Already running",
  });
}
