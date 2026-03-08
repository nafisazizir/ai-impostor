"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4">
      <h1 className="text-foreground text-lg font-medium">
        Something went wrong
      </h1>
      <p className="text-muted-foreground font-mono text-sm">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/80 cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
