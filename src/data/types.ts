/** Shared dataset types. Hand-written (unlike the generated data files). */

export type SkillKind = 'armor' | 'weapon' | 'set' | 'group';

export interface Skill {
  id: number;
  name: string;
  kind: SkillKind;
  /** Maximum level the skill can reach in-game. */
  maxLevel: number;
  /** Effect description per level index 0..maxLevel-1. */
  levels: string[];
}

export type PieceKind = 'head' | 'chest' | 'arms' | 'waist' | 'legs';

export interface PieceSkill {
  skillId: number;
  name: string;
  level: number;
}

export interface Resistances {
  fire: number;
  water: number;
  ice: number;
  thunder: number;
  dragon: number;
}

export interface ArmorPiece {
  id: number;
  name: string;
  kind: PieceKind;
  rarity: number;
  /** Set name as shown in-game (includes α/β variant suffix). */
  setName: string;
  defenseBase: number;
  defenseMax: number;
  resistances: Resistances;
  /** Decoration slot levels, descending. Empty = no slots. */
  slots: number[];
  skills: PieceSkill[];
}

export interface MaterialCost {
  name: string;
  quantity: number;
}

export interface SetBonus {
  /** Identity key: skillId + thresholds. Pieces pool towards bonuses by key. */
  key: string;
  skillId: number;
  skillName: string;
  ranks: { pieces: number; level: number; rankName: string; description: string }[];
  /** Variant set names that feed this bonus. */
  families: string[];
}

export interface GroupSkill {
  /** Name of the group skill shown on pieces, e.g. "Fortifying Pelt". */
  groupSkillName: string;
  grantedSkillName: string;
  grantedSkillId: number;
  pieces: number;
  level: number;
  description: string;
}

export interface PieceSetMembership {
  family: string;
  variant: string;
  groupSkillName?: string;
  setBonusKey?: string;
}

export interface Decoration {
  id: number;
  name: string;
  /** Minimum slot level required (1–3). */
  slot: number;
  rarity: number;
  /** 'armor' decorations fit armor slots; 'weapon' decorations fit weapon slots. */
  kind: 'armor' | 'weapon';
  skills: PieceSkill[];
}

export interface Charm {
  id: number;
  name: string;
  /** Charm tier within its family (I=1, II=2, ...). */
  level: number;
  rarity: number;
  skills: PieceSkill[];
  craftable: boolean;
  materials: MaterialCost[];
}

export interface WeaponPreset {
  id: number;
  name: string;
  kind: string;
  rarity: number;
  raw: number;
  affinity: number;
  slots: number[];
}

export interface SiteMeta {
  snapshotDate: string;
  gameVersionNote: string;
  coverage: {
    highRankArmorPieces: number;
    armorSets: number;
    armorSetsTotal: number;
    skillsTotal: number;
    skillsGrantedByArmor: number;
    skillsGrantedByCharms: number;
    skillsGrantedByArmorDecos: number;
    decorations: number;
    armorDecorations: number;
    weaponDecorations: number;
    charmRanks: number;
    weaponPresets: number;
  };
}

/** Where a piece of data came from - shown in the UI so gaps are never hidden. */
export interface DataSource {
  name: string;
  url: string;
  what: string;
  accessed: string;
}
