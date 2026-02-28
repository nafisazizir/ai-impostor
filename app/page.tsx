import { mockSnapshots } from "@/lib/game/mock-states";

import { GameSpectator } from "@/components/game/game-spectator";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const isMock = params.mock === "true";

  if (isMock) {
    return <GameSpectator mode="mock" snapshots={mockSnapshots} />;
  }

  return <GameSpectator mode="live" />;
}
