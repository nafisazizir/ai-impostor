import type { GameSnapshot } from "@/lib/game/snapshot";

type Listener = {
  controller: ReadableStreamDefaultController;
};

type GameEntry = {
  snapshots: GameSnapshot[];
  listeners: Set<Listener>;
  status: "running" | "finished" | "error";
  error?: string;
};

const games = new Map<string, GameEntry>();

const CLEANUP_DELAY_MS = 60_000;

function sendEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
): void {
  try {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(payload));
  } catch {
    // Client disconnected — ignore
  }
}

export function createGame(gameId: string): void {
  games.set(gameId, {
    snapshots: [],
    listeners: new Set(),
    status: "running",
  });
}

export function pushSnapshot(gameId: string, snapshot: GameSnapshot): void {
  const entry = games.get(gameId);
  if (!entry) return;
  entry.snapshots.push(snapshot);
  for (const listener of entry.listeners) {
    sendEvent(listener.controller, "snapshot", snapshot);
  }
}

export function finishGame(gameId: string): void {
  const entry = games.get(gameId);
  if (!entry) return;
  entry.status = "finished";
  for (const listener of entry.listeners) {
    sendEvent(listener.controller, "finished", {});
    try {
      listener.controller.close();
    } catch {
      // already closed
    }
  }
  entry.listeners.clear();
  scheduleCleanup(gameId);
}

export function failGame(gameId: string, error: string): void {
  const entry = games.get(gameId);
  if (!entry) return;
  entry.status = "error";
  entry.error = error;
  for (const listener of entry.listeners) {
    sendEvent(listener.controller, "error", { message: error });
    try {
      listener.controller.close();
    } catch {
      // already closed
    }
  }
  entry.listeners.clear();
  scheduleCleanup(gameId);
}

export function addListener(
  gameId: string,
  controller: ReadableStreamDefaultController,
): Listener | null {
  const entry = games.get(gameId);
  if (!entry) return null;
  const listener: Listener = { controller };
  entry.listeners.add(listener);
  return listener;
}

export function removeListener(gameId: string, listener: Listener): void {
  const entry = games.get(gameId);
  if (!entry) return;
  entry.listeners.delete(listener);
}

export function getGame(gameId: string): GameEntry | undefined {
  return games.get(gameId);
}

function scheduleCleanup(gameId: string): void {
  setTimeout(() => {
    games.delete(gameId);
  }, CLEANUP_DELAY_MS);
}
