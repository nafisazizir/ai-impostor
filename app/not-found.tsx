import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4">
      <h1 className="text-foreground text-lg font-medium">Page not found</h1>
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
      >
        Back to live game
      </Link>
    </div>
  );
}
