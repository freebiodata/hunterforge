/**
 * Lookup indexes over the generated datasets. Hand-written (not generated):
 * building Maps once at module scope keeps the hot paths in the builder cheap.
 */
import { armorPieces } from './armor';
import { charms } from './charms';
import { decorations } from './decorations';
import { setBonuses, groupSkills, pieceSetIndex } from './sets';
import { skills } from './skills';
import type { ArmorPiece, Charm, Decoration, PieceKind, SetBonus, GroupSkill, Skill } from './types';

export const skillById = new Map<number, Skill>(skills.map((s) => [s.id, s]));
export const armorById = new Map<number, ArmorPiece>(armorPieces.map((p) => [p.id, p]));
export const decoById = new Map<number, Decoration>(decorations.map((d) => [d.id, d]));
export const charmById = new Map<number, Charm>(charms.map((c) => [c.id, c]));
export const setBonusByKey = new Map<string, SetBonus>(setBonuses.map((b) => [b.key, b]));
export const groupSkillByName = new Map<string, GroupSkill>(groupSkills.map((g) => [g.groupSkillName, g]));

export const PIECE_KINDS: PieceKind[] = ['head', 'chest', 'arms', 'waist', 'legs'];

export const PIECE_KIND_LABELS: Record<PieceKind, string> = {
  head: 'Head',
  chest: 'Chest',
  arms: 'Arms',
  waist: 'Waist',
  legs: 'Legs',
};

export function setMembership(pieceId: number) {
  return pieceSetIndex[pieceId];
}

/** All armor pieces that grant the given skill, as (piece, level) pairs. */
export function piecesGrantingSkill(skillId: number): { piece: ArmorPiece; level: number }[] {
  const out: { piece: ArmorPiece; level: number }[] = [];
  for (const piece of armorPieces) {
    const s = piece.skills.find((sk) => sk.skillId === skillId);
    if (s) out.push({ piece, level: s.level });
  }
  return out;
}

/** All armor-kind decorations that grant the given skill. */
export function armorDecosGrantingSkill(skillId: number): Decoration[] {
  return decorations.filter((d) => d.kind === 'armor' && d.skills.some((s) => s.skillId === skillId));
}

/** Every charm rank that grants the given skill. */
export function charmsGrantingSkill(skillId: number): Charm[] {
  return charms.filter((c) => c.skills.some((s) => s.skillId === skillId));
}
