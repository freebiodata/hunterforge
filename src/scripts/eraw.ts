/**
 * Effective Raw calculator - client logic. All math lives in lib/eraw.ts
 * (unit-tested); this file only wires inputs to it.
 */
import { computeEraw, compareSharpness } from '../lib/eraw';
import { sharpnessByColor } from '../data/sharpness';
import { weaponPresets } from '../data/weapons';
import type { SharpnessColor } from '../data/sharpness';
import { icons } from '../lib/icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const KIND_LABELS: Record<string, string> = {
  'great-sword': 'Great Sword',
  'long-sword': 'Long Sword',
  'sword-shield': 'Sword & Shield',
  'dual-blades': 'Dual Blades',
  hammer: 'Hammer',
  'hunting-horn': 'Hunting Horn',
  lance: 'Lance',
  gunlance: 'Gunlance',
  'switch-axe': 'Switch Axe',
  'charge-blade': 'Charge Blade',
  'insect-glaive': 'Insect Glaive',
  'light-bowgun': 'Light Bowgun',
  'heavy-bowgun': 'Heavy Bowgun',
  bow: 'Bow',
};

function readInput() {
  return {
    raw: Number(($('raw') as HTMLInputElement).value) || 1,
    affinityPercent: Number(($('affinity') as HTMLInputElement).value) || 0,
    sharpness: ($('sharpness') as HTMLSelectElement).value as SharpnessColor,
    criticalBoostLevel: Number(($('critboost') as HTMLInputElement).value),
  };
}

function render() {
  const input = readInput();
  const result = computeEraw(input);
  const sharp = sharpnessByColor[input.sharpness];

  $('eraw-value').textContent = result.eraw.toFixed(1);
  $('eraw-note').innerHTML = result.negativeAffinity
    ? `<span style="display:inline-flex; align-items:center; gap:.35rem;">${icons.warning} Negative affinity: fixed ×0.75 penalty on ${Math.abs(input.affinityPercent)}% of hits - Critical Boost does not apply.</span>`
    : `Crits (${input.affinityPercent}% of hits) deal ×${result.critMultiplier.toFixed(2)} damage.`;
  ($('sharp-hint') as HTMLElement).innerHTML = `<i class="sharp-dot s-${input.sharpness}"></i>&nbsp;×${sharp.raw.toFixed(2)} raw`;

  $('eraw-steps').innerHTML = result.steps
    .map(
      (s) =>
        `<li><span class="lbl">${s.label}</span><span>${s.formula
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</span></li>`
    )
    .join('');

  const rows = compareSharpness(input);
  const max = Math.max(...rows.map((r) => r.eraw));
  $('sharp-compare').innerHTML = rows
    .map((r) => {
      const width = Math.max(2, Math.round((r.eraw / max) * 100));
      const current = r.color === input.sharpness;
      return `<div class="chart-row ${current ? 'current' : ''}">
        <span class="mono" style="color:${current ? 'var(--ember-bright)' : 'var(--bone-dim)'}; display:inline-flex; align-items:center; gap:.35rem;"><i class="sharp-dot s-${r.color}"></i>${r.label}</span>
        <div class="bar" style="width:${width}%; opacity:${current ? 1 : 0.55};"></div>
        <span class="val">${r.eraw.toFixed(1)}</span>
      </div>`;
    })
    .join('');
}

function buildPresets() {
  const sel = $('preset') as HTMLSelectElement;
  sel.innerHTML =
    '<option value=""> - pick a preset - </option>' +
    weaponPresets
      .map(
        (w) =>
          `<option value="${w.id}">${escHtml(KIND_LABELS[w.kind] ?? w.kind)} - ${escHtml(w.name)} (raw ${w.raw}, aff ${w.affinity >= 0 ? '+' : ''}${w.affinity}%)</option>`
      )
      .join('');
  sel.addEventListener('change', () => {
    const w = weaponPresets.find((x) => x.id === Number(sel.value));
    if (!w) return;
    ($('raw') as HTMLInputElement).value = String(w.raw);
    ($('affinity') as HTMLInputElement).value = String(w.affinity);
    render();
  });
}

function escHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

for (const id of ['raw', 'affinity', 'sharpness', 'critboost']) {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
}

buildPresets();
render();
