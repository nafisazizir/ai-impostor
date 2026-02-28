import type { GameState } from "@/lib/game/state";
import type { ThinkingEntry } from "@/lib/game/types";

export type GameSnapshot = {
  index: number;
  label: string;
  state: GameState;
  thinking: ThinkingEntry[];
  newThinkingStartIndex: number;
};
