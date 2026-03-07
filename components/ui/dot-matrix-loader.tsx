"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const config = {
  sm: { cols: 32, size: 4, gap: 2 },
  md: { cols: 12, size: 6, gap: 3 },
} as const;

function generatePattern(total: number) {
  return Array.from({ length: total }, () => {
    const visible = Math.random() < 0.5;
    return visible ? 0.5 + Math.random() * 0.5 : 0;
  });
}

function DotMatrixLoader({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const { cols, size: blockSize, gap } = config[size];
  const total = cols * 2;

  const [opacities, setOpacities] = useState(() => generatePattern(total));

  useEffect(() => {
    const id = setInterval(() => setOpacities(generatePattern(total)), 150);
    return () => clearInterval(id);
  }, [total]);

  return (
    <div
      data-slot="dot-matrix-loader"
      role="status"
      aria-label="Loading"
      className={cn("inline-grid", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${blockSize}px)`,
        gap: `${gap}px`,
      }}
    >
      {opacities.map((opacity, i) => (
        <span
          key={i}
          className="dot-matrix-block"
          style={{
            width: blockSize,
            height: blockSize,
            opacity,
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export { DotMatrixLoader };
