interface LadderStep {
  tier: number;
  name: string;
  minPoints: number;
}

const LADDER: ReadonlyArray<LadderStep> = [
  { tier: 1, name: 'Sprout', minPoints: 0 },
  { tier: 2, name: 'Sapling', minPoints: 500 },
  { tier: 3, name: 'Dam Builder', minPoints: 1500 },
  { tier: 4, name: 'Wetland Keeper', minPoints: 3500 },
  { tier: 5, name: 'River Guardian', minPoints: 7000 },
  { tier: 6, name: 'Ocean Guardian', minPoints: 13000 },
];

export function rankFor(lifetimePoints: number): { tier: number; name: string } {
  let current = LADDER[0];
  for (const step of LADDER) {
    if (lifetimePoints >= step.minPoints) {
      current = step;
    }
  }
  return { tier: current.tier, name: current.name };
}
