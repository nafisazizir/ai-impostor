import type { SeatNumber } from "@/lib/game/types";
import type { GameSummary } from "@/lib/game/persisted";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getImpostorSeat(summary: GameSummary): SeatNumber {
  for (const [seat, role] of Object.entries(summary.rolesBySeat)) {
    if (role === "impostor") return Number(seat) as SeatNumber;
  }
  throw new Error("No impostor found in game summary");
}

export function getMrWhiteSeat(summary: GameSummary): SeatNumber {
  for (const [seat, role] of Object.entries(summary.rolesBySeat)) {
    if (role === "mr_white") return Number(seat) as SeatNumber;
  }
  throw new Error("No mr_white found in game summary");
}
