/**
 * Effective Raw (ERaw) calculator.
 *
 * ERaw = Raw × (1 + Affinity% × CritBonus) × SharpnessMultiplier
 *
 * where CritBonus = (critical damage multiplier − 1): +0.25 at 0 Critical
 * Boost, up to +0.40 at Critical Boost Lv5. Negative affinity hits deal 75%
 * damage and Critical Boost does not apply to them.
 *
 * This is a weapon-quality metric: it compares weapons/skill plans on equal
 * footing. True per-hit damage also depends on motion values, hitzones and
 * quest modifiers, which are deliberately out of scope (see the ERaw page).
 */
import { BASE_CRIT_MULTIPLIER, NEGATIVE_CRIT_MULTIPLIER, critMultipliers, sharpnessByColor, type SharpnessColor } from '../data/sharpness';

export interface ErawInput {
  /** True raw attack (the weapon's true raw, i.e. the displayed attack divided by the class modifier). */
  raw: number;
  /** Weapon affinity in percent, may be negative. */
  affinityPercent: number;
  sharpness: SharpnessColor;
  /** Critical Boost level 0–5. */
  criticalBoostLevel: number;
}

export interface ErawStep {
  label: string;
  formula: string;
  value: number;
}

export interface ErawResult {
  critMultiplier: number;
  /** The (1 + affinity × crit bonus) factor. */
  affinityFactor: number;
  sharpnessMultiplier: number;
  eraw: number;
  /** True when affinity < 0: fixed 0.75 negative-crit penalty applies. */
  negativeAffinity: boolean;
  steps: ErawStep[];
}

export function computeEraw(input: ErawInput): ErawResult {
  const raw = clampNumber(input.raw, 1, 4000);
  const affinity = clampNumber(input.affinityPercent, -100, 100);
  const cbLevel = Math.max(0, Math.min(5, Math.round(input.criticalBoostLevel)));
  const sharp = sharpnessByColor[input.sharpness] ?? sharpnessByColor.white;

  const negative = affinity < 0;
  const critMultiplier = negative ? NEGATIVE_CRIT_MULTIPLIER : critMultipliers[cbLevel];
  // Expected-value form: a fraction |affinity| of hits crits for critMultiplier,
  // the rest deal base damage - 1 − |affinity| × (1 − critMultiplier) handles
  // both the positive (≥ 1) and negative (≤ 1) cases.
  const critFraction = Math.abs(affinity) / 100;
  const affinityFactor = 1 - critFraction * (1 - critMultiplier);
  const eraw = raw * affinityFactor * sharp.raw;

  const steps: ErawStep[] = [
    {
      label: 'Critical hit multiplier',
      formula: negative
        ? `negative affinity → fixed ×${NEGATIVE_CRIT_MULTIPLIER.toFixed(2)} (Critical Boost does not apply)`
        : `1.25 base${cbLevel ? ` + Critical Boost Lv${cbLevel}` : ''} → ×${critMultiplier.toFixed(2)}`,
      value: critMultiplier,
    },
    {
      label: 'Affinity factor',
      formula: `1 ${negative ? '−' : '+'} (${Math.abs(affinity)}% ÷ 100) × ${Math.abs(critMultiplier - 1).toFixed(2)} = ${affinityFactor.toFixed(4)}`,
      value: affinityFactor,
    },
    {
      label: `${sharp.label} sharpness multiplier`,
      formula: `×${sharp.raw.toFixed(2)}`,
      value: sharp.raw,
    },
    {
      label: 'Effective raw',
      formula: `${raw} × ${affinityFactor.toFixed(4)} × ${sharp.raw.toFixed(2)} = ${eraw.toFixed(1)}`,
      value: eraw,
    },
  ];

  return {
    critMultiplier,
    affinityFactor,
    sharpnessMultiplier: sharp.raw,
    eraw,
    negativeAffinity: negative,
    steps,
  };
}

/** Same weapon at every sharpness tier - the comparison table on the ERaw page. */
export function compareSharpness(input: ErawInput): { color: SharpnessColor; label: string; eraw: number }[] {
  const tiers = ['red', 'orange', 'yellow', 'green', 'blue', 'white', 'purple'] as SharpnessColor[];
  return tiers.map((color) => {
    const r = computeEraw({ ...input, sharpness: color });
    return { color, label: sharpnessByColor[color].label, eraw: r.eraw };
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export { BASE_CRIT_MULTIPLIER };
