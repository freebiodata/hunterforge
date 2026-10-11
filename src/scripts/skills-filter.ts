/** Skill library client filter - the list itself is server-rendered for SEO. */
const search = document.getElementById('skill-search') as HTMLInputElement;
const kindSel = document.getElementById('skill-kind') as HTMLSelectElement;
const count = document.getElementById('skill-count')!;
const empty = document.getElementById('skill-empty')!;
const items = [...document.querySelectorAll<HTMLElement>('.skill-item')];

function apply() {
  const q = search.value.trim().toLowerCase();
  const kind = kindSel.value;
  let shown = 0;
  for (const item of items) {
    const match =
      (!q || (item.dataset.name ?? '').includes(q)) && (kind === 'all' || item.dataset.kind === kind);
    item.style.display = match ? '' : 'none';
    if (match) shown++;
  }
  count.textContent = `${shown} / ${items.length} skills`;
  empty.style.display = shown === 0 ? '' : 'none';
}

search.addEventListener('input', apply);
kindSel.addEventListener('change', apply);
apply();
