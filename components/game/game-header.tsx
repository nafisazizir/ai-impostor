"use client";

import { useEffect, useState } from "react";

export function GameHeader() {
  // dummy elapsed time
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <header className="flex flex-col items-center justify-center p-4 tracking-tight">
      <h1 className="text-2xl text-balance">Impostor</h1>
      <span className="text-muted-foreground mt-1 font-mono text-sm tabular-nums">
        {display}
      </span>
    </header>
  );
}
