import Image from "next/image";

import { playerLogo, playerName } from "@/lib/game/players";
import type { Role, SeatNumber } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, { label: string; className: string }> = {
  civilian: { label: "Civilian", className: "text-blue-400" },
  impostor: { label: "Impostor", className: "text-red-400" },
  mr_white: { label: "Mr. White", className: "text-white/70" },
};

export function SeatCard({
  seat,
  role,
  isAlive,
  isActive,
  isRevealed,
}: {
  seat: SeatNumber;
  role: Role;
  isAlive: boolean;
  isActive: boolean;
  isRevealed: boolean;
}) {
  const isDead = !isAlive;
  const isInactive = isAlive && !isActive;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 p-3 transition-opacity duration-300",
        isInactive && "opacity-70",
        isDead && "opacity-40",
      )}
    >
      <Image
        src={playerLogo(seat)}
        alt={playerName(seat)}
        width={36}
        height={36}
        className={cn("size-9", isDead && "grayscale")}
      />

      <span
        className={cn(
          "max-w-full truncate font-mono text-xs",
          isActive && "animate-thinking",
          isDead && "line-through",
        )}
      >
        {playerName(seat)}
      </span>

      {isRevealed && (() => {
        const roleInfo = ROLE_LABEL[role];
        return (
          <span
            className={cn(
              "font-mono text-[10px] tracking-wider uppercase",
              roleInfo.className,
            )}
          >
            {roleInfo.label}
          </span>
        );
      })()}
    </div>
  );
}
