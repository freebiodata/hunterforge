import { describe, expect, it } from 'vitest';
import { armorPieces } from './armor';
import { charms } from './charms';
import { decorations } from './decorations';
import { setBonuses, groupSkills, pieceSetIndex } from './sets';
import { skills } from './skills';
import { weaponPresets } from './weapons';
import { meta } from './meta';
import { skillById } from './lookup';

/**
 * Dataset integrity: these tests pin the generated data to the guarantees the
 * UI relies on. If a fresh mhdb snapshot breaks one of them, the generator or
 * the site model needs updating - by a human, not silently.
 */
describe('dataset integrity', () => {
  it('every armor piece references known skills with sane levels', () => {
    for (const p of armorPieces) {
      expect(['head', 'chest', 'arms', 'waist', 'legs'], `piece kind of ${p.name}`).toContain(p.kind);
      for (const s of p.skills) {
        const def = skillById.get(s.skillId);
        expect(def, `skill ${s.name} on ${p.name} exists`).toBeTruthy();
        expect(s.level, `${s.name} level on ${p.name}`).toBeGreaterThanOrEqual(1);
        expect(s.level, `${s.name} level on ${p.name} within max`).toBeLessThanOrEqual(def!.maxLevel);
      }
      for (const slot of p.slots) {
        expect(slot).toBeGreaterThanOrEqual(1);
        expect(slot).toBeLessThanOrEqual(3);
      }
      // slots sorted descending, as the builder assumes
      expect([...p.slots].sort((a, b) => b - a)).toEqual(p.slots);
    }
  });

  it('every HR piece is a member of exactly one indexed set family', () => {
    for (const p of armorPieces) {
      const m = pieceSetIndex[p.id];
      expect(m, `set membership for ${p.name}`).toBeTruthy();
      expect(m.family.length).toBeGreaterThan(0);
    }
  });

  it('decorations reference known skills and use valid slots/kinds', () => {
    for (const d of decorations) {
      expect(d.slot).toBeGreaterThanOrEqual(1);
      expect(d.slot).toBeLessThanOrEqual(3);
      expect(['armor', 'weapon']).toContain(d.kind);
      expect(d.skills.length).toBeGreaterThanOrEqual(1);
      for (const s of d.skills) expect(skillById.has(s.skillId), `${d.name} -> skill ${s.name}`).toBe(true);
    }
  });

  it('charms reference known skills', () => {
    for (const c of charms) {
      for (const s of c.skills) expect(skillById.has(s.skillId), `${c.name} -> skill ${s.name}`).toBe(true);
    }
  });

  it('set bonuses have ascending 2/4-piece thresholds and known skills', () => {
    for (const b of setBonuses) {
      expect(skillById.has(b.skillId), `bonus skill ${b.skillName}`).toBe(true);
      expect(b.ranks.length).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < b.ranks.length; i++) {
        expect(b.ranks[i].pieces).toBeGreaterThan(b.ranks[i - 1].pieces);
        expect(b.ranks[i].level).toBeGreaterThan(b.ranks[i - 1].level);
      }
      expect(b.families.length).toBeGreaterThan(0);
    }
  });

  it('group skills grant a known skill at a 3-piece threshold', () => {
    for (const g of groupSkills) {
      expect(skillById.has(g.grantedSkillId), `group skill ${g.groupSkillName}`).toBe(true);
      expect(g.pieces).toBe(3);
      expect(g.level).toBe(1);
    }
  });

  it('skill max levels are within the expected 1–7 range', () => {
    for (const s of skills) {
      expect(s.maxLevel).toBeGreaterThanOrEqual(1);
      expect(s.maxLevel).toBeLessThanOrEqual(7);
      expect(s.levels).toHaveLength(s.maxLevel);
    }
  });

  it('weapon presets cover all 14 weapon kinds with positive raw', () => {
    expect(weaponPresets).toHaveLength(14);
    expect(new Set(weaponPresets.map((w) => w.kind)).size).toBe(14);
    for (const w of weaponPresets) expect(w.raw).toBeGreaterThan(0);
  });

  it('meta coverage counts match the actual arrays', () => {
    expect(meta.coverage.highRankArmorPieces).toBe(armorPieces.length);
    expect(meta.coverage.decorations).toBe(decorations.length);
    expect(meta.coverage.armorDecorations).toBe(decorations.filter((d) => d.kind === 'armor').length);
    expect(meta.coverage.weaponDecorations).toBe(decorations.filter((d) => d.kind === 'weapon').length);
    expect(meta.coverage.charmRanks).toBe(charms.length);
    expect(meta.coverage.armorSets).toBe(setBonuses.length);
    expect(meta.coverage.skillsTotal).toBe(skills.length);
    expect(meta.coverage.weaponPresets).toBe(weaponPresets.length);
  });

  it('carries a snapshot date and honesty note', () => {
    expect(meta.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meta.gameVersionNote.length).toBeGreaterThan(10);
  });
});
