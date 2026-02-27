import type { Rng } from "@/lib/game/engine/types";

export function createSeededRng(seed: number): Rng {
  // Mulberry32: compact deterministic PRNG suitable for repeatable simulations.
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = t;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
