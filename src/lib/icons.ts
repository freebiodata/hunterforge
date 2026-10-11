/**
 * Shared inline SVG icon set (stroke style, 24x24, currentColor).
 * Used by both Astro components (<Fragment set:html={icons.x} />) and the
 * client scripts (template strings) so iconography stays consistent site-wide.
 * No emoji, no external icon fonts - every icon ships in the HTML/JS payload.
 */

const svg = (paths: string) =>
  `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  // --- elements (resistances) ------------------------------------------------
  fire: svg('<path d="M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 .8-3.2 1.8-4.8.5 1.8 1.7 2.8 3.2 2.8-1.2-2.6-1.2-5.4 0-8z"/>'),
  water: svg('<path d="M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" opacity=".6"/>'),
  ice: svg('<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>'),
  thunder: svg('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>'),
  dragon: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.2"/><path d="M12 9.8V14" opacity=".6"/>'),

  // --- armor piece kinds -----------------------------------------------------
  head: svg('<path d="M4 12a8 8 0 0 1 16 0v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M4 13.5h16"/><path d="M12 13.5V19"/>'),
  chest: svg('<path d="M8 3h8l1 4c1.5 5-1 10-5 13-4-3-6.5-8-5-13z"/><path d="M10 3l2 3 2-3"/>'),
  arms: svg('<path d="M7 11V7a5 5 0 0 1 10 0v4M7 11h10v3a5 5 0 0 1-10 0z"/><path d="M12 14v3"/>'),
  waist: svg('<path d="M3 8h18v6H3z"/><path d="M10 6h4v10h-4z"/><path d="M12 10v3"/>'),
  legs: svg('<path d="M8 3h6v9l5 3v5H8l-2-4z"/><path d="M8 8h6"/>'),
  charm: svg('<path d="M6 3c0 4 2.7 6 6 6s6-2 6-6"/><path d="M12 9l4 4-4 8-4-8z"/>'),

  // --- ui --------------------------------------------------------------------
  check: svg('<path d="M4 12.5l5 5L20 6.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  dot: svg('<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'),
  external: svg('<path d="M14 3h7v7M21 3l-9 9"/><path d="M11 5H5v14h14v-6"/>'),
  chevron: svg('<path d="M9 5l7 7-7 7"/>'),
  warning: svg('<path d="M12 3 2 21h20z"/><path d="M12 10v5"/><path d="M12 18.2v.01"/>'),
  gem: svg('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M12 21 8 9l4-6 4 6-4 12"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  sword: svg('<path d="M14 2 4 14h6l-1 8 10-12h-6z"/>'),
} as const;

export type IconName = keyof typeof icons;
