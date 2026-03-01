import {
  createGame,
  pushSnapshot,
  pushThinkingStart,
  pushThinkingDelta,
  pushThinkingEnd,
  pushAnswerStart,
  pushAnswerDelta,
  pushAnswerEnd,
  finishGame,
  failGame,
  addListener,
  removeListener,
  getGame,
} from "@/lib/game/game-store";
import { runStreamGame } from "@/lib/ai/stream-runner";

export const maxDuration = 300;

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function sendEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

const HEARTBEAT_INTERVAL_MS = 15_000;

function startHeartbeat(
  controller: ReadableStreamDefaultController,
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try {
      controller.enqueue(new TextEncoder().encode(":heartbeat\n\n"));
    } catch {
      // Controller already closed — cleared by caller
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const reconnectGameId = searchParams.get("gameId");

  // --- Reconnect to existing game ---
  if (reconnectGameId) {
    const entry = getGame(reconnectGameId);
    if (!entry) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        const heartbeat = startHeartbeat(controller);

        // Replay all existing snapshots
        sendEvent(controller, "gameId", { gameId: reconnectGameId });
        for (const snapshot of entry.snapshots) {
          sendEvent(controller, "snapshot", snapshot);
        }

        if (entry.status === "finished") {
          clearInterval(heartbeat);
          sendEvent(controller, "finished", {});
          controller.close();
          return;
        }

        if (entry.status === "error") {
          clearInterval(heartbeat);
          sendEvent(controller, "error", { message: entry.error ?? "Unknown error" });
          controller.close();
          return;
        }

        // Still running — attach as live listener
        const listener = addListener(reconnectGameId, controller);
        if (!listener) {
          clearInterval(heartbeat);
          controller.close();
          return;
        }

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          removeListener(reconnectGameId, listener);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  }

  // --- Start new game ---
  if (action !== "new") {
    return new Response(
      JSON.stringify({ error: "Provide ?action=new or ?gameId=xxx" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const gameId = `game-${Date.now()}`;
  createGame(gameId);

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = startHeartbeat(controller);

      sendEvent(controller, "gameId", { gameId });

      const listener = addListener(gameId, controller);
      if (!listener) {
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeListener(gameId, listener);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Fire-and-forget: run the game
      runStreamGame(gameId, {
        onSnapshot: (snapshot) => pushSnapshot(gameId, snapshot),
        onThinkingStart: (data) => pushThinkingStart(gameId, data),
        onThinkingDelta: (text) => pushThinkingDelta(gameId, text),
        onThinkingEnd: (summary) => pushThinkingEnd(gameId, summary),
        onAnswerStart: (data) => pushAnswerStart(gameId, data),
        onAnswerDelta: (text) => pushAnswerDelta(gameId, text),
        onAnswerEnd: () => pushAnswerEnd(gameId),
      })
        .then(() => {
          clearInterval(heartbeat);
          finishGame(gameId);
        })
        .catch((error) => {
          clearInterval(heartbeat);
          console.error(`[${gameId}] Game failed:`, error);
          failGame(
            gameId,
            error instanceof Error ? error.message : String(error),
          );
        });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
