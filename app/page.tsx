import { mockSnapshots } from "@/lib/game/mock-states";

import { GameSpectator } from "@/components/game/game-spectator";

export default function Home() {
  return <GameSpectator snapshots={mockSnapshots} />;
}
