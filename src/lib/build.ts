/**
 * Build aggregation engine: takes an equipped loadout (5 pieces + charm +
 * decorations) and computes the full skill table with level caps, set bonus
 * activation (2/4-piece thresholds) and group skill activation (3 pieces
 * sharing a group skill name).
 */
import { armorById, charmById, decoById, setBonusByKey, groupSkillByName, setMembership, skillById } from '../data/lookup';
import type { ArmorPiece, Charm, PieceKind, PieceSkill } from '../data/types';

export interface BuildState {
  /** Equipped piece id per body slot (undefined = empty). */
  pieces: Partial<Record<PieceKind, number>>;
  /** Equipped charm rank id (undefined = none). Charms have no deco slots. */
  charmId?: number;
  /** pieceId -> one entry per decoration slot (null = empty slot). */
  decos: Record<number, (number | null)[]>;
}

export type ContributionSource = 'armor' | 'charm' | 'deco' | 'set' | 'group';

export interface SkillContribution {
  sourceType: ContributionSource;
  /** Human-readable origin, e.g. "Rey Sandhelm α", "Challenger Jewel [2]", "Rey Dau's Voltage (2 pieces)". */
  source: string;
  level: number;
}

export interface SkillTotal {
  skillId: number;
  name: string;
  kind: string;
  maxLevel: number;
  /** Sum of all equipped levels BEFORE the cap is applied. */
  rawLevel: number;
  /** Effective level after the in-game cap. */
  level: number;
  /** Levels past the cap - wasted budget, surfaced in the UI. */
  wasted: number;
  contributions: SkillContribution[];
}

export interface ActiveSetBonus {
  key: string;
  skillName: string;
  /** Highest activated rank, 0 if none. */
  level: number;
  /** Equipped pieces feeding this bonus. */
  pieces: number;
  /** Next threshold not yet reached, if any. */
  nextAt: number | null;
  /** Rank name of the activated level, e.g. "Thunderous Roar I". */
  rankName: string | null;
}

export interface ActiveGroupSkill {
  groupSkillName: string;
  grantedSkillName: string;
  active: boolean;
  /** Equipped pieces carrying this group skill. */
  pieces: number;
  required: number;
}

export interface BuildResult {
  skills: SkillTotal[];
  setBonuses: ActiveSetBonus[];
  groupSkills: ActiveGroupSkill[];
  defense: { base: number; max: number };
  resistances: { fire: number; water: number; ice: number; thunder: number; dragon: number };
  /** Deco slots: filled / total across all equipped pieces. */
  slots: { filled: number; total: number };
  /** Equipped pieces (may be fewer than 5). */
  equipped: ArmorPiece[];
  charm: Charm | null;
  /** Honest problems found while aggregating (bad deco fits etc.). */
  issues: string[];
}

function emptyTotals(): BuildResult {
  return {
    skills: [],
    setBonuses: [],
    groupSkills: [],
    defense: { base: 0, max: 0 },
    resistances: { fire: 0, water: 0, ice: 0, thunder: 0, dragon: 0 },
    slots: { filled: 0, total: 0 },
    equipped: [],
    charm: null,
    issues: [],
  };
}

class SkillAccumulator {
  private map = new Map<number, SkillTotal>();

  add(skill: PieceSkill, contribution: SkillContribution) {
    const def = skillById.get(skill.skillId);
    const name = skill.name ?? def?.name ?? `Skill #${skill.skillId}`;
    let total = this.map.get(skill.skillId);
    if (!total) {
      total = {
        skillId: skill.skillId,
        name,
        kind: def?.kind ?? 'armor',
        maxLevel: def?.maxLevel ?? 5,
        rawLevel: 0,
        level: 0,
        wasted: 0,
        contributions: [],
      };
      this.map.set(skill.skillId, total);
    }
    total.rawLevel += skill.level;
    total.contributions.push({ ...contribution, level: skill.level });
  }

  finish(): SkillTotal[] {
    const list = [...this.map.values()];
    for (const t of list) {
      t.level = Math.min(t.rawLevel, t.maxLevel);
      t.wasted = t.rawLevel - t.level;
      // Contributions stay in acquisition order (pieces by body slot, then
      // decorations, charm, set/group bonuses) - that reads naturally in the UI.
    }
    return list.sort((a, b) => b.level - a.level || b.rawLevel - a.rawLevel || a.name.localeCompare(b.name));
  }
}

export function aggregateBuild(state: BuildState): BuildResult {
  const result = emptyTotals();
  const acc = new SkillAccumulator();

  // --- equipped pieces + their decorations -------------------------------
  const pieces: ArmorPiece[] = [];
  for (const pieceId of Object.values(state.pieces)) {
    if (pieceId === undefined) continue;
    const piece = armorById.get(pieceId);
    if (!piece) {
      result.issues.push(`Unknown armor piece #${pieceId} ignored.`);
      continue;
    }
    pieces.push(piece);
    for (const s of piece.skills) acc.add(s, { sourceType: 'armor', source: piece.name, level: s.level });
    result.defense.base += piece.defenseBase;
    result.defense.max += piece.defenseMax;
    for (const key of ['fire', 'water', 'ice', 'thunder', 'dragon'] as const) {
      result.resistances[key] += piece.resistances[key];
    }
    result.slots.total += piece.slots.length;
  }
  result.equipped = pieces;

  // --- decorations --------------------------------------------------------
  for (const [pieceIdKey, decoIds] of Object.entries(state.decos)) {
    const pieceId = Number(pieceIdKey);
    const piece = armorById.get(pieceId);
    if (!piece) {
      result.issues.push(`Decorations for unknown piece #${pieceId} ignored.`);
      continue;
    }
    if (!pieces.some((p) => p.id === pieceId)) {
      result.issues.push(`Decorations set for ${piece.name}, which is not equipped.`);
      continue;
    }
    decoIds.forEach((decoId, slotIndex) => {
      if (decoId === null || decoId === undefined) return;
      const deco = decoById.get(decoId);
      const slotLevel = piece.slots[slotIndex];
      if (!deco) {
        result.issues.push(`Unknown decoration #${decoId} ignored.`);
        return;
      }
      if (slotLevel === undefined) {
        result.issues.push(`${deco.name} set in slot ${slotIndex + 1} of ${piece.name}, which has only ${piece.slots.length} slots - ignored.`);
        return;
      }
      if (deco.kind !== 'armor') {
        result.issues.push(`${deco.name} is a weapon decoration - it cannot fit armor slots.`);
        return;
      }
      if (deco.slot > slotLevel) {
        result.issues.push(`${deco.name} (needs a Lv${deco.slot} slot) does not fit the Lv${slotLevel} slot on ${piece.name}.`);
        return;
      }
      result.slots.filled += 1;
      for (const s of deco.skills) acc.add(s, { sourceType: 'deco', source: deco.name, level: s.level });
    });
  }

  // --- charm ---------------------------------------------------------------
  if (state.charmId !== undefined) {
    const charm = charmById.get(state.charmId);
    if (!charm) {
      result.issues.push(`Unknown charm #${state.charmId} ignored.`);
    } else {
      result.charm = charm;
      for (const s of charm.skills) acc.add(s, { sourceType: 'charm', source: charm.name, level: s.level });
    }
  }

  // --- set bonuses (pool pieces by bonus identity, fire at 2/4) -----------
  const bonusCounts = new Map<string, number>();
  for (const piece of pieces) {
    const key = setMembership(piece.id)?.setBonusKey;
    if (key) bonusCounts.set(key, (bonusCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of bonusCounts) {
    const bonus = setBonusByKey.get(key);
    if (!bonus) continue;
    let active = bonus.ranks[0];
    for (const rank of bonus.ranks) if (count >= rank.pieces) active = rank;
    const reached = active && count >= active.pieces ? active : null;
    const next = bonus.ranks.find((r) => count < r.pieces) ?? null;
    result.setBonuses.push({
      key,
      skillName: bonus.skillName,
      level: reached ? reached.level : 0,
      pieces: count,
      nextAt: next ? next.pieces : null,
      rankName: reached ? reached.rankName : null,
    });
    if (reached) {
      acc.add(
        { skillId: bonus.skillId, name: bonus.skillName, level: reached.level },
        { sourceType: 'set', source: `${bonus.skillName} (${reached.pieces} pieces)`, level: reached.level }
      );
    }
  }
  result.setBonuses.sort((a, b) => b.level - a.level || a.skillName.localeCompare(b.skillName));

  // --- group skills (pool by group skill name across sets, fire at 3) ------
  const groupCounts = new Map<string, number>();
  for (const piece of pieces) {
    const name = setMembership(piece.id)?.groupSkillName;
    if (name) groupCounts.set(name, (groupCounts.get(name) ?? 0) + 1);
  }
  for (const [name, count] of groupCounts) {
    const group = groupSkillByName.get(name);
    if (!group) continue;
    const active = count >= group.pieces;
    result.groupSkills.push({
      groupSkillName: name,
      grantedSkillName: group.grantedSkillName,
      active,
      pieces: count,
      required: group.pieces,
    });
    if (active) {
      acc.add(
        { skillId: group.grantedSkillId, name: group.grantedSkillName, level: group.level },
        { sourceType: 'group', source: `${name} (${group.pieces} pieces)`, level: group.level }
      );
    }
  }
  result.groupSkills.sort((a, b) => Number(b.active) - Number(a.active) || a.groupSkillName.localeCompare(b.groupSkillName));

  result.skills = acc.finish();
  return result;
}

/** Total levels actually in effect (capped) - the number builders care about. */
export function totalActiveLevels(result: BuildResult): number {
  return result.skills.reduce((n, s) => n + s.level, 0);
}
