import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

export function ThinkingPanelToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "bg-background hover:bg-muted text-muted-foreground absolute z-20 flex cursor-pointer items-center justify-center transition-all duration-300",
        "bottom-0 left-1/2 h-5 w-10 -translate-x-1/2 rounded-t-lg border-b-0",
        open ? "max-md:bottom-[25vh]" : "max-md:bottom-0",
        "md:top-1/2 md:bottom-auto md:left-auto md:h-10 md:w-5 md:translate-x-0 md:-translate-y-1/2 md:rounded-t-none md:rounded-l-lg",
        open ? "md:right-80 xl:right-96" : "md:right-0",
      )}
      aria-label={
        open ? "Collapse thinking panel" : "Expand thinking panel"
      }
    >
      {open ? (
        <>
          <ChevronDown className="size-3.5 md:hidden" />
          <ChevronRight className="hidden size-3.5 md:block" />
        </>
      ) : (
        <>
          <ChevronUp className="size-3.5 md:hidden" />
          <ChevronLeft className="hidden size-3.5 md:block" />
        </>
      )}
    </button>
  );
}
