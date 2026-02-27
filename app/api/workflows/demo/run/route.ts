import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

import { getEnv } from "@/lib/config/env";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required query parameter: runId",
      },
      { status: 400 },
    );
  }

  try {
    const run = getRun(runId);
    const status = await run.status;

    if (status === "completed") {
      const result = await run.returnValue;
      return NextResponse.json({
        ok: true,
        runId,
        status,
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      runId,
      status,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: `Workflow run not found for runId "${runId}".`,
      },
      { status: 404 },
    );
  }
}
