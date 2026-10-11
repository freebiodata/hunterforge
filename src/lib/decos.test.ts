import { describe, expect, it } from 'vitest';
import { autoAssignDecos, decoFitsSlot, planDecorations, validateAssignment } from './decos';
import { armorPieces } from '../data/armor';
import { decorations } from '../data/decorations';
import { skillById } from '../data/lookup';

const piece = (name: string) => {
  const p = armorPieces.find((x) => x.name === name);
  if (!p) throw new Error(`test fixture piece not found: ${name}`);
  return p;
};
const flayer = decorations.find((d) => d.name === 'Flayer Jewel [3]')!;
const flayerSkillId = flayer.skills[0].skillId;

describe('decoFitsSlot', () => {
  it('allows a decoration into slots of at least its level', () => {
    expect(decoFitsSlot(flayer, 3)).toBe(true);
    expect(decoFitsSlot(flayer, 2)).toBe(false);
    expect(decoFitsSlot(flayer, 1)).toBe(false);
  });

  it('rejects weapon decorations in armor slots', () => {
    const weaponDeco = decorations.find((d) => d.kind === 'weapon')!;
    expect(decoFitsSlot(weaponDeco, 3)).toBe(false);
  });
});

describe('planDecorations', () => {
  it('plans three Flayer Jewels for Flayer Lv3', () => {
    const plan = planDecorations([{ skillId: flayerSkillId, level: 3 }]);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({ deco: flayer, count: 3, levelsPerCopy: 1 });
    expect(plan.totalDecos).toBe(3);
    expect(plan.slotCost).toEqual({ 3: 3 });
    expect(plan.delivered[flayerSkillId]).toBe(3);
    expect(plan.shortfall).toBe(false);
  });

  it('reports a shortfall for skills that have no armor decoration', () => {
    // Rice Ball is an armor skill with no decoration in the snapshot.
    const riceBall = [...skillById.values()].find((s) => s.name === 'Rice Ball')!;
    const plan = planDecorations([{ skillId: riceBall.id, level: 1 }]);
    expect(plan.entries).toEqual([]);
    expect(plan.shortfall).toBe(true);
    expect(plan.delivered[riceBall.id]).toBe(0);
  });

  it('handles multi-skill plans with per-skill slot costs', () => {
    const ev = [...skillById.values()].find((s) => s.name === 'Evade Extender')!;
    const plan = planDecorations([
      { skillId: flayerSkillId, level: 2 },
      { skillId: ev.id, level: 2 },
    ]);
    expect(plan.delivered[flayerSkillId]).toBe(2);
    expect(plan.delivered[ev.id]).toBe(2);
    expect(plan.totalDecos).toBeGreaterThanOrEqual(4);
  });
});

describe('autoAssignDecos', () => {
  it('fills available slots with decos that grant the wanted skill', () => {
    const greaves = piece('Rey Sandgreaves α'); // slots [3]
    const goreCoil = piece('Gore Coil α'); // slots [3,1]
    const assignment = autoAssignDecos([greaves, goreCoil], [flayerSkillId]);
    const used = [...assignment[greaves.id], ...assignment[goreCoil.id]].filter((id): id is number => id !== null);
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) {
      const d = decorations.find((x) => x.id === id)!;
      expect(d.skills.some((s) => s.skillId === flayerSkillId)).toBe(true);
    }
  });

  it('leaves slots empty when nothing wanted fits', () => {
    const congaHelm = piece('Conga Helm α'); // slots [1]
    const assignment = autoAssignDecos([congaHelm], [flayerSkillId]); // Flayer needs Lv3
    expect(assignment[congaHelm.id]).toEqual([null]);
  });
});

describe('validateAssignment', () => {
  it('returns no errors for a valid fit and clear errors otherwise', () => {
    const greaves = piece('Rey Sandgreaves α');
    expect(validateAssignment(greaves, [flayer.id])).toEqual([]);
    expect(validateAssignment(greaves, [decorations.find((d) => d.kind === 'weapon')!.id])[0]).toContain('weapon decoration');
  });
});
