import { useCallback, useMemo, useRef } from "react";

const CHARS_PER_FRAME = 3; // ~180 chars/sec at 60fps
const BURST_THRESHOLD = 200;
const BURST_CHARS_PER_FRAME = 12; // ~720 chars/sec catch-up

export function useTypewriterBuffer(onDrain: (displayed: string) => void) {
  const bufferRef = useRef("");
  const displayedRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const onDrainRef = useRef(onDrain);
  onDrainRef.current = onDrain;
  const onCompleteRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<() => void>(null);

  if (tickRef.current === null) {
    tickRef.current = function tick() {
      if (bufferRef.current.length === 0) {
        rafRef.current = null;
        if (onCompleteRef.current) {
          const cb = onCompleteRef.current;
          onCompleteRef.current = null;
          cb();
        }
        return;
      }

      const charsPerFrame =
        bufferRef.current.length > BURST_THRESHOLD
          ? BURST_CHARS_PER_FRAME
          : CHARS_PER_FRAME;

      const chunk = bufferRef.current.slice(0, charsPerFrame);
      bufferRef.current = bufferRef.current.slice(charsPerFrame);
      displayedRef.current += chunk;
      onDrainRef.current(displayedRef.current);

      rafRef.current = requestAnimationFrame(tick);
    };
  }

  const start = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    bufferRef.current = "";
    displayedRef.current = "";
    onCompleteRef.current = null;
  }, []);

  const push = useCallback((text: string) => {
    bufferRef.current += text;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tickRef.current!);
    }
  }, []);

  const flush = useCallback((): string => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onCompleteRef.current = null;
    displayedRef.current += bufferRef.current;
    bufferRef.current = "";
    const full = displayedRef.current;
    onDrainRef.current(full);
    return full;
  }, []);

  const onComplete = useCallback((cb: () => void) => {
    // If buffer is already empty and no rAF is running, fire immediately
    if (bufferRef.current.length === 0 && rafRef.current === null) {
      cb();
      return;
    }
    onCompleteRef.current = cb;
  }, []);

  return useMemo(
    () => ({ start, push, flush, onComplete }),
    [start, push, flush, onComplete],
  );
}
