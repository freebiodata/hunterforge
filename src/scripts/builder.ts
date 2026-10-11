/**
 * Armor Set Builder - client engine.
 * Vanilla TS, no framework: one state object, full re-render on change,
 * state persisted to localStorage + URL hash (#b=..., see lib/urlstate.ts).
 */
import { armorPieces } from '../data/armor';
import { charms } from '../data/charms';
import { decorations } from '../data/decorations';
import { skills } from '../data/skills';
import { pieceSetIndex, setBonuses, groupSkills } from '../data/sets';
import { skillById } from '../data/lookup';
import type { ArmorPiece, Charm, PieceKind } from '../data/types';
import { aggregateBuild, totalActiveLevels, type BuildState } from '../lib/build';
import { autoAssignDecos } from '../lib/decos';
import { decodeBuild, encodeBuild, pruneOrphanDecos } from '../lib/urlstate';
import { icons } from '../lib/icons';

const PIECE_KINDS: PieceKind[] = ['head', 'chest', 'arms', 'waist', 'legs'];
const KIND_LABELS: Record<PieceKind, string> = {
  head: 'Head', chest: 'Chest', arms: 'Arms', waist: 'Waist', legs: 'Legs',
};
const KIND_ICONS: Record<PieceKind, string> = {
  head: icons.head, chest: icons.chest, arms: icons.arms, waist: icons.waist, legs: icons.legs,
};
const STORAGE_KEY = 'hunterforge:build:v1';
const MAX_LIST_ROWS = 90;

interface AppState {
  build: BuildState;
  quick: number[];
}

let state: AppState = { build: { pieces: {}, decos: {} }, quick: [] };
let loadWarnings: string[] = [];
let craftingMaterials: Record<number, { name: string; quantity: number }[]> | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pieceById = (id: number) => armorPieces.find((p) => p.id === id);
const equippedPieces = () =>
  PIECE_KINDS.map((k) => state.build.pieces[k]).filter((v): v is number => v !== undefined).map((id) => pieceById(id)!).filter(Boolean);
const armorDecos = decorations.filter((d) => d.kind === 'armor');

function announce(msg: string) {
  const el = $('live-region');
  el.textContent = msg;
}

// --------------------------------------------------------------------------
// Persistence
// --------------------------------------------------------------------------
function persist() {
  const clean = pruneOrphanDecos(state.build);
  try {
    localStorage.setItem(STORAGE_KEY, encodeBuild(clean));
  } catch {
    /* private mode - URL hash still works */
  }
  const hash = encodeBuild(clean);
  history.replaceState(null, '', `${location.pathname}#${hash}`);
}

function loadInitial() {
  const fromHash = location.hash.length > 2 ? decodeBuild(location.hash) : null;
  if (fromHash && Object.keys(fromHash.state.pieces).length + (fromHash.state.charmId ? 1 : 0) > 0) {
    state.build = fromHash.state;
    loadWarnings = fromHash.warnings;
    return;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const decoded = decodeBuild(`#${stored}`);
      state.build = decoded.state;
      loadWarnings = decoded.warnings;
    }
  } catch {
    /* ignore */
  }
}

// --------------------------------------------------------------------------
// Rendering: equipment column
// --------------------------------------------------------------------------
function slotPip(level: number, filled: boolean) {
  return `<span class="slot-pip ${filled ? 'slot-pip--filled' : ''}" title="Decoration slot Lv${level}"><span>${level}</span></span>`;
}

function skillChips(piece: ArmorPiece) {
  if (!piece.skills.length) return '';
  return piece.skills
    .map((s) => `<span class="badge badge--ember">${esc(s.name)} ${s.level}</span>`)
    .join('');
}

function renderEquip() {
  const host = $('equip-list');
  const html = PIECE_KINDS.map((kind) => {
    const id = state.build.pieces[kind];
    const piece = id ? pieceById(id) : undefined;
    if (!piece) {
      return `
        <div class="equip-card" data-kind="${kind}">
          <div class="row1">
            <span class="kind-tag">${KIND_ICONS[kind]}${KIND_LABELS[kind]}</span>
            <span class="empty-hint">Empty - no piece equipped</span>
            <button class="btn btn--ghost btn--small" data-choose="${kind}" type="button" style="margin-left:auto;">Choose ${KIND_LABELS[kind]}…</button>
          </div>
        </div>`;
    }
    const membership = pieceSetIndex[piece.id];
    const decoRow = piece.slots.length
      ? `<div style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; margin-top:.45rem;">
          ${piece.slots
            .map((slotLevel, i) => {
              const current = state.build.decos[piece.id]?.[i] ?? null;
              const options = armorDecos
                .filter((d) => d.slot <= slotLevel)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(
                  (d) =>
                    `<option value="${d.id}" ${current === d.id ? 'selected' : ''}>${esc(d.name)} - ${d.skills
                      .map((s) => `${esc(s.name)} +${s.level}`)
                      .join(', ')}</option>`
                )
                .join('');
              return `<select data-deco-piece="${piece.id}" data-deco-slot="${i}" aria-label="Decoration slot ${i + 1} (Lv${slotLevel}) on ${esc(piece.name)}">
                <option value=""> - slot Lv${slotLevel} - </option>${options}</select>`;
            })
            .join('')}
        </div>`
      : '';
    const groupTag = membership?.groupSkillName
      ? `<span class="badge" title="Group skill: activates when 3 equipped pieces share it">grp: ${esc(membership.groupSkillName)}</span>`
      : '';
    const setTag = membership?.family ? `<span class="badge">${esc(membership.family)}</span>` : '';
    return `
      <div class="equip-card" data-kind="${kind}">
        <div class="row1">
          <span class="kind-tag">${KIND_ICONS[kind]}${KIND_LABELS[kind]}</span>
          <span class="piece-name">${esc(piece.name)}</span>
          <span class="rarity-chip rarity-${piece.rarity}" title="Rarity ${piece.rarity}">R${piece.rarity}</span>
          <span class="badge">DEF <span class="mono">${piece.defenseBase}→${piece.defenseMax}</span></span>
          ${piece.slots.length ? piece.slots.map((l, i) => slotPip(l, (state.build.decos[piece.id]?.[i] ?? null) !== null)).join(' ') : '<span class="badge">no slots</span>'}
          <button class="btn btn--ghost btn--small" data-remove="${kind}" type="button" title="Unequip ${esc(piece.name)}">${icons.x}</button>
        </div>
        <div class="skills">${skillChips(piece)} ${setTag} ${groupTag}</div>
        ${decoRow}
      </div>`;
  }).join('\n');

  // Charm card (the talisman slot: fixed skills, no decoration slots in Wilds)
  const charmId = state.build.charmId;
  const charm = charmId ? charms.find((c) => c.id === charmId) : undefined;
  const charmHtml = `
    <div class="equip-card" data-kind="charm" style="border-style:dashed;">
      <div class="row1">
        <span class="kind-tag">${icons.charm}Charm</span>
        ${charm
          ? `<span class="piece-name">${esc(charm.name)}</span>
             <span class="badge">R${charm.rarity}</span>
             ${charm.skills.map((s) => `<span class="badge badge--gold">${esc(s.name)} ${s.level}</span>`).join(' ')}
             <button class="btn btn--ghost btn--small" data-remove="charm" type="button" title="Remove charm">${icons.x}</button>`
          : `<span class="empty-hint">No charm - Wilds charms carry fixed skills (no decoration slots)</span>
             <button class="btn btn--ghost btn--small" data-choose="charm" type="button" style="margin-left:auto;">Choose charm…</button>`}
      </div>
      ${charm ? `<div class="skills" style="font-size:.8rem; color:var(--bone-faint);">Crafting: ${charm.craftable ? charm.materials.map((m) => `${esc(m.name)} ×${m.quantity}`).join(', ') || 'no materials listed' : 'not craftable at the Smithy (event/limited)'}</div>` : ''}
    </div>`;

  host.innerHTML = html + charmHtml;
}

// --------------------------------------------------------------------------
// Rendering: results column
// --------------------------------------------------------------------------
function renderSummary() {
  const result = aggregateBuild(state.build);
  const res = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

  const issuesHtml =
    loadWarnings.length || result.issues.length
      ? `<div style="margin-top:.7rem;">
          ${[...loadWarnings, ...result.issues]
            .map(
              (w) =>
                `<div class="notice notice--warn" style="margin-bottom:.4rem; padding:.45rem .6rem; font-size:.8rem;"><strong>Flag:</strong> ${esc(w)}</div>`
            )
            .join('')}
        </div>`
      : '';

  const materialsDetails = renderMaterials();

  $('summary-card').innerHTML = `
    <div class="card-title">
      <svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Loadout summary
    </div>
    <div class="stat-strip" style="margin:.3rem 0 .6rem;">
      <div class="stat"><div class="num">${result.equipped.length}<span style="font-size:.9rem; color:var(--bone-faint);">/5</span></div><div class="lbl">pieces</div></div>
      <div class="stat"><div class="num">${result.defense.base}</div><div class="lbl">defense (base)</div></div>
      <div class="stat"><div class="num">${result.defense.max}</div><div class="lbl">defense (max)</div></div>
      <div class="stat"><div class="num">${result.slots.filled}/${result.slots.total}</div><div class="lbl">deco slots used</div></div>
      <div class="stat"><div class="num">${totalActiveLevels(result)}</div><div class="lbl">active skill levels</div></div>
    </div>
    <div style="display:flex; gap:.4rem; flex-wrap:wrap; font-size:.82rem;">
      <span class="badge" title="Fire resistance"><span class="el-ic el-fire">${icons.fire}</span><span class="mono">${res(result.resistances.fire)}</span></span>
      <span class="badge" title="Water resistance"><span class="el-ic el-water">${icons.water}</span><span class="mono">${res(result.resistances.water)}</span></span>
      <span class="badge" title="Ice resistance"><span class="el-ic el-ice">${icons.ice}</span><span class="mono">${res(result.resistances.ice)}</span></span>
      <span class="badge" title="Thunder resistance"><span class="el-ic el-thunder">${icons.thunder}</span><span class="mono">${res(result.resistances.thunder)}</span></span>
      <span class="badge" title="Dragon resistance"><span class="el-ic el-dragon">${icons.dragon}</span><span class="mono">${res(result.resistances.dragon)}</span></span>
      <span class="badge badge--moss">${icons.charm} ${result.charm ? esc(charmShort(result.charm)) : 'no charm'}</span>
    </div>
    ${materialsDetails}
    ${issuesHtml}
  `;
}

function charmShort(c: Charm) {
  return c.name.replace(/ (I|II|III|IV|V|VI|VII)$/, '');
}

/** Crafting materials for the whole build. Lazy-loads the materials chunk. */
function renderMaterials(): string {
  const pieces = equippedPieces();
  if (!pieces.length && !state.build.charmId) return '';
  const charm = state.build.charmId ? charms.find((c) => c.id === state.build.charmId) : undefined;
  if (!craftingMaterials) {
    void import('../data/armor-crafting').then((m) => {
      craftingMaterials = m.armorCrafting;
      renderSummary();
    });
    return `<details style="margin-top:.7rem;"><summary class="mono" style="cursor:pointer; font-size:.8rem; color:var(--bone-faint);">${icons.list} Crafting materials list (loading…)</summary></details>`;
  }
  const totals = new Map<string, number>();
  const add = (name: string, qty: number) => totals.set(name, (totals.get(name) ?? 0) + qty);
  for (const p of pieces) for (const m of craftingMaterials[p.id] ?? []) add(m.name, m.quantity);
  if (charm) for (const m of charm.materials) add(m.name, m.quantity);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return `
    <details style="margin-top:.7rem;">
      <summary class="mono" style="cursor:pointer; font-size:.8rem; color:var(--bone-faint);">${icons.list} Crafting materials list (${rows.length} items)</summary>
      <ul style="margin:.5rem 0 0; padding-left:1.1rem; font-size:.82rem; color:var(--bone-dim); columns:2; column-gap:1.5rem;">
        ${rows.map(([name, qty]) => `<li>${esc(name)} <span class="mono" style="color:var(--ember-bright);">×${qty}</span></li>`).join('')}
      </ul>
    </details>`;
}

function renderBonuses() {
  const result = aggregateBuild(state.build);
  const setRows = result.setBonuses.map((b) => {
    const stateIc = b.level > 0 ? `<span class="ok-ic">${icons.check}</span>` : `<span class="mute-ic">${icons.dot}</span>`;
    const status = b.level > 0 ? `<span class="badge badge--moss">Lv${b.level} active</span>` : `<span class="badge">${b.pieces}/2 pieces</span>`;
    const next = b.nextAt && b.level > 0 ? ` <span class="badge">next Lv at ${b.nextAt}</span>` : b.nextAt ? ` <span class="badge">needs ${b.nextAt} pieces</span>` : '';
    return `<div style="display:flex; align-items:center; gap:.5rem; padding:.4rem 0; border-bottom:1px dashed var(--line);">
      ${stateIc}
      <span style="font-size:.9rem;">${esc(b.skillName)}</span>
      ${status}${next}
    </div>`;
  }).join('');

  const groupRows = result.groupSkills.map((g) => `
    <div style="display:flex; align-items:center; gap:.5rem; padding:.4rem 0; border-bottom:1px dashed var(--line);">
      ${g.active ? `<span class="ok-ic">${icons.check}</span>` : `<span class="mute-ic">${icons.dot}</span>`}
      <span style="font-size:.9rem;">${esc(g.groupSkillName)}</span>
      ${g.active
        ? `<span class="badge badge--moss">${esc(g.grantedSkillName)} Lv1</span>`
        : `<span class="badge">${g.pieces}/${g.required} pieces - pools across sets</span>`}
    </div>`).join('');

  const none = `<p style="color:var(--bone-faint); font-size:.85rem; margin:.3rem 0 0;">${esc('None in progress - equip 2+ pieces of one family for set bonuses, or 3 pieces sharing a group skill.')}</p>`;

  $('bonus-card').innerHTML = `
    <div class="card-title">
      <svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6-6.3 4.6L8 13.8 2 9.4h7.6z"/></svg>
      Set &amp; group bonuses
    </div>
    ${setRows || none}
    ${groupRows ? `<div style="margin-top:.6rem;"><span class="badge">group skills</span></div>${groupRows}` : ''}
    <p style="font-size:.76rem; color:var(--bone-faint); margin:.6rem 0 0;">
      Set bonuses fire at 2 and 4 pieces of the same family (α/β/γ variants mix). Group skills pool by name
      across different sets at 3 pieces.
    </p>`;
}

function pips(level: number, maxLevel: number, wasted: number) {
  let out = `<span class="pips" role="img" aria-label="Level ${level} of ${maxLevel}${wasted ? `, ${wasted} over cap` : ''}">`;
  for (let i = 1; i <= maxLevel; i++) {
    const cls = i <= level ? 'pip--on' : i <= level + wasted ? 'pip--waste' : '';
    out += `<span class="pip ${cls}"></span>`;
  }
  return out + '</span>';
}

function renderSkills() {
  const result = aggregateBuild(state.build);
  if (!result.skills.length) {
    $('skills-card').innerHTML = `
      <div class="card-title">
        <svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
        Skill totals
      </div>
      <p style="color:var(--bone-faint); font-size:.9rem;">Equip pieces, a charm or decorations - the aggregated skill table appears here, capped at each skill's max level.</p>`;
    return;
  }
  const rows = result.skills
    .map((s) => {
      const kindBadge =
        s.kind === 'set' ? '<span class="badge badge--gold">set</span>' : s.kind === 'group' ? '<span class="badge badge--moss">group</span>' : '';
      const wasteBadge = s.wasted > 0 ? `<span class="badge badge--blood" title="Levels past the cap do nothing">+${s.wasted} wasted</span>` : '';
      const contribs = s.contributions
        .map(
          (c) =>
            `<li><span class="src-type">${c.sourceType}</span><span>${esc(c.source)} <span class="mono" style="color:var(--ember-bright);">+${c.level}</span></span></li>`
        )
        .join('');
      const pct = Math.round((s.level / s.maxLevel) * 100);
      return `
        <tr class="skill-row">
          <td>
            <a href="/skills#skill-${s.skillId}" style="color:var(--bone); text-decoration:none;">${esc(s.name)}</a>
            ${kindBadge}
            <details style="margin-top:.25rem;">
              <summary class="mono" style="cursor:pointer; font-size:.72rem; color:var(--bone-faint);">sources (${s.contributions.length})</summary>
              <ul class="contrib-list">${contribs}</ul>
            </details>
          </td>
          <td class="lvl">Lv ${s.level}<span style="color:var(--bone-faint);">/${s.maxLevel}</span></td>
          <td style="min-width:90px;">
            <div class="meter" role="presentation"><i style="width:${pct}%;"></i></div>
            ${pips(s.level, s.maxLevel, s.wasted)}
          </td>
          <td>${wasteBadge}</td>
        </tr>`;
    })
    .join('');

  $('skills-card').innerHTML = `
    <div class="card-title">
      <svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      Skill totals (${result.skills.length} skills, ${totalActiveLevels(result)} active levels)
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Skill</th><th>Level</th><th>Capped</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderQuickfill() {
  const host = $('quickfill-skills');
  const granted = [...new Set(armorDecos.flatMap((d) => d.skills.map((s) => s.skillId)))]
    .map((id) => skillById.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  host.innerHTML = granted
    .map(
      (s) => `
      <label class="badge" style="cursor:pointer; ${state.quick.includes(s.id) ? 'border-color:var(--ember); color:var(--ember-bright);' : ''}">
        <input type="checkbox" data-quick="${s.id}" ${state.quick.includes(s.id) ? 'checked' : ''} style="accent-color:var(--ember);" />
        ${esc(s.name)}
      </label>`
    )
    .join('');
  ($('btn-quickfill') as HTMLButtonElement).disabled = state.quick.length === 0 || equippedPieces().every((p) => !p.slots.length);
}

function renderAll() {
  renderEquip();
  renderSummary();
  renderBonuses();
  renderSkills();
  renderQuickfill();
  persist();
}

// --------------------------------------------------------------------------
// Picker dialog
// --------------------------------------------------------------------------
type PickerMode = { mode: 'piece'; kind: PieceKind } | { mode: 'charm' };
let pickerMode: PickerMode | null = null;

function openPicker(mode: PickerMode, presetSkillId?: number) {
  pickerMode = mode;
  const skillSel = $('picker-skill') as HTMLSelectElement;
  const search = $('picker-search') as HTMLInputElement;
  search.value = '';

  if (mode.mode === 'piece') {
    $('picker-title').textContent = `Choose ${KIND_LABELS[mode.kind]} armor`;
    const pool = armorPieces.filter((p) => p.kind === mode.kind);
    const skillIds = [...new Set(pool.flatMap((p) => p.skills.map((s) => s.skillId)))].sort((a, b) => {
      const sa = skillById.get(a)!.name;
      const sb = skillById.get(b)!.name;
      return sa.localeCompare(sb);
    });
    skillSel.innerHTML =
      '<option value="">Any skill</option>' +
      skillIds.map((id) => `<option value="${id}">${esc(skillById.get(id)!.name)}</option>`).join('');
  } else {
    $('picker-title').textContent = 'Choose a charm';
    const skillIds = [...new Set(charms.flatMap((c) => c.skills.map((s) => s.skillId)))].sort((a, b) => {
      const sa = skillById.get(a)!.name;
      const sb = skillById.get(b)!.name;
      return sa.localeCompare(sb);
    });
    skillSel.innerHTML =
      '<option value="">Any skill</option>' +
      skillIds.map((id) => `<option value="${id}">${esc(skillById.get(id)!.name)}</option>`).join('');
  }
  if (presetSkillId) skillSel.value = String(presetSkillId);

  renderPickerList();
  const dlg = $('picker') as HTMLDialogElement;
  if (!dlg.open) dlg.showModal();
}

function renderPickerList() {
  if (!pickerMode) return;
  const mode: PickerMode = pickerMode; // capture the narrowing for callbacks below
  const search = ($('picker-search') as HTMLInputElement).value.trim().toLowerCase();
  const skillFilter = Number(($('picker-skill') as HTMLSelectElement).value);
  const sort = ($('picker-sort') as HTMLSelectElement).value;
  const list = $('picker-list');

  let rows: { key: string; name: string; meta: string; sub: string; sortNum: number }[] = [];

  if (mode.mode === 'piece') {
    const kind = mode.kind;
    let pool = armorPieces.filter((p) => p.kind === kind);
    if (skillFilter) pool = pool.filter((p) => p.skills.some((s) => s.skillId === skillFilter));
    if (search)
      pool = pool.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.setName.toLowerCase().includes(search) ||
          p.skills.some((s) => s.name.toLowerCase().includes(search))
      );
    const sorters: Record<string, (a: ArmorPiece, b: ArmorPiece) => number> = {
      rarity: (a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name),
      defense: (a, b) => b.defenseBase - a.defenseBase || a.name.localeCompare(b.name),
      slots: (a, b) => b.slots.length - a.slots.length || b.slots[0]! - (a.slots[0] ?? 0) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    pool.sort(sorters[sort] ?? sorters.rarity);
    rows = pool.map((p) => ({
      key: `p:${p.id}`,
      name: p.name,
      meta: `R${p.rarity} · ${p.setName} · DEF ${p.defenseBase}→${p.defenseMax}${p.slots.length ? ' · slots ' + p.slots.map(String).join('/') : ''}`,
      sub: p.skills.map((s) => `${s.name} ${s.level}`).join(' · ') || 'no active skills',
      sortNum: p.rarity,
    }));
  } else {
    let pool = [...charms];
    if (skillFilter) pool = pool.filter((c) => c.skills.some((s) => s.skillId === skillFilter));
    if (search)
      pool = pool.filter(
        (c) => c.name.toLowerCase().includes(search) || c.skills.some((s) => s.name.toLowerCase().includes(search))
      );
    pool.sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name));
    rows = pool.map((c) => ({
      key: `c:${c.id}`,
      name: c.name,
      meta: `R${c.rarity}${c.craftable ? ' · craftable' : ' · event/limited'}`,
      sub: c.skills.map((s) => `${s.name} ${s.level}`).join(' · '),
      sortNum: c.rarity,
    }));
  }

  const shown = rows.slice(0, MAX_LIST_ROWS);
  list.innerHTML =
    (shown.length
      ? shown
          .map(
            (r) => `
        <button class="picker-row" type="button" data-pick="${r.key}">
          <span class="grow">
            <span class="name">${esc(r.name)}</span>
            <div class="meta">${esc(r.meta)}</div>
            <div class="skills">${esc(r.sub)}</div>
          </span>
        </button>`
          )
          .join('')
      : `<p style="padding:1.2rem; color:var(--bone-faint);">Nothing matches those filters.</p>`) +
    (rows.length > MAX_LIST_ROWS
      ? `<p style="padding:.7rem 1rem; color:var(--bone-faint); font-size:.8rem;" class="mono">showing ${MAX_LIST_ROWS} of ${rows.length} - refine the search to see more</p>`
      : '');
}

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------
function equip(kind: PieceKind, pieceId: number) {
  state.build.pieces[kind] = pieceId;
  const piece = pieceById(pieceId)!;
  if (!state.build.decos[pieceId]) state.build.decos[pieceId] = Array<number | null>(piece.slots.length).fill(null);
  else {
    // keep assignments valid if slot layout changed (shouldn't happen for a fixed piece, but be safe)
    const arr = state.build.decos[pieceId];
    state.build.decos[pieceId] = piece.slots.map((_, i) => arr[i] ?? null);
  }
  announce(`${piece.name} equipped`);
  renderAll();
}

document.addEventListener('click', (ev) => {
  const target = ev.target as HTMLElement;
  const choose = target.closest<HTMLElement>('[data-choose]');
  if (choose) {
    const what = choose.dataset.choose!;
    if (what === 'charm') openPicker({ mode: 'charm' });
    else openPicker({ mode: 'piece', kind: what as PieceKind });
    return;
  }
  const remove = target.closest<HTMLElement>('[data-remove]');
  if (remove) {
    const what = remove.dataset.remove!;
    if (what === 'charm') delete state.build.charmId;
    else {
      const id = state.build.pieces[what as PieceKind];
      delete state.build.pieces[what as PieceKind];
      if (id !== undefined) delete state.build.decos[id];
    }
    renderAll();
    return;
  }
  const pick = target.closest<HTMLElement>('[data-pick]');
  if (pick && pickerMode) {
    const [tag, idStr] = pick.dataset.pick!.split(':');
    const id = Number(idStr);
    if (tag === 'p' && pickerMode.mode === 'piece') equip(pickerMode.kind, id);
    else if (tag === 'c') state.build.charmId = id;
    ($('picker') as HTMLDialogElement).close();
    renderAll();
    return;
  }
});

document.addEventListener('change', (ev) => {
  const target = ev.target as HTMLElement;
  const decoSel = target.closest<HTMLSelectElement>('select[data-deco-piece]');
  if (decoSel) {
    const pieceId = Number(decoSel.dataset.decoPiece);
    const slot = Number(decoSel.dataset.decoSlot);
    const arr = state.build.decos[pieceId] ??= [];
    arr[slot] = decoSel.value === '' ? null : Number(decoSel.value);
    renderAll();
    return;
  }
  const quick = target.closest<HTMLInputElement>('input[data-quick]');
  if (quick) {
    const id = Number(quick.dataset.quick);
    state.quick = quick.checked ? [...state.quick, id] : state.quick.filter((x) => x !== id);
    renderQuickfill();
    ($('btn-quickfill') as HTMLButtonElement).disabled = state.quick.length === 0;
    return;
  }
});

$('picker-search').addEventListener('input', renderPickerList);
$('picker-skill').addEventListener('change', renderPickerList);
$('picker-sort').addEventListener('change', renderPickerList);
$('picker-close').addEventListener('click', () => ($('picker') as HTMLDialogElement).close());

$('btn-reset').addEventListener('click', () => {
  state.build = { pieces: {}, decos: {} };
  state.quick = [];
  loadWarnings = [];
  renderAll();
  announce('Build reset');
});

$('btn-clear-decos').addEventListener('click', () => {
  for (const piece of equippedPieces()) state.build.decos[piece.id] = Array<number | null>(piece.slots.length).fill(null);
  renderAll();
  announce('Decorations cleared');
});

$('btn-quickfill').addEventListener('click', () => {
  const pieces = equippedPieces();
  const keep: Record<number, (number | null)[]> = {};
  for (const p of pieces) keep[p.id] = (state.build.decos[p.id] ?? Array<number | null>(p.slots.length).fill(null)).map((v) => v ?? null);
  state.build.decos = autoAssignDecos(pieces, state.quick, keep);
  renderAll();
  announce('Empty slots auto-filled');
});

$('btn-example').addEventListener('click', () => {
  const helm = armorPieces.find((p) => p.name === 'Rey Sandhelm α');
  const mail = armorPieces.find((p) => p.name === 'Rey Sandmail α');
  const braces = armorPieces.find((p) => p.name === 'Rey Sandbraces α');
  const coil = armorPieces.find((p) => p.name === 'Rey Sandcoil α');
  const greaves = armorPieces.find((p) => p.name === 'Rey Sandgreaves α');
  const powerCharm = charms.find((c) => c.name === 'Power Charm III');
  if (!helm || !mail || !braces || !coil || !greaves) {
    announce('Example pieces not found in this dataset snapshot');
    return;
  }
  state.build = {
    pieces: { head: helm.id, chest: mail.id, arms: braces.id, waist: coil.id, legs: greaves.id },
    charmId: powerCharm?.id,
    decos: {},
  };
  loadWarnings = [];
  renderAll();
  announce('Example build loaded: Rey Dau α + Power Charm III');
});

$('btn-share').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#${encodeBuild(pruneOrphanDecos(state.build))}`;
  try {
    await navigator.clipboard.writeText(url);
    announce('Share link copied to clipboard');
    const btn = $('btn-share') as HTMLButtonElement;
    btn.innerHTML = `${icons.check} Link copied`;
    setTimeout(() => (btn.textContent = 'Copy share link'), 1600);
  } catch {
    location.hash = encodeBuild(pruneOrphanDecos(state.build));
    announce('Share link is in the address bar - copy it from there');
  }
});

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------
loadInitial();

// Deep link from the skill library: /builder?skill=<id> opens the first empty
// slot's picker with that skill pre-filtered.
const skillParam = new URLSearchParams(location.search).get('skill');
if (skillParam && Number(skillParam)) {
  const emptyKind = PIECE_KINDS.find((k) => state.build.pieces[k] === undefined);
  if (emptyKind) {
    openPicker({ mode: 'piece', kind: emptyKind }, Number(skillParam));
  } else {
    loadWarnings.push('All five slots are filled - the skill filter from the link was not applied.');
  }
}

renderAll();

// keep the dataset's honest scale visible in the console for the curious
console.info(
  `HunterForge builder · dataset snapshot · ${armorPieces.length} HR pieces · ${decorations.length} decos · ${charms.length} charms · ${setBonuses.length} set bonuses · ${groupSkills.length} group skills · ${skills.length} skills`
);
