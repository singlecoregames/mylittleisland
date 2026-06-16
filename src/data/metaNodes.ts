// Meta-graph upgrade data. Nodes are unlocked permanently with amber and apply
// their bonuses at the start of every run (wired in M5 step 3). The graph is a
// fixed layout in world coordinates; MetaScene pans/zooms a camera over it.
//
// Data-driven by design: adding a node here is enough to make it appear,
// connect via `requires`, and contribute to the aggregated run bonuses.

export type MetaCategory = 'island' | 'util' | 'attack' | 'survival' | 'active';

// All run-start bonuses are additive numbers; the run consumer decides how to
// interpret each (e.g. islandTiles -> grid size, damageMult -> +fraction).
export interface MetaBonuses {
  islandTiles: number; // extra tiles added to each island dimension
  maxHp: number;
  moveSpeed: number; // px/sec
  damageMult: number; // added on top of base 1.0
  cooldownReduction: number; // fraction subtracted from base 1.0 (clamped)
  pickupRadius: number; // px
  startXp: number; // XP granted at run start
  extraProjectiles: number;
}

export interface MetaNode {
  id: string;
  name: string;
  description: string;
  category: MetaCategory;
  cost: number; // amber; 0 = root, auto-owned
  position: { x: number; y: number }; // world coords in the graph
  requires: string[];
  effects: Partial<MetaBonuses>;
  isIslandExpansion?: boolean;
}

export const META_NODES: MetaNode[] = [
  {
    id: 'root',
    name: '개구리 둥지',
    description: '모든 성장의 시작점.',
    category: 'util',
    cost: 0,
    position: { x: 320, y: 200 },
    requires: [],
    effects: {},
  },

  // --- Island expansion spine (central, the core differentiator) ----------
  {
    id: 'isle1',
    name: '섬 확장 I',
    description: '시작 섬이 한 바퀴 넓어진다. (+2 타일)',
    category: 'island',
    cost: 8,
    position: { x: 320, y: 110 },
    requires: ['root'],
    effects: { islandTiles: 2 },
    isIslandExpansion: true,
  },
  {
    id: 'isle2',
    name: '섬 확장 II',
    description: '땅이 더 넓어진다. (+2 타일)',
    category: 'island',
    cost: 22,
    position: { x: 320, y: 24 },
    requires: ['isle1'],
    effects: { islandTiles: 2 },
    isIslandExpansion: true,
  },
  {
    id: 'isle3',
    name: '섬 확장 III',
    description: '드넓은 섬. (+3 타일)',
    category: 'island',
    cost: 48,
    position: { x: 320, y: -62 },
    requires: ['isle2'],
    effects: { islandTiles: 3 },
    isIslandExpansion: true,
  },

  // --- Attack branch (right) ----------------------------------------------
  {
    id: 'atk1',
    name: '송곳니 연마',
    description: '모든 무기 데미지 +15%.',
    category: 'attack',
    cost: 10,
    position: { x: 440, y: 150 },
    requires: ['root'],
    effects: { damageMult: 0.15 },
  },
  {
    id: 'atk2',
    name: '빠른 혀',
    description: '무기 쿨다운 -12%.',
    category: 'attack',
    cost: 18,
    position: { x: 540, y: 104 },
    requires: ['atk1'],
    effects: { cooldownReduction: 0.12 },
  },
  {
    id: 'atk3',
    name: '다중 침',
    description: '투사체 무기 발사 수 +1.',
    category: 'attack',
    cost: 34,
    position: { x: 636, y: 56 },
    requires: ['atk2'],
    effects: { extraProjectiles: 1 },
  },

  // --- Survival branch (left) ---------------------------------------------
  {
    id: 'sur1',
    name: '두꺼운 가죽',
    description: '최대 체력 +25.',
    category: 'survival',
    cost: 10,
    position: { x: 200, y: 150 },
    requires: ['root'],
    effects: { maxHp: 25 },
  },
  {
    id: 'sur2',
    name: '재빠른 발',
    description: '이동 속도 +15.',
    category: 'survival',
    cost: 16,
    position: { x: 100, y: 104 },
    requires: ['sur1'],
    effects: { moveSpeed: 15 },
  },

  // --- Utility branch (down) ----------------------------------------------
  {
    id: 'util1',
    name: '넓은 혀',
    description: '경험치 흡수 반경 +24.',
    category: 'util',
    cost: 8,
    position: { x: 320, y: 296 },
    requires: ['root'],
    effects: { pickupRadius: 24 },
  },
  {
    id: 'util2',
    name: '이른 성장',
    description: '런 시작 시 경험치 +10.',
    category: 'util',
    cost: 14,
    position: { x: 320, y: 376 },
    requires: ['util1'],
    effects: { startXp: 10 },
  },
];

export const META_BY_ID = new Map(META_NODES.map((n) => [n.id, n]));

// Nodes with cost 0 are owned from the start (the root).
export const FREE_NODE_IDS = META_NODES.filter((n) => n.cost === 0).map((n) => n.id);

export function emptyBonuses(): MetaBonuses {
  return {
    islandTiles: 0,
    maxHp: 0,
    moveSpeed: 0,
    damageMult: 0,
    cooldownReduction: 0,
    pickupRadius: 0,
    startXp: 0,
    extraProjectiles: 0,
  };
}

// Sums the effects of every owned node into a single bonus bundle.
export function aggregateBonuses(unlockedIds: Iterable<string>): MetaBonuses {
  const owned = new Set(unlockedIds);
  for (const id of FREE_NODE_IDS) owned.add(id);

  const bonuses = emptyBonuses();
  for (const id of owned) {
    const node = META_BY_ID.get(id);
    if (!node) continue;
    for (const [key, value] of Object.entries(node.effects)) {
      bonuses[key as keyof MetaBonuses] += value as number;
    }
  }
  return bonuses;
}

export const CATEGORY_COLOR: Record<MetaCategory, number> = {
  island: 0x33dd55,
  attack: 0xff6b6b,
  survival: 0x49c2ff,
  util: 0xffd166,
  active: 0xc77dff,
};
