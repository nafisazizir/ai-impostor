import { NextResponse } from "next/server";

import { runGame } from "@/lib/ai/runner";

export const maxDuration = 300;

export async function POST() {
  const gameId = `game-${Date.now()}`;

  try {
    const { finalState, thinking } = await runGame(gameId);

    return NextResponse.json({
      gameId,
      outcome: finalState.outcome,
      rounds: finalState.currentRound,
      thinkingEntries: thinking.length,
      finalState,
      thinking,
    });
  } catch (error) {
    console.error(`[${gameId}] Game failed:`, error);
    return NextResponse.json(
      {
        error: "Game execution failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
