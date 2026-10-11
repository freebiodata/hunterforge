import { describe, expect, it } from 'vitest';
import { aggregateBuild, totalActiveLevels, type BuildState } from './build';
import { armorPieces } from '../data/armor';
import { charms } from '../data/charms';
import { decorations } from '../data/decorations';
import type { PieceKind } from '../data/types';

const piece = (name: string) => {
  const p = armorPieces.find((x) => x.name === name);
  if (!p) throw new Error(`test fixture piece not found: ${name}`);
  return p;
};
const charm = (name: string) => {
  const c = charms.find((x) => x.name === name);
  if (!c) throw new Error(`test fixture charm not found: ${name}`);
  return c;
};
const deco = (name: string) => {
  const d = decorations.find((x) => x.name === name);
  if (!d) throw new Error(`test fixture deco not found: ${name}`);
  return d;
};

const REY_DAU_A: Record<PieceKind, string> = {
  head: 'Rey Sandhelm α',
  chest: 'Rey Sandmail α',
  arms: 'Rey Sandbraces α',
  waist: 'Rey Sandcoil α',
  legs: 'Rey Sandgreaves α',
};

function stateFor(names: Partial<Record<PieceKind, string>>): BuildState {
  const pieces: BuildState['pieces'] = {};
  for (const [kind, name] of Object.entries(names)) {
    if (name) pieces[kind as PieceKind] = piece(name).id;
  }
  return { pieces, decos: {} };
}

const skillLevel = (result: ReturnType<typeof aggregateBuild>, name: string) => {
  const s = result.skills.find((x) => x.name === name);
  return s ? { level: s.level, raw: s.rawLevel, wasted: s.wasted } : null;
};

describe('aggregateBuild', () => {
  it('returns an empty result for an empty build', () => {
    const result = aggregateBuild({ pieces: {}, decos: {} });
    expect(result.skills).toEqual([]);
    expect(result.equipped).toEqual([]);
    expect(result.defense).toEqual({ base: 0, max: 0 });
    expect(result.slots).toEqual({ filled: 0, total: 0 });
    expect(result.issues).toEqual([]);
  });

  it('aggregates the full Rey Dau α set with set bonus at 2/4 and group skill at 3 pieces', () => {
    const result = aggregateBuild(stateFor(REY_DAU_A));

    // Per-piece armor skills only (set/group tags must not leak in as levels).
    expect(skillLevel(result, 'Evade Extender')).toEqual({ level: 1, raw: 1, wasted: 0 });
    expect(skillLevel(result, 'Latent Power')).toEqual({ level: 5, raw: 5, wasted: 0 });
    expect(skillLevel(result, 'Maximum Might')).toEqual({ level: 3, raw: 3, wasted: 0 });
    expect(skillLevel(result, 'Stamina Surge')).toEqual({ level: 3, raw: 3, wasted: 0 });
    expect(skillLevel(result, 'Stun Resistance')).toEqual({ level: 3, raw: 3, wasted: 0 });

    // Set bonus: 5 pieces >= 4-piece threshold -> Rey Dau's Voltage Lv2.
    expect(skillLevel(result, "Rey Dau's Voltage")).toEqual({ level: 2, raw: 2, wasted: 0 });
    const bonus = result.setBonuses.find((b) => b.skillName === "Rey Dau's Voltage");
    expect(bonus).toMatchObject({ level: 2, pieces: 5, nextAt: null, rankName: 'Thunderous Roar II' });

    // Group skill: 5 pieces carry Lord's Favor (>= 3) -> Inspiration Lv1.
    expect(skillLevel(result, 'Inspiration')).toEqual({ level: 1, raw: 1, wasted: 0 });
    const group = result.groupSkills.find((g) => g.groupSkillName === "Lord's Favor");
    expect(group).toMatchObject({ active: true, pieces: 5, required: 3, grantedSkillName: 'Inspiration' });

    // Totals pinned from the snapshot.
    expect(result.defense).toEqual({ base: 300, max: 410 });
    expect(result.resistances).toEqual({ fire: 0, water: -10, ice: -15, thunder: 20, dragon: 0 });
  });

  it('activates set bonus Lv1 at exactly 2 pieces and reports the next threshold', () => {
    const result = aggregateBuild(stateFor({ head: REY_DAU_A.head, chest: REY_DAU_A.chest }));
    const bonus = result.setBonuses.find((b) => b.skillName === "Rey Dau's Voltage");
    expect(bonus).toMatchObject({ level: 1, pieces: 2, nextAt: 4 });
    expect(skillLevel(result, "Rey Dau's Voltage")?.level).toBe(1);
    // Group skill not active at 2 pieces.
    expect(result.groupSkills.find((g) => g.groupSkillName === "Lord's Favor")?.active).toBe(false);
    expect(skillLevel(result, 'Inspiration')).toBeNull();
  });

  it('caps skill levels and counts waste (Latent Power is capped at 5)', () => {
    const state = stateFor(REY_DAU_A);
    state.charmId = charm('Power Charm III').id; // Latent Power +3 on top of 5
    const result = aggregateBuild(state);
    expect(skillLevel(result, 'Latent Power')).toEqual({ level: 5, raw: 8, wasted: 3 });
    expect(result.charm?.name).toBe('Power Charm III');
  });

  it('pools group skills across different sets by group skill name', () => {
    // Conga α (2 pieces) + Arkveld α (1 piece): all three carry Fortifying Pelt.
    const arkPiece = armorPieces.find((p) => p.setName === 'Arkveld α' && p.kind !== 'head' && p.kind !== 'chest')!;
    expect(arkPiece).toBeTruthy();
    const result = aggregateBuild(stateFor({ head: 'Conga Helm α', chest: 'Conga Mail α', [arkPiece.kind]: arkPiece.name }));
    const fortify = result.groupSkills.find((g) => g.groupSkillName === 'Fortifying Pelt');
    expect(fortify).toMatchObject({ active: true, pieces: 3, required: 3, grantedSkillName: 'Fortify' });
    expect(skillLevel(result, 'Fortify')).toEqual({ level: 1, raw: 1, wasted: 0 });
    // No family reached a 2-piece set bonus threshold here (progress entries
    // may be listed, but none active).
    expect(result.setBonuses.filter((b) => b.level > 0)).toEqual([]);
  });

  it('counts decorations that fit and reports issues for those that do not', () => {
    const greaves = piece('Rey Sandgreaves α'); // slots [3]
    const congaHelm = piece('Conga Helm α'); // slots [1]
    const flayer = deco('Flayer Jewel [3]'); // requires a Lv3 slot
    const weaponDeco = decorations.find((d) => d.kind === 'weapon')!;

    const ok = aggregateBuild({
      pieces: { legs: greaves.id },
      decos: { [greaves.id]: [flayer.id] },
    });
    expect(ok.issues).toEqual([]);
    expect(skillLevel(ok, 'Flayer')).toEqual({ level: 1, raw: 1, wasted: 0 });
    expect(ok.slots).toEqual({ filled: 1, total: 1 });

    const oversized = aggregateBuild({
      pieces: { head: congaHelm.id },
      decos: { [congaHelm.id]: [flayer.id] },
    });
    expect(oversized.issues).toHaveLength(1);
    expect(oversized.issues[0]).toContain('does not fit');
    expect(skillLevel(oversized, 'Flayer')).toBeNull();

    const wrongKind = aggregateBuild({
      pieces: { legs: greaves.id },
      decos: { [greaves.id]: [weaponDeco.id] },
    });
    expect(wrongKind.issues[0]).toContain('weapon decoration');
    expect(wrongKind.slots.filled).toBe(0);
  });

  it('flags decorations left on unequipped pieces', () => {
    const greaves = piece('Rey Sandgreaves α');
    const result = aggregateBuild({
      pieces: { head: piece(REY_DAU_A.head).id },
      decos: { [greaves.id]: [deco('Flayer Jewel [3]').id] },
    });
    expect(result.issues.join(' ')).toContain('not equipped');
  });

  it('sorts skills by effective level and keeps contributions attributable', () => {
    const state = stateFor({ head: REY_DAU_A.head, arms: REY_DAU_A.arms });
    const result = aggregateBuild(state);
    const lp = result.skills.find((s) => s.name === 'Latent Power')!;
    expect(lp.contributions.map((c) => c.source)).toEqual(['Rey Sandhelm α', 'Rey Sandbraces α']);
    expect(totalActiveLevels(result)).toBeGreaterThan(0);
  });
});
