import { NextResponse } from "next/server";

import { getEnv } from "@/lib/config/env";

export async function GET() {
  const env = getEnv();

  return NextResponse.json({
    ok: true,
    workflowLoopId: env.WORKFLOW_LOOP_ID,
  });
}
