import test from 'node:test';
import assert from 'node:assert/strict';
import { rankFor } from '../src/users/ladder.js';

test('rankFor returns Sprout at 0 XP with Sapling as nextTier', () => {
  const rank = rankFor(0);
  assert.equal(rank.tier, 1);
  assert.equal(rank.name, 'Sprout');
  assert.deepEqual(rank.nextTier, { tier: 2, name: 'Sapling', minPoints: 500 });
});

test('rankFor transitions at exact thresholds', () => {
  assert.equal(rankFor(499).name, 'Sprout');
  assert.equal(rankFor(500).name, 'Sapling');
  assert.equal(rankFor(1500).name, 'Dam Builder');
  assert.equal(rankFor(3500).name, 'Wetland Keeper');
  assert.equal(rankFor(7000).name, 'River Guardian');
  assert.equal(rankFor(13000).name, 'Ocean Guardian');
});

test('rankFor returns null nextTier at max rank', () => {
  const rank = rankFor(20000);
  assert.equal(rank.tier, 6);
  assert.equal(rank.nextTier, null);
});
