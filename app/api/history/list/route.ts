import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { listRecentGameSummaries, getGameCount } from "@/lib/storage/redis";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [games, total] = await Promise.all([
    listRecentGameSummaries(limit, offset),
    getGameCount(),
  ]);

  return NextResponse.json({ games, total });
}
