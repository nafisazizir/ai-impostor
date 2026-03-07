import { getRun } from "workflow/api";

import { getEnv } from "@/lib/config/env";
import {
  clearLiveGameId,
  getGameCount,
  getGameStartIndex,
  getLiveGameId,
  getRandomPersistedGame,
  refreshSpectatorPresence,
  removeSpectatorPresence,
} from "@/lib/storage/redis";
import { ensureWorkflowRunning } from "@/lib/workflows/ensure-running";
import { createReplayStream } from "@/lib/game/replay";
import type { GameStreamEvent } from "@/lib/workflows/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;
const PRESENCE_HEARTBEAT_MS = 30_000;

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function gameEventToSSE(event: GameStreamEvent, connectionId?: string): string {
  switch (event.kind) {
    case "game:start":
      console.log(`[stream] ${connectionId ?? "?"} game:start gameId=${event.gameId}`);
      return formatSSE("gameId", { gameId: event.gameId });
    case "snapshot":
      console.log(
        `[stream] ${connectionId ?? "?"} snapshot #${event.snapshot.index} phase=${event.snapshot.state.currentPhase} round=${event.snapshot.state.currentRound}`,
      );
      return formatSSE("snapshot", event.snapshot);
    case "game:finished":
      console.log(`[stream] ${connectionId ?? "?"} game:finished`);
      return formatSSE("finished", {});
    case "thinking:start": {
      const data: Record<string, unknown> = {
        seat: event.seat,
        phase: event.phase,
        round: event.round,
      };
      if (event.pass !== undefined) data.pass = event.pass;
      return formatSSE("thinking:start", data);
    }
    case "thinking:delta":
      return formatSSE("thinking:delta", { text: event.text });
    case "thinking:end":
      return formatSSE("thinking:end", { actionSummary: event.actionSummary });
    case "answer:start":
      return formatSSE("answer:start", {
        seat: event.seat,
        kind: event.actionKind,
      });
    case "answer:delta":
      return formatSSE("answer:delta", { text: event.text });
    case "answer:end":
      return formatSSE("answer:end", {});
  }
}

function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encoder = new TextEncoder();
  const env = getEnv();
  const isOnDemand = env.GAME_MODE === "on-demand";

  // Generate a connection ID for spectator presence tracking
  const connectionId = generateConnectionId();

  // Determine run ID and start index
  let runId: string | null = searchParams.get("runId");
  let startIndex: number;
  const isReconnect = runId !== null && searchParams.has("startIndex");

  // Check if a live game is running
  const [liveGameId, storedGameCount] = await Promise.all([
    getLiveGameId(),
    getGameCount(),
  ]);
  const hasLiveGame = liveGameId !== null;

  console.log(
    `[stream] new connection ${connectionId} — hasLiveGame=${hasLiveGame}, isReconnect=${isReconnect}, storedGames=${storedGameCount}`,
  );

  // Decide whether to serve a replay instead of a live game.
  // Seed mode: replay when buffer is full (workflow has stopped). Skip the hasLiveGame
  // check because the workflow always exits before playing when the buffer is full,
  // so any liveGameId is stale. Also handle reconnects — the previous live stream was
  // empty (workflow exited immediately), so serve a replay instead of retrying.
  // On-demand mode: replay when no live game is running (bridge gap while one spins up).
  const seedBufferFull = env.GAME_MODE === "seed" && storedGameCount >= env.REPLAY_BUFFER_TARGET;
  const shouldReplay =
    (seedBufferFull && storedGameCount > 0) ||
    (!isReconnect && !hasLiveGame && isOnDemand && storedGameCount > 0);

  if (shouldReplay) {
    // Clear stale liveGameId in seed mode — workflow never plays when buffer is full
    if (seedBufferFull && hasLiveGame) {
      await clearLiveGameId();
    }

    const storedGame = await getRandomPersistedGame();
    if (storedGame) {
      if (isOnDemand) {
        await refreshSpectatorPresence(connectionId);
        // Kick off the workflow so a live game starts in the background
        ensureWorkflowRunning().catch(() => {});
      }

      console.log(
        `[stream] serving replay — gameId=${storedGame.summary.gameId}, thinkingEntries=${storedGame.thinking.length}`,
      );
      return serveReplayStream(request, encoder, storedGame, connectionId, isOnDemand);
    }
  }

  // Live game path — original behavior
  if (isReconnect) {
    startIndex = parseInt(searchParams.get("startIndex")!, 10) || 0;
  } else {
    // New viewer — ensure a workflow is running, auto-start if needed
    const result = await ensureWorkflowRunning();
    runId = result.runId;
    startIndex = result.isNew ? 0 : await getGameStartIndex();
  }

  // Register spectator presence for on-demand mode
  if (isOnDemand) {
    await refreshSpectatorPresence(connectionId);
  }

  console.log(
    `[stream] serving live — runId=${runId}, startIndex=${startIndex}, liveGameId=${liveGameId}`,
  );

  // Get the WDK readable stream (runId guaranteed non-null at this point)
  const run = getRun(runId!);
  const wdkReadable = run.getReadable<GameStreamEvent>({ startIndex });
  const reader = wdkReadable.getReader();

  const stream = new ReadableStream({
    start(controller) {
      // Send connection metadata (runId + startIndex for reconnection)
      if (!isReconnect) {
        controller.enqueue(
          encoder.encode(formatSSE("meta", { runId, startIndex, mode: "live" })),
        );
      }

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Presence heartbeat for on-demand mode
      const presenceHeartbeat = isOnDemand
        ? setInterval(() => {
            refreshSpectatorPresence(connectionId).catch(() => {});
          }, PRESENCE_HEARTBEAT_MS)
        : null;

      const cleanup = () => {
        clearInterval(heartbeat);
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        if (isOnDemand) {
          removeSpectatorPresence(connectionId).catch(() => {});
        }
        reader.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      // Pump WDK events → SSE
      (async () => {
        try {
          while (!request.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(gameEventToSSE(value, connectionId)));
          }
        } catch {
          // Reader cancelled or stream error
        } finally {
          cleanup();
        }
      })();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

// ─── Replay stream ──────────────────────────────────────────────────────────

function serveReplayStream(
  request: Request,
  encoder: TextEncoder,
  game: import("@/lib/game/persisted").PersistedGame,
  connectionId: string,
  isOnDemand: boolean,
): Response {
  const replayReadable = createReplayStream(game);
  const replayReader = replayReadable.getReader();

  const stream = new ReadableStream({
    start(controller) {
      // Send metadata indicating this is a replay
      controller.enqueue(
        encoder.encode(formatSSE("meta", { runId: null, startIndex: 0, mode: "replay" })),
      );

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Presence heartbeat for on-demand mode
      const presenceHeartbeat = isOnDemand
        ? setInterval(() => {
            refreshSpectatorPresence(connectionId).catch(() => {});
          }, PRESENCE_HEARTBEAT_MS)
        : null;

      const cleanup = () => {
        clearInterval(heartbeat);
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        if (isOnDemand) {
          removeSpectatorPresence(connectionId).catch(() => {});
        }
        replayReader.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      // Pump replay events → SSE
      (async () => {
        try {
          while (!request.signal.aborted) {
            const { done, value } = await replayReader.read();
            if (done) break;
            controller.enqueue(encoder.encode(gameEventToSSE(value, connectionId)));
          }
        } catch {
          // Reader cancelled or stream error
        } finally {
          cleanup();
        }
      })();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
