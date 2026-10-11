import { describe, expect, it } from 'vitest';
import { decodeBuild, encodeBuild, pruneOrphanDecos } from './urlstate';
import { armorPieces } from '../data/armor';
import { charms } from '../data/charms';
import { decorations } from '../data/decorations';
import type { BuildState } from './build';

const greaves = armorPieces.find((p) => p.name === 'Rey Sandgreaves α')!;
const helm = armorPieces.find((p) => p.name === 'Rey Sandhelm α')!;
const charm = charms.find((c) => c.name === 'Power Charm III')!;
const flayer = decorations.find((d) => d.name === 'Flayer Jewel [3]')!;

const fullState: BuildState = {
  pieces: { head: helm.id, legs: greaves.id },
  charmId: charm.id,
  decos: { [greaves.id]: [flayer.id] },
};

describe('encodeBuild / decodeBuild', () => {
  it('round-trips a build with pieces, charm and decorations', () => {
    const hash = encodeBuild(fullState);
    expect(hash.startsWith('b=')).toBe(true);
    const { state, warnings } = decodeBuild(hash);
    expect(warnings).toEqual([]);
    expect(state.pieces).toEqual(fullState.pieces);
    expect(state.charmId).toBe(fullState.charmId);
    expect(state.decos[greaves.id]).toEqual([flayer.id]);
  });

  it('round-trips an empty build', () => {
    const { state, warnings } = decodeBuild(encodeBuild({ pieces: {}, decos: {} }));
    expect(warnings).toEqual([]);
    expect(state.pieces).toEqual({});
    expect(state.decos).toEqual({});
  });

  it('survives garbage input with a warning', () => {
    const { state, warnings } = decodeBuild('#b=%%%not-base64%%%');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('malformed');
    expect(state.pieces).toEqual({});
  });

  it('drops unknown ids with warnings instead of breaking', () => {
    // Forge a payload referencing a piece/deco/charm id that cannot exist.
    const wire = { v: 1, p: [999901, 0, 0, 0, 0], c: 999902, d: [[999903, 0, 999904]] };
    const forged = `#b=${btoaUrl(JSON.stringify(wire))}`;
    const { state, warnings } = decodeBuild(forged);
    expect(state.pieces).toEqual({});
    expect(state.charmId).toBeUndefined();
    expect(warnings.join(' ')).toContain('999901');
  });
});

describe('pruneOrphanDecos', () => {
  it('removes deco assignments for unequipped pieces', () => {
    const pruned = pruneOrphanDecos(fullState);
    expect(pruned.decos).toEqual({ [greaves.id]: [flayer.id] });
    const lonely: BuildState = { pieces: {}, decos: { [greaves.id]: [flayer.id] } };
    expect(pruneOrphanDecos(lonely).decos).toEqual({});
  });
});

function btoaUrl(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
