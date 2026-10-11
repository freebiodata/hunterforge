/**
 * Sharpness multipliers and affinity rules - hand-verified from community
 * sources on 2026-10-11 (see src/data/sources.ts for the full citation list).
 *
 * Raw (physical) multipliers are consistent across all sources checked:
 * Fextralife (Red→White), Reddit r/MonsterHunter sharpness threads and the
 * Nexus Mods "Max Purple Sharpness" page (Purple 1.39, White 1.32).
 *
 * Elemental multipliers are secondary reference values: Purple 1.25 and
 * White 1.15 are confirmed by the same sources, but the Blue value varies
 * between them (1.05 vs 1.0625) - flagged below and in the UI.
 */

export type SharpnessColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'white' | 'purple';

export interface SharpnessTier {
  color: SharpnessColor;
  label: string;
  /** Physical (raw) damage multiplier. */
  raw: number;
  /** Elemental damage multiplier - reference only, see file header. */
  element: number;
  /** True when community sources disagree on this tier's value. */
  disputed?: boolean;
}

export const sharpnessTiers: SharpnessTier[] = [
  { color: 'red', label: 'Red', raw: 0.5, element: 0.25 },
  { color: 'orange', label: 'Orange', raw: 0.75, element: 0.5 },
  { color: 'yellow', label: 'Yellow', raw: 1.0, element: 0.75 },
  { color: 'green', label: 'Green', raw: 1.05, element: 1.0 },
  { color: 'blue', label: 'Blue', raw: 1.2, element: 1.05, disputed: true },
  { color: 'white', label: 'White', raw: 1.32, element: 1.15 },
  { color: 'purple', label: 'Purple', raw: 1.39, element: 1.25 },
];

export const sharpnessByColor: Record<SharpnessColor, SharpnessTier> = Object.fromEntries(
  sharpnessTiers.map((t) => [t.color, t])
) as Record<SharpnessColor, SharpnessTier>;

/**
 * Critical hit rules (verified against in-game skill descriptions in the
 * game-file dataset): base critical hits deal 125% damage; Critical Boost
 * Lv1–5 raises that to 128/131/134/137/140%. Negative affinity hits deal 75%
 * damage and are NOT affected by Critical Boost.
 */
export const BASE_CRIT_MULTIPLIER = 1.25;
export const NEGATIVE_CRIT_MULTIPLIER = 0.75;

/** Critical Boost level 0–5 -> critical hit damage multiplier. */
export const critMultipliers: number[] = [1.25, 1.28, 1.31, 1.34, 1.37, 1.4];
