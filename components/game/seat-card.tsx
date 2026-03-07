import { createElement } from "react";
import { playerLogo, playerName } from "@/lib/game/players";
import type { Role, SeatNumber } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ROLE_STYLE } from "@/lib/game/ui-helpers";

export function SeatCard({
  seat,
  role,
  isAlive,
  isActive,
  isRevealed,
  isWinner = false,
  lastAction,
  voteCount = 0,
}: {
  seat: SeatNumber;
  role: Role;
  isAlive: boolean;
  isActive: boolean;
  isRevealed: boolean;
  isWinner?: boolean;
  lastAction?: { text: string; hasActed: boolean } | null;
  voteCount?: number;
}) {
  const isDead = !isAlive;
  const isFinished = isAlive && isRevealed;
  const isInactive = isAlive && !isActive && !isFinished;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 p-3 transition-opacity duration-300",
        isInactive && "opacity-70",
      )}
    >
      <div
        className={cn(
          "relative transition-opacity duration-300",
          isDead && "opacity-40",
        )}
      >
        {createElement(playerLogo(seat), {
          className: cn("size-9", isDead && "grayscale"),
        })}
        {voteCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-4 size-4.5 p-0 font-mono"
          >
            {voteCount}
          </Badge>
        )}
      </div>

      <span
        className={cn(
          "max-w-full truncate font-mono text-xs transition-opacity duration-300",
          isActive && "animate-thinking",
          isDead && "line-through opacity-40",
          isWinner && "text-green-400",
        )}
      >
        {playerName(seat)}
      </span>

      {lastAction && !isFinished && (
        <span className="text-muted-foreground/50 text-center font-mono text-xs">
          {lastAction.text}
        </span>
      )}

      {isRevealed && (
        <span
          className={cn(
            "rounded-sm px-2 py-0.5 font-mono text-xs",
            ROLE_STYLE[role].className,
          )}
        >
          {ROLE_STYLE[role].label}
        </span>
      )}
    </div>
  );
}
