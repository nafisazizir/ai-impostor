"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GameSnapshot } from "@/lib/game/snapshot";
import type { SeatNumber, GamePhase } from "@/lib/game/types";
import { deriveActiveSeat } from "@/lib/game/ui-helpers";
import { useTypewriterBuffer } from "@/hooks/use-typewriter-buffer";

export type GameStreamStatus =
  | "connecting"
  | "streaming"
  | "between-games"
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

export type StreamMode = "live" | "replay" | null;

export type GameStreamState = {
  snapshots: GameSnapshot[];
  currentIndex: number;
  status: GameStreamStatus;
  error: string | null;
  gameId: string | null;
  autoFollow: boolean;
  streamingThinking: StreamingThinking | null;
  streamingAnswer: StreamingAnswer | null;
  mode: StreamMode;
};

export type GameStreamActions = {
  reconnect: () => void;
  goTo: (index: number) => void;
  goToLatest: () => void;
  prev: () => void;
  next: () => void;
};

export function useGameStream(): GameStreamState & GameStreamActions {
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<GameStreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [streamingThinking, setStreamingThinking] =
    useState<StreamingThinking | null>(null);
  const [streamingAnswer, setStreamingAnswer] =
    useState<StreamingAnswer | null>(null);
  const [mode, setMode] = useState<StreamMode>(null);

  const streamingThinkingRef = useRef<StreamingThinking | null>(null);
  const streamingAnswerRef = useRef<StreamingAnswer | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const snapshotsRef = useRef<GameSnapshot[]>([]);
  const gameIdRef = useRef<string | null>(null);
  const statusRef = useRef<GameStreamStatus>("connecting");
  const modeRef = useRef<StreamMode>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WDK stream tracking for reconnection
  const runIdRef = useRef<string | null>(null);
  const streamPositionRef = useRef(0);
  const connectRef = useRef<((url: string) => void) | null>(null);

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

  const clearStreamingState = useCallback(() => {
    typewriter.start();
    answerTypewriter.start();
    streamingThinkingRef.current = null;
    setStreamingThinking(null);
    streamingAnswerRef.current = null;
    setStreamingAnswer(null);
  }, [typewriter, answerTypewriter]);

  const connect = useCallback(
    (url: string) => {
      cleanup();
      setStatus("connecting");
      statusRef.current = "connecting";
      setError(null);

      const es = new EventSource(url);
      eventSourceRef.current = es;

      // Connection metadata (new viewer only — contains runId + startIndex + mode)
      es.addEventListener("meta", (e) => {
        const data = JSON.parse(e.data) as {
          runId: string | null;
          startIndex: number;
          mode?: "live" | "replay";
        };
        runIdRef.current = data.runId;
        streamPositionRef.current = data.startIndex;
        if (data.mode) {
          setMode(data.mode);
          modeRef.current = data.mode;
        }
      });

      es.addEventListener("gameId", (e) => {
        const data = JSON.parse(e.data) as { gameId: string };
        streamPositionRef.current++;

        // New game starting — reset state
        snapshotsRef.current = [];
        setSnapshots([]);
        setCurrentIndex(0);
        setAutoFollow(true);
        clearStreamingState();

        setGameId(data.gameId);
        gameIdRef.current = data.gameId;
        setStatus("streaming");
        statusRef.current = "streaming";
        retryCountRef.current = 0;
      });

      es.addEventListener("snapshot", (e) => {
        streamPositionRef.current++;
        const snapshot = JSON.parse(e.data) as GameSnapshot;
        snapshotsRef.current = [...snapshotsRef.current, snapshot];
        setSnapshots(snapshotsRef.current);

        // Cancel typewriter without flushing to avoid text flash
        clearStreamingState();

        // Show pending thinking animation for the next active player
        const activeSeat = deriveActiveSeat(snapshot.state);
        if (activeSeat && snapshot.state.currentPhase !== "finished") {
          const pending: StreamingThinking = {
            seat: activeSeat,
            phase: snapshot.state.currentPhase,
            round: snapshot.state.currentRound,
            pass:
              snapshot.state.currentPhase === "discussion"
                ? snapshot.state.discussionPass
                : undefined,
            text: "",
            isStreaming: true,
          };
          streamingThinkingRef.current = pending;
          setStreamingThinking({ ...pending });
        }

        // Auto-follow: advance to latest
        const newLength = snapshotsRef.current.length;
        setCurrentIndex((prev) => {
          const wasAtEnd = prev >= newLength - 2;
          return wasAtEnd ? newLength - 1 : prev;
        });
      });

      es.addEventListener("thinking:start", (e) => {
        streamPositionRef.current++;
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
        streamPositionRef.current++;
        const data = JSON.parse(e.data) as { text: string };
        if (!streamingThinkingRef.current) return;
        typewriter.push(data.text);
      });

      es.addEventListener("thinking:end", () => {
        streamPositionRef.current++;
        // Don't set actionSummary or isStreaming=false here.
        // actionSummary will render from snapshot data.
        // Shimmer stays active until answer typewriter completes.
      });

      es.addEventListener("answer:start", (e) => {
        streamPositionRef.current++;
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
        streamPositionRef.current++;
        const data = JSON.parse(e.data) as { text: string };
        if (!streamingAnswerRef.current) return;
        answerTypewriter.push(data.text);
      });

      es.addEventListener("answer:end", () => {
        streamPositionRef.current++;
        const current = streamingAnswerRef.current;
        if (!current) return;
        answerTypewriter.onComplete(() => {
          const cur = streamingAnswerRef.current;
          if (!cur) return;
          cur.isStreaming = false;
          setStreamingAnswer({ ...cur });
          // Stop thinking shimmer now that all streaming is complete
          const thinkCur = streamingThinkingRef.current;
          if (thinkCur && thinkCur.isStreaming) {
            thinkCur.isStreaming = false;
            setStreamingThinking({ ...thinkCur });
          }
        });
      });

      es.addEventListener("finished", () => {
        streamPositionRef.current++;
        // Don't close — the workflow will start the next game
        setStatus("between-games");
        statusRef.current = "between-games";
        clearStreamingState();
      });

      es.addEventListener("error", (e) => {
        if (e instanceof MessageEvent && e.data) {
          const data = JSON.parse(e.data) as { message: string };
          setError(data.message);
          setStatus("error");
          statusRef.current = "error";
          es.close();
          eventSourceRef.current = null;
        }
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (
          statusRef.current === "error"
        )
          return;

        // Replay ended — auto-reconnect to get next game (replay or live)
        if (modeRef.current === "replay" && statusRef.current === "between-games") {
          retryTimerRef.current = setTimeout(() => {
            connectRef.current?.("/api/game/stream");
          }, RETRY_DELAY_MS);
          return;
        }

        // Auto-reconnect with WDK stream position
        const rid = runIdRef.current;
        const pos = streamPositionRef.current;
        if (rid && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          retryTimerRef.current = setTimeout(() => {
            connectRef.current?.(
              `/api/game/stream?runId=${rid}&startIndex=${pos}`,
            );
          }, RETRY_DELAY_MS);
          return;
        }

        setStatus("error");
        statusRef.current = "error";
        setError("Connection lost");
      };
    },
    [cleanup, clearStreamingState, typewriter, answerTypewriter],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Reconnect action — for error recovery
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;

    // If we have a runId, reconnect from current position
    const rid = runIdRef.current;
    const pos = streamPositionRef.current;
    if (rid && pos > 0) {
      connect(`/api/game/stream?runId=${rid}&startIndex=${pos}`);
    } else {
      // Fresh connection
      snapshotsRef.current = [];
      setSnapshots([]);
      setCurrentIndex(0);
      setAutoFollow(true);
      setGameId(null);
      setMode(null);
      modeRef.current = null;
      gameIdRef.current = null;
      runIdRef.current = null;
      streamPositionRef.current = 0;
      clearStreamingState();
      connect("/api/game/stream");
    }
  }, [connect, clearStreamingState]);

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

  // Auto-connect on mount (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      connectRef.current?.("/api/game/stream");
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup();
    };
  }, [cleanup]);

  return {
    snapshots,
    currentIndex,
    status,
    error,
    gameId,
    autoFollow,
    streamingThinking,
    streamingAnswer,
    mode,
    reconnect,
    goTo,
    goToLatest,
    prev,
    next,
  };
}
