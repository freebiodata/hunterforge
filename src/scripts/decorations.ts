/**
 * Decoration Planner - client logic: skill lookup, farm planner, browser.
 */
import { decorations } from '../data/decorations';
import { skillById } from '../data/lookup';
import { planDecorations } from '../lib/decos';
import { icons } from '../lib/icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const armorDecos = decorations.filter((d) => d.kind === 'armor');

// --------------------------------------------------------------------------
// Skill lookup section
// --------------------------------------------------------------------------
const lookupSkills = [...new Set(decorations.flatMap((d) => d.skills.map((s) => s.skillId)))]
  .map((id) => skillById.get(id)!)
  .sort((a, b) => a.name.localeCompare(b.name));

function buildSkillSelect() {
  const sel = $('skill-select') as HTMLSelectElement;
  sel.innerHTML = lookupSkills
    .map((s) => `<option value="${s.id}">${esc(s.name)} (max Lv${s.maxLevel})</option>`)
    .join('');
  renderSkillDecos();
}

function renderSkillDecos() {
  const skillId = Number(($('skill-select') as HTMLSelectElement).value);
  const skill = skillById.get(skillId)!;
  const granting = decorations.filter((d) => d.skills.some((s) => s.skillId === skillId));
  const armorRows = granting.filter((d) => d.kind === 'armor');
  const weaponRows = granting.filter((d) => d.kind === 'weapon');
  const wikiUrl = `https://monsterhunterwilds.wiki.gg/wiki/Special:Search?search=${encodeURIComponent(skill.name)}`;

  const rows = (list: typeof decorations, kindNote: string) =>
    list
      .map(
        (d) => `
        <div style="display:flex; align-items:center; gap:.6rem; padding:.5rem .2rem; border-bottom:1px dashed var(--line); flex-wrap:wrap;">
          <span class="slot-pip ${d.kind === 'armor' ? 'slot-pip--filled' : ''}" title="Needs a Lv${d.slot} slot"><span>${d.slot}</span></span>
          <strong style="font-size:.92rem;">${esc(d.name)}</strong>
          <span class="badge">R${d.rarity}</span>
          <span class="badge badge--ember">${d.skills.map((s) => `${esc(s.name)} +${s.level}`).join(', ')}</span>
          <a class="btn btn--ghost btn--small" style="margin-left:auto;" href="https://monsterhunterwilds.wiki.gg/wiki/Special:Search?search=${encodeURIComponent(d.name)}" target="_blank" rel="noopener noreferrer">${icons.external} wiki</a>
        </div>`
      )
      .join('') || `<p style="color:var(--bone-faint); font-size:.85rem; padding:.4rem 0;">${kindNote}</p>`;

  $('skill-decos').innerHTML = `
    <h3 style="font-size:.95rem;">${esc(skill.name)} <span class="badge">max Lv${skill.maxLevel}</span></h3>
    <p style="font-size:.84rem; color:var(--bone-dim);">${esc(skill.levels[0] ?? '')}</p>
    <p style="font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:var(--bone-faint); margin:.7rem 0 .2rem;">Armor jewels (${armorRows.length}) - fit armor slots</p>
    ${rows(armorRows, 'No armor decoration grants this skill in the snapshot - it comes from armor pieces, charms or set bonuses only.')}
    <p style="font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:var(--bone-faint); margin:.8rem 0 .2rem;">Weapon jewels (${weaponRows.length}) - fit weapon slots</p>
    ${rows(weaponRows, 'No weapon decoration grants this skill in the snapshot.')}
    <p style="font-size:.8rem; margin:.8rem 0 0;"><a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:.3rem;">Cross-check ${esc(skill.name)} on the community wiki ${icons.external}</a></p>`;
}

// --------------------------------------------------------------------------
// Farm planner section
// --------------------------------------------------------------------------
interface Target {
  skillId: number;
  level: number;
}
let targets: Target[] = [];

function buildTargetSelect() {
  const sel = $('target-skill') as HTMLSelectElement;
  // Only skills with at least one armor decoration are plannable here.
  sel.innerHTML = [...new Set(armorDecos.flatMap((d) => d.skills.map((s) => s.skillId)))]
    .map((id) => skillById.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join('');
}

function renderTargets() {
  const host = $('target-list');
  if (!targets.length) {
    host.innerHTML = `<p style="color:var(--bone-faint); font-size:.85rem;">No targets yet - add the skills your build needs.</p>`;
    return;
  }
  host.innerHTML = targets
    .map(
      (t, i) => `
      <div class="deco-target">
        <span>${esc(skillById.get(t.skillId)!.name)}</span>
        <span class="mono" style="color:var(--ember-bright);">Lv${t.level}</span>
        <button class="btn btn--ghost btn--small x" data-drop="${i}" type="button" title="Remove target">${icons.x}</button>
      </div>`
    )
    .join('');
}

function renderFarmPlan() {
  const host = $('farm-plan');
  if (!targets.length) {
    host.innerHTML = '';
    return;
  }
  const plan = planDecorations(targets);
  const maxSlot = Math.max(...Object.keys(plan.slotCost).map(Number), 0);
  const slotSummary = [3, 2, 1]
    .filter((l) => plan.slotCost[l])
    .map((l) => `<span class="badge">needs ${plan.slotCost[l]}× Lv${l} slot${plan.slotCost[l] > 1 ? 's' : ''}</span>`)
    .join(' ');

  const shortfallDetails = plan.shortfall
    ? targets
        .filter((t) => (plan.delivered[t.skillId] ?? 0) < t.level)
        .map(
          (t) =>
            `<li>${esc(skillById.get(t.skillId)!.name)}: decorations can only deliver Lv${plan.delivered[t.skillId]} of Lv${t.level} - the rest must come from armor pieces, charms or set bonuses.</li>`
        )
        .join('')
    : '';

  host.innerHTML = `
    <div class="card-title" style="margin-top:.2rem;">Farm list</div>
    ${plan.entries
      .map(
        (e) => `
      <div style="display:flex; align-items:center; gap:.6rem; padding:.45rem .2rem; border-bottom:1px dashed var(--line); flex-wrap:wrap;">
        <span class="mono" style="color:var(--ember-bright); font-size:1.05rem;">×${e.count}</span>
        <span class="slot-pip slot-pip--filled" title="Needs a Lv${e.deco.slot} slot"><span>${e.deco.slot}</span></span>
        <strong style="font-size:.92rem;">${esc(e.deco.name)}</strong>
        <span class="badge badge--ember">${e.deco.skills.map((s) => `${esc(s.name)} +${s.level}`).join(', ')}</span>
        <a class="btn btn--ghost btn--small" style="margin-left:auto;" href="https://monsterhunterwilds.wiki.gg/wiki/Special:Search?search=${encodeURIComponent(e.deco.name)}" target="_blank" rel="noopener noreferrer">${icons.external} wiki</a>
      </div>`
      )
      .join('')}
    <div style="display:flex; gap:.45rem; flex-wrap:wrap; margin-top:.7rem; align-items:center;">
      <span class="badge badge--gold">${plan.totalDecos} jewels total</span>
      ${slotSummary}
    </div>
    ${plan.shortfall ? `<div class="notice notice--warn" style="margin-top:.7rem;"><strong>Can't fully cover from decorations:</strong><ul style="margin:.3rem 0 0; padding-left:1.1rem;">${shortfallDetails}</ul></div>` : ''}
    ${maxSlot ? `<p style="font-size:.78rem; color:var(--bone-faint); margin:.6rem 0 0;">A Lv${maxSlot} jewel can also sit in any higher slot - check your armor's slots in the <a href="/builder">set builder</a>.</p>` : ''}
    <div style="display:flex; gap:.5rem; margin-top:.8rem;">
      <button class="btn btn--ghost btn--small" id="btn-copy-plan" type="button">Copy farm list</button>
      <button class="btn btn--ghost btn--small" id="btn-clear-targets" type="button">Clear targets</button>
    </div>`;

  $('btn-copy-plan').addEventListener('click', async () => {
    const text = [
      'HunterForge decoration farm list',
      ...plan.entries.map((e) => `${e.count}× ${e.deco.name} [Lv${e.deco.slot}] - ${e.deco.skills.map((s) => `${s.name} +${s.level}`).join(', ')}`),
      `Total: ${plan.totalDecos} jewels · ${[3, 2, 1].filter((l) => plan.slotCost[l]).map((l) => `${plan.slotCost[l]}× Lv${l} slot`).join(', ')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const btn = $('btn-copy-plan') as HTMLButtonElement;
      btn.innerHTML = `${icons.check} Copied`;
      setTimeout(() => (btn.textContent = 'Copy farm list'), 1500);
    } catch {
      /* clipboard unavailable */
    }
  });
  $('btn-clear-targets').addEventListener('click', () => {
    targets = [];
    renderTargets();
    renderFarmPlan();
  });
}

// --------------------------------------------------------------------------
// Browser section
// --------------------------------------------------------------------------
function renderDecoTable() {
  const search = ($('deco-search') as HTMLInputElement).value.trim().toLowerCase();
  const kind = ($('deco-kind') as HTMLSelectElement).value;
  const slot = Number(($('deco-slot') as HTMLSelectElement).value);
  let pool = decorations;
  if (kind !== 'all') pool = pool.filter((d) => d.kind === kind);
  if (slot) pool = pool.filter((d) => d.slot === slot);
  if (search)
    pool = pool.filter(
      (d) => d.name.toLowerCase().includes(search) || d.skills.some((s) => s.name.toLowerCase().includes(search))
    );
  pool = [...pool].sort((a, b) => a.kind.localeCompare(b.kind) || a.slot - b.slot || a.name.localeCompare(b.name));

  const tbody = $('deco-table').querySelector('tbody')!;
  tbody.innerHTML = pool
    .map(
      (d) => `
      <tr>
        <td><strong>${esc(d.name)}</strong></td>
        <td><span class="badge">${d.kind === 'armor' ? 'armor' : 'weapon'} · Lv${d.slot}+</span></td>
        <td class="num">R${d.rarity}</td>
        <td>${d.skills.map((s) => `<span class="badge badge--ember">${esc(s.name)} +${s.level}</span>`).join(' ')}</td>
      </tr>`
    )
    .join('');
  $('deco-count').textContent = `${pool.length} of ${decorations.length} decorations shown`;
}

// --------------------------------------------------------------------------
// Wire-up
// --------------------------------------------------------------------------
$('skill-select').addEventListener('change', renderSkillDecos);
$('deco-search').addEventListener('input', renderDecoTable);
$('deco-kind').addEventListener('change', renderDecoTable);
$('deco-slot').addEventListener('change', renderDecoTable);

$('btn-add-target').addEventListener('click', () => {
  const skillId = Number(($('target-skill') as HTMLSelectElement).value);
  const level = Math.max(1, Math.min(7, Number(($('target-level') as HTMLInputElement).value) || 1));
  const skill = skillById.get(skillId)!;
  const existing = targets.find((t) => t.skillId === skillId);
  if (existing) existing.level = Math.min(skill.maxLevel, existing.level + level);
  else targets.push({ skillId, level: Math.min(level, skill.maxLevel) });
  renderTargets();
  renderFarmPlan();
});

$('target-list').addEventListener('click', (ev) => {
  const drop = (ev.target as HTMLElement).closest<HTMLElement>('[data-drop]');
  if (drop) {
    targets.splice(Number(drop.dataset.drop), 1);
    renderTargets();
    renderFarmPlan();
  }
});

buildSkillSelect();
buildTargetSelect();
renderTargets();
renderFarmPlan();
renderDecoTable();
