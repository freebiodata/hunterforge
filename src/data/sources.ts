import type { DataSource } from './types';

/**
 * Every source this site's dataset was built from, with the date it was
 * accessed. Shown in the UI (About / Data page) - if a number looks wrong,
 * this is where it came from.
 */

/** Sources fetched programmatically for the 2026-10-11 snapshot. */
export const dataSources: DataSource[] = [
  {
    name: 'wilds.mhdb.io - Monster Hunter Wilds DB',
    url: 'https://wilds.mhdb.io/en',
    what: 'High-rank armor pieces, skills (levels & max caps), set/group bonuses, decorations, charms and weapon presets. Game-file-extracted database by LartTyler (github.com/LartTyler/mhdb-wilds).',
    accessed: '2026-10-11',
  },
  {
    name: 'Fextralife - Monster Hunter Wilds Wiki, Sharpness',
    url: 'https://monsterhunterwilds.wiki.fextralife.com/Sharpness',
    what: 'Raw sharpness multipliers Red→White (0.50 / 0.75 / 1.00 / 1.05 / 1.20 / 1.32) and elemental reference values.',
    accessed: '2026-10-11',
  },
  {
    name: 'r/MonsterHunter - "How does sharpness work in MHWilds exactly?"',
    url: 'https://www.reddit.com/r/MonsterHunter/comments/1ol4toa/how_does_sharpness_work_in_mhwilds_exactly/',
    what: 'Community confirmation of Purple = 1.39× raw / 1.25× elemental and White = 1.32× raw in the title-update era.',
    accessed: '2026-10-11',
  },
  {
    name: 'Nexus Mods - Max Purple Sharpness (mod description)',
    url: 'https://www.nexusmods.com/monsterhunterwilds/',
    what: 'Cross-check that Purple sharpness grants a 1.39× raw and 1.25× elemental multiplier.',
    accessed: '2026-10-11',
  },
];

/** Community references we point users to (not scraped for this snapshot). */
export const furtherReading: DataSource[] = [
  {
    name: 'monsterhunterwilds.wiki.gg - the community wiki',
    url: 'https://monsterhunterwilds.wiki.gg/',
    what: 'Primary community wiki. Cross-check any value here; note the wiki blocks automated access, so HunterForge did not scrape it directly for this snapshot.',
    accessed: '2026-10-11',
  },
  {
    name: 'monsterhunterwilds.wiki.fextralife.com - Fextralife wiki',
    url: 'https://monsterhunterwilds.wiki.fextralife.com/',
    what: 'Secondary wiki used for the sharpness reference table.',
    accessed: '2026-10-11',
  },
];
