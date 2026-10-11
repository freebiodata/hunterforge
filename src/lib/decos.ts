/**
 * Decoration planning: what fits where, quick-fill for a skill priority list,
 * and "which decorations to farm" for a target skill plan.
 */
import { armorDecosGrantingSkill, decoById } from '../data/lookup';
import { decorations } from '../data/decorations';
import type { ArmorPiece, Decoration } from '../data/types';

/** A decoration can only be set into a slot of at least its own level. */
export function decoFitsSlot(deco: Decoration, slotLevel: number): boolean {
  return deco.kind === 'armor' && deco.slot <= slotLevel;
}

/**
 * Greedy quick-fill: for every equipped decoration slot (biggest first), pick
 * the armor decoration that grants the most of the wanted skills, honouring
 * the priority order (earlier skill = more valuable). Ties prefer the
 * smallest slot requirement (keeping big slots free) and then the name, so
 * the result is deterministic.
 *
 * Returns a full assignment map (pieceId -> per-slot deco id or null),
 * leaving existing manual choices untouched only when `keep` is passed.
 */
export function autoAssignDecos(
  pieces: ArmorPiece[],
  wantedSkillIds: number[],
  keep: Record<number, (number | null)[]> = {}
): Record<number, (number | null)[]> {
  const priority = new Map(wantedSkillIds.map((id, i) => [id, wantedSkillIds.length - i]));
  const armorDecos = decorations.filter((d) => d.kind === 'armor');
  const assignment: Record<number, (number | null)[]> = {};

  const score = (deco: Decoration): number => {
    let s = 0;
    for (const sk of deco.skills) s += (priority.get(sk.skillId) ?? 0) * sk.level;
    return s;
  };

  for (const piece of pieces) {
    const slots = [...piece.slots].sort((a, b) => b - a); // big slots first
    const kept = keep[piece.id];
    assignment[piece.id] = slots.map((slotLevel, i) => {
      const existing = kept?.[i];
      if (existing !== undefined && existing !== null) return existing;
      let best: Decoration | null = null;
      let bestScore = 0;
      for (const deco of armorDecos) {
        if (deco.slot > slotLevel) continue;
        const s = score(deco);
        if (s > bestScore || (s === bestScore && best && s > 0 && (deco.slot < best.slot || (deco.slot === best.slot && deco.name < best.name)))) {
          best = deco;
          bestScore = s;
        }
      }
      return best ? best.id : null;
    });
  }
  return assignment;
}

export interface DecoPlanEntry {
  deco: Decoration;
  count: number;
  /** How many levels of wanted skills each copy grants. */
  levelsPerCopy: number;
}

export interface DecoPlan {
  entries: DecoPlanEntry[];
  totalDecos: number;
  /** Slot levels the plan consumes, e.g. {3: 2, 1: 1} for two Lv3 decos + one Lv1 deco. */
  slotCost: Record<number, number>;
  /** Wanted skill levels the plan can actually deliver (capped by deco availability). */
  delivered: Record<number, number>;
  /** True when the wanted levels exceed what decorations alone can provide. */
  shortfall: boolean;
}

/**
 * "Which decos to farm": pick the cheapest decoration set that reaches the
 * wanted level of each skill. Higher-slot copies are preferred when they
 * grant more levels per deco; when a skill has no decoration at all, it is
 * reported via `delivered` falling short of the request.
 */
export function planDecorations(wanted: { skillId: number; level: number }[]): DecoPlan {
  const entries: DecoPlanEntry[] = [];
  const slotCost: Record<number, number> = {};
  const delivered: Record<number, number> = {};
  let shortfall = false;

  for (const want of [...wanted].sort((a, b) => a.skillId - b.skillId)) {
    let remaining = want.level;
    // Best deco for this skill first: most granted levels, then lowest slot.
    const options = armorDecosGrantingSkill(want.skillId).sort(
      (a, b) =>
        (b.skills.find((s) => s.skillId === want.skillId)?.level ?? 0) -
          (a.skills.find((s) => s.skillId === want.skillId)?.level ?? 0) ||
        a.slot - b.slot ||
        a.name.localeCompare(b.name)
    );
    for (const deco of options) {
      if (remaining <= 0) break;
      const perCopy = deco.skills.find((s) => s.skillId === want.skillId)?.level ?? 1;
      const copies = Math.min(Math.ceil(remaining / perCopy), options.length === 1 ? 99 : 99);
      const use = Math.min(copies, Math.ceil(remaining / perCopy));
      if (use <= 0) continue;
      remaining -= use * perCopy;
      const existing = entries.find((e) => e.deco.id === deco.id);
      if (existing) existing.count += use;
      else entries.push({ deco, count: use, levelsPerCopy: perCopy });
      slotCost[deco.slot] = (slotCost[deco.slot] ?? 0) + use;
    }
    const got = want.level - Math.max(0, remaining);
    delivered[want.skillId] = got;
    if (got < want.level) shortfall = true;
  }

  entries.sort((a, b) => b.count - a.count || a.deco.name.localeCompare(b.deco.name));
  return {
    entries,
    totalDecos: entries.reduce((n, e) => n + e.count, 0),
    slotCost,
    delivered,
    shortfall,
  };
}

/** Validate a manual deco assignment; returns per-slot errors for the UI. */
export function validateAssignment(piece: ArmorPiece, decoIds: (number | null)[]): string[] {
  const errors: string[] = [];
  decoIds.forEach((id, i) => {
    if (id === null || id === undefined) return;
    const deco = decoById.get(id);
    const slotLevel = piece.slots[i];
    if (!deco) errors.push(`Unknown decoration #${id}.`);
    else if (deco.kind !== 'armor') errors.push(`${deco.name} is a weapon decoration and cannot fit armor slots.`);
    else if (slotLevel === undefined) errors.push(`${piece.name} has no slot ${i + 1}.`);
    else if (deco.slot > slotLevel) errors.push(`${deco.name} needs a Lv${deco.slot} slot; slot ${i + 1} of ${piece.name} is Lv${slotLevel}.`);
  });
  return errors;
}
