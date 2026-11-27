export interface LadderStep {
  tier: number;
  name: string;
  minPoints: number;
}

export const LADDER: ReadonlyArray<LadderStep> = [
  { tier: 1, name: 'Sprout', minPoints: 0 },
  { tier: 2, name: 'Sapling', minPoints: 500 },
  { tier: 3, name: 'Dam Builder', minPoints: 1500 },
  { tier: 4, name: 'Wetland Keeper', minPoints: 3500 },
  { tier: 5, name: 'River Guardian', minPoints: 7000 },
  { tier: 6, name: 'Ocean Guardian', minPoints: 13000 },
];

export interface RankInfo {
  tier: number;
  name: string;
  nextTier: { tier: number; name: string; minPoints: number } | null;
}

export function rankFor(lifetimePoints: number): RankInfo {
  let currentIndex = 0;
  for (let i = 0; i < LADDER.length; i++) {
    if (lifetimePoints >= LADDER[i].minPoints) {
      currentIndex = i;
    }
  }
  const current = LADDER[currentIndex];
  const next = LADDER[currentIndex + 1] ?? null;
  return {
    tier: current.tier,
    name: current.name,
    nextTier: next
      ? { tier: next.tier, name: next.name, minPoints: next.minPoints }
      : null,
  };
}
