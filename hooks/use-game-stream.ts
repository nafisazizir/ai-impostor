"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, GamePhase } from "@/lib/game/types";
import { useTypewriterBuffer } from "@/hooks/use-typewriter-buffer";

export type GameStreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "finished"
  | "error";

export type StreamingThinking = {
  seat: SeatNumber;
  phase: GamePhase;
  round: number;
  pass?: number;
  text: string;
  actionSummary?: string;
  isStreaming: boolean;
};

export type StreamingAnswer = {
  seat: SeatNumber;
  kind: string;
  text: string;
  isStreaming: boolean;
};

export type GameStreamState = {
  snapshots: GameSnapshot[];
  currentIndex: number;
  status: GameStreamStatus;
  error: string | null;
  gameId: string | null;
  autoFollow: boolean;
  streamingThinking: StreamingThinking | null;
  streamingAnswer: StreamingAnswer | null;
};

export type GameStreamActions = {
  startGame: () => void;
  goTo: (index: number) => void;
  goToLatest: () => void;
  prev: () => void;
  next: () => void;
};

export function useGameStream(): GameStreamState & GameStreamActions {
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<GameStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [streamingThinking, setStreamingThinking] =
    useState<StreamingThinking | null>(null);
  const [streamingAnswer, setStreamingAnswer] =
    useState<StreamingAnswer | null>(null);

  const streamingThinkingRef = useRef<StreamingThinking | null>(null);
  const streamingAnswerRef = useRef<StreamingAnswer | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const snapshotsRef = useRef<GameSnapshot[]>([]);
  const gameIdRef = useRef<string | null>(null);
  const statusRef = useRef<GameStreamStatus>("idle");
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typewriter = useTypewriterBuffer((displayed) => {
    const current = streamingThinkingRef.current;
    if (!current) return;
    current.text = displayed;
    setStreamingThinking({ ...current });
  });

  const answerTypewriter = useTypewriterBuffer((displayed) => {
    const current = streamingAnswerRef.current;
    if (!current) return;
    current.text = displayed;
    setStreamingAnswer({ ...current });
  });

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2_000;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (url: string, skipCount = 0) => {
      cleanup();
      setStatus("connecting");
      statusRef.current = "connecting";
      setError(null);

      const es = new EventSource(url);
      eventSourceRef.current = es;
      let skipped = 0;

      es.addEventListener("gameId", (e) => {
        const data = JSON.parse(e.data) as { gameId: string };
        setGameId(data.gameId);
        gameIdRef.current = data.gameId;
        setStatus("streaming");
        statusRef.current = "streaming";
        retryCountRef.current = 0;
      });

      es.addEventListener("snapshot", (e) => {
        // On reconnect the server replays all snapshots — skip ones we already have
        if (skipped < skipCount) {
          skipped++;
          return;
        }
        const snapshot = JSON.parse(e.data) as GameSnapshot;
        snapshotsRef.current = [...snapshotsRef.current, snapshot];
        setSnapshots(snapshotsRef.current);
        // Flush any buffered typewriter text, then clear streaming state
        typewriter.flush();
        answerTypewriter.flush();
        streamingThinkingRef.current = null;
        setStreamingThinking(null);
        streamingAnswerRef.current = null;
        setStreamingAnswer(null);
        // Auto-follow: advance to latest.
        // Capture length now — if we read snapshotsRef inside the callback,
        // rapid back-to-back snapshots (elimination phase) all see the same
        // final length and the wasAtEnd check fails.
        const newLength = snapshotsRef.current.length;
        setCurrentIndex((prev) => {
          const wasAtEnd = prev >= newLength - 2;
          return wasAtEnd ? newLength - 1 : prev;
        });
      });

      es.addEventListener("thinking:start", (e) => {
        const data = JSON.parse(e.data) as {
          seat: SeatNumber;
          phase: GamePhase;
          round: number;
          pass?: number;
        };
        typewriter.start();
        const entry: StreamingThinking = {
          seat: data.seat,
          phase: data.phase,
          round: data.round,
          pass: data.pass,
          text: "",
          isStreaming: true,
        };
        streamingThinkingRef.current = entry;
        setStreamingThinking({ ...entry });
      });

      es.addEventListener("thinking:delta", (e) => {
        const data = JSON.parse(e.data) as { text: string };
        if (!streamingThinkingRef.current) return;
        typewriter.push(data.text);
      });

      es.addEventListener("thinking:end", (e) => {
        const data = JSON.parse(e.data) as { actionSummary: string };
        const current = streamingThinkingRef.current;
        if (!current) return;
        // Let the buffer drain naturally, then show action summary
        typewriter.onComplete(() => {
          const cur = streamingThinkingRef.current;
          if (!cur) return;
          cur.isStreaming = false;
          cur.actionSummary = data.actionSummary;
          setStreamingThinking({ ...cur });
        });
      });

      es.addEventListener("answer:start", (e) => {
        const data = JSON.parse(e.data) as {
          seat: SeatNumber;
          kind: string;
        };
        answerTypewriter.start();
        const entry: StreamingAnswer = {
          seat: data.seat,
          kind: data.kind,
          text: "",
          isStreaming: true,
        };
        streamingAnswerRef.current = entry;
        setStreamingAnswer({ ...entry });
      });

      es.addEventListener("answer:delta", (e) => {
        const data = JSON.parse(e.data) as { text: string };
        if (!streamingAnswerRef.current) return;
        answerTypewriter.push(data.text);
      });

      es.addEventListener("answer:end", () => {
        const current = streamingAnswerRef.current;
        if (!current) return;
        answerTypewriter.onComplete(() => {
          const cur = streamingAnswerRef.current;
          if (!cur) return;
          cur.isStreaming = false;
          setStreamingAnswer({ ...cur });
        });
      });

      es.addEventListener("finished", () => {
        setStatus("finished");
        statusRef.current = "finished";
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener("error", (e) => {
        // Check if it's a named error event with data
        if (e instanceof MessageEvent && e.data) {
          const data = JSON.parse(e.data) as { message: string };
          setError(data.message);
          setStatus("error");
          statusRef.current = "error";
          es.close();
          eventSourceRef.current = null;
        }
        // Otherwise it's an EventSource connection error — let browser retry
      });

      es.onerror = () => {
        // Always close immediately — prevent EventSource auto-reconnect
        // to the original URL (e.g. ?action=new) which would start a new game.
        es.close();
        eventSourceRef.current = null;

        // Already in a terminal state (server-sent error or game finished)
        if (statusRef.current === "error" || statusRef.current === "finished") return;

        // Auto-reconnect if we have a gameId and retries left
        const gid = gameIdRef.current;
        if (gid && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          retryTimerRef.current = setTimeout(() => {
            connect(`/api/game/stream?gameId=${gid}`, snapshotsRef.current.length);
          }, RETRY_DELAY_MS);
          return;
        }

        setStatus("error");
        statusRef.current = "error";
        setError("Connection lost");
      };
    },
    [cleanup, typewriter, answerTypewriter],
  );

  const startGame = useCallback(() => {
    snapshotsRef.current = [];
    setSnapshots([]);
    setCurrentIndex(0);
    setAutoFollow(true);
    setGameId(null);
    gameIdRef.current = null;
    statusRef.current = "idle";
    retryCountRef.current = 0;
    typewriter.start();
    answerTypewriter.start();
    streamingThinkingRef.current = null;
    setStreamingThinking(null);
    streamingAnswerRef.current = null;
    setStreamingAnswer(null);
    connect("/api/game/stream?action=new");
  }, [connect, typewriter, answerTypewriter]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, snapshots.length - 1));
      setCurrentIndex(clamped);
      if (clamped < snapshots.length - 1) {
        setAutoFollow(false);
      }
    },
    [snapshots.length],
  );

  const goToLatest = useCallback(() => {
    setCurrentIndex(Math.max(0, snapshotsRef.current.length - 1));
    setAutoFollow(true);
  }, []);

  const prev = useCallback(() => {
    setCurrentIndex((i) => {
      const next = Math.max(0, i - 1);
      if (next < snapshotsRef.current.length - 1) {
        setAutoFollow(false);
      }
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => {
      const nextIdx = Math.min(i + 1, snapshotsRef.current.length - 1);
      if (nextIdx >= snapshotsRef.current.length - 1) {
        setAutoFollow(true);
      }
      return nextIdx;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    snapshots,
    currentIndex,
    status,
    error,
    gameId,
    autoFollow,
    streamingThinking,
    streamingAnswer,
    startGame,
    goTo,
    goToLatest,
    prev,
    next,
  };
}
