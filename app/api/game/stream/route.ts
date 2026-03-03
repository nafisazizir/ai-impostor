import { getRun } from "workflow/api";

import { getGameStartIndex } from "@/lib/storage/redis";
import { ensureWorkflowRunning } from "@/lib/workflows/ensure-running";
import type { GameStreamEvent } from "@/lib/workflows/types";

export const maxDuration = 300;

const HEARTBEAT_INTERVAL_MS = 15_000;

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

function gameEventToSSE(event: GameStreamEvent): string {
  switch (event.kind) {
    case "game:start":
      return formatSSE("gameId", { gameId: event.gameId });
    case "snapshot":
      return formatSSE("snapshot", event.snapshot);
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
    case "game:finished":
      return formatSSE("finished", {});
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encoder = new TextEncoder();

  // Determine run ID and start index
  let runId: string | null = searchParams.get("runId");
  let startIndex: number;
  const isReconnect = runId !== null && searchParams.has("startIndex");

  if (isReconnect) {
    startIndex = parseInt(searchParams.get("startIndex")!, 10) || 0;
  } else {
    // New viewer — ensure a workflow is running, auto-start if needed
    const result = await ensureWorkflowRunning();
    runId = result.runId;
    startIndex = result.isNew ? 0 : await getGameStartIndex();
  }

  // Get the WDK readable stream (runId guaranteed non-null at this point)
  const run = getRun(runId!);
  const wdkReadable = run.getReadable<GameStreamEvent>({ startIndex });
  const reader = wdkReadable.getReader();

  const stream = new ReadableStream({
    start(controller) {
      // Send connection metadata (runId + startIndex for reconnection)
      if (!isReconnect) {
        controller.enqueue(
          encoder.encode(formatSSE("meta", { runId, startIndex })),
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

      const cleanup = () => {
        clearInterval(heartbeat);
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
            controller.enqueue(encoder.encode(gameEventToSSE(value)));
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
