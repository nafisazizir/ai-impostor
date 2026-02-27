import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { getEnv } from "@/lib/config/env";
import { runDemoGameWorkflow } from "@/workflows/demo-game";

type StartBody = {
  gameId?: string;
  maxDiscussionPasses?: number;
  maxRounds?: number;
};

export async function POST(request: Request) {
  const env = getEnv();
  const secret = request.headers.get("x-workflow-start-secret");
  if (secret !== env.WORKFLOW_START_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized: missing or invalid x-workflow-start-secret header.",
      },
      { status: 401 },
    );
  }

  let body: StartBody = {};
  try {
    body = (await request.json()) as StartBody;
  } catch {
    // Body is optional for this endpoint.
  }

  const gameId = body.gameId ?? `demo-${crypto.randomUUID()}`;
  const run = await start(runDemoGameWorkflow, [
    {
      gameId,
      maxDiscussionPasses: body.maxDiscussionPasses,
      maxRounds: body.maxRounds,
    },
  ]);

  return NextResponse.json({
    ok: true,
    runId: run.runId,
    gameId,
  });
}
