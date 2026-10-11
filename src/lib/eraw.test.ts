import { describe, expect, it } from 'vitest';
import { computeEraw, compareSharpness } from './eraw';
import { sharpnessTiers, critMultipliers } from '../data/sharpness';

describe('computeEraw', () => {
  it('applies the standard formula: raw × (1 + affinity × 0.25) × sharpness', () => {
    // 200 raw, 40% affinity, white sharpness, no Critical Boost:
    // 200 × (1 + 0.40 × 0.25) × 1.32 = 200 × 1.10 × 1.32 = 290.4
    const r = computeEraw({ raw: 200, affinityPercent: 40, sharpness: 'white', criticalBoostLevel: 0 });
    expect(r.affinityFactor).toBeCloseTo(1.1, 6);
    expect(r.eraw).toBeCloseTo(290.4, 4);
    expect(r.negativeAffinity).toBe(false);
  });

  it('works with a real weapon preset profile (210 raw, 15% affinity, white)', () => {
    // 210 × (1 + 0.15 × 0.25) × 1.32 = 210 × 1.0375 × 1.32 = 287.595
    const r = computeEraw({ raw: 210, affinityPercent: 15, sharpness: 'white', criticalBoostLevel: 0 });
    expect(r.eraw).toBeCloseTo(287.595, 3);
  });

  it('uses Critical Boost Lv5 to reach a 1.40 crit multiplier', () => {
    // 200 × (1 + 1.00 × 0.40) × 1.32 = 200 × 1.40 × 1.32 = 369.6
    const r = computeEraw({ raw: 200, affinityPercent: 100, sharpness: 'white', criticalBoostLevel: 5 });
    expect(r.critMultiplier).toBeCloseTo(1.4, 6);
    expect(r.eraw).toBeCloseTo(369.6, 4);
  });

  it('applies the fixed 0.75 penalty to negative affinity and ignores Critical Boost', () => {
    // 250 × (1 − 0.20 × 0.25) × 1.39 = 250 × 0.95 × 1.39 = 330.125
    const r = computeEraw({ raw: 250, affinityPercent: -20, sharpness: 'purple', criticalBoostLevel: 5 });
    expect(r.negativeAffinity).toBe(true);
    expect(r.critMultiplier).toBeCloseTo(0.75, 6);
    expect(r.affinityFactor).toBeCloseTo(0.95, 6);
    expect(r.eraw).toBeCloseTo(330.125, 3);
  });

  it('uses the correct sharpness multipliers, including purple 1.39', () => {
    const base = { raw: 100, affinityPercent: 0, criticalBoostLevel: 0 } as const;
    expect(computeEraw({ ...base, sharpness: 'red' }).eraw).toBeCloseTo(50, 6);
    expect(computeEraw({ ...base, sharpness: 'orange' }).eraw).toBeCloseTo(75, 6);
    expect(computeEraw({ ...base, sharpness: 'yellow' }).eraw).toBeCloseTo(100, 6);
    expect(computeEraw({ ...base, sharpness: 'green' }).eraw).toBeCloseTo(105, 6);
    expect(computeEraw({ ...base, sharpness: 'blue' }).eraw).toBeCloseTo(120, 6);
    expect(computeEraw({ ...base, sharpness: 'white' }).eraw).toBeCloseTo(132, 6);
    expect(computeEraw({ ...base, sharpness: 'purple' }).eraw).toBeCloseTo(139, 6);
  });

  it('clamps absurd inputs instead of producing nonsense', () => {
    expect(computeEraw({ raw: 0, affinityPercent: 0, sharpness: 'white', criticalBoostLevel: 0 }).eraw).toBeCloseTo(1.32, 6);
    const r = computeEraw({ raw: 200, affinityPercent: 500, sharpness: 'white', criticalBoostLevel: 9 });
    expect(r.affinityFactor).toBeCloseTo(1.4, 6); // affinity clamped to 100, CB to 5
  });

  it('exposes step-by-step workings for the UI', () => {
    const r = computeEraw({ raw: 200, affinityPercent: 40, sharpness: 'white', criticalBoostLevel: 0 });
    expect(r.steps).toHaveLength(4);
    expect(r.steps.at(-1)!.formula).toContain('290.4');
  });
});

describe('compareSharpness', () => {
  it('ranks all seven tiers in ascending order', () => {
    const rows = compareSharpness({ raw: 200, affinityPercent: 0, sharpness: 'white', criticalBoostLevel: 0 });
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.color)).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'white', 'purple']);
    for (let i = 1; i < rows.length; i++) expect(rows[i].eraw).toBeGreaterThan(rows[i - 1].eraw);
  });
});

describe('sharpness reference table integrity', () => {
  it('matches the cited community values', () => {
    expect(sharpnessTiers.find((t) => t.color === 'white')!.raw).toBe(1.32);
    expect(sharpnessTiers.find((t) => t.color === 'purple')!.raw).toBe(1.39);
    expect(sharpnessTiers.find((t) => t.color === 'blue')!.raw).toBe(1.2);
  });

  it('lists critical boost multipliers 1.25 → 1.40 in steps of 0.03', () => {
    expect(critMultipliers).toEqual([1.25, 1.28, 1.31, 1.34, 1.37, 1.4]);
  });
});
