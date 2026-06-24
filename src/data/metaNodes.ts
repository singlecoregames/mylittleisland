// Meta-graph upgrade data. Nodes are unlocked permanently with amber and apply
// their bonuses at the start of every run (wired in M5 step 3). The graph is a
// fixed layout in world coordinates; MetaScene pans/zooms a camera over it.
//
// Data-driven by design: adding a node here is enough to make it appear,
// connect via `requires`, and contribute to the aggregated run bonuses.

export type MetaCategory = 'island' | 'util' | 'attack' | 'survival' | 'active' | 'structure';

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
  startCannons: number; // turret build credits granted at run start
  startFences: number; // fence build credits granted at run start
  structureDamageMult: number; // added on top of base 1.0 for structures
  regenPerSec: number; // HP regenerated per second during a run
  xpGainMult: number; // added on top of base 1.0 for XP gained
  amberGainMult: number; // added on top of base 1.0 for amber earned per run
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
  {
    id: 'isle4',
    name: '섬 확장 IV',
    description: '광대한 대지. (+3 타일)',
    category: 'island',
    cost: 80,
    position: { x: 320, y: -148 },
    requires: ['isle3'],
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
  {
    id: 'atk4',
    name: '맹독 송곳니',
    description: '모든 무기 데미지 +20%.',
    category: 'attack',
    cost: 60,
    position: { x: 728, y: 14 },
    requires: ['atk3'],
    effects: { damageMult: 0.2 },
  },
  {
    id: 'atk5',
    name: '전광석화',
    description: '무기 쿨다운 -10%.',
    category: 'attack',
    cost: 70,
    position: { x: 636, y: -40 },
    requires: ['atk3'],
    effects: { cooldownReduction: 0.1 },
  },
  {
    id: 'atk6',
    name: '독 분비선',
    description: '모든 무기 데미지 +15%.',
    category: 'attack',
    cost: 26,
    position: { x: 540, y: 196 },
    requires: ['atk1'],
    effects: { damageMult: 0.15 },
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
  {
    id: 'sur3',
    name: '바위 등껍질',
    description: '최대 체력 +40.',
    category: 'survival',
    cost: 40,
    position: { x: 16, y: 58 },
    requires: ['sur2'],
    effects: { maxHp: 40 },
  },
  {
    id: 'sur4',
    name: '재생력',
    description: '초당 체력 0.6 회복.',
    category: 'survival',
    cost: 55,
    position: { x: 104, y: 16 },
    requires: ['sur2'],
    effects: { regenPerSec: 0.6 },
  },
  {
    id: 'sur5',
    name: '도약',
    description: '이동 속도 +15.',
    category: 'survival',
    cost: 24,
    position: { x: 124, y: 196 },
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
  {
    id: 'util3',
    name: '깨달음',
    description: '경험치 획득량 +15%.',
    category: 'util',
    cost: 34,
    position: { x: 320, y: 456 },
    requires: ['util2'],
    effects: { xpGainMult: 0.15 },
  },
  {
    id: 'util-mag',
    name: '끈끈한 혀',
    description: '경험치 흡수 반경 +30.',
    category: 'util',
    cost: 18,
    position: { x: 236, y: 336 },
    requires: ['util1'],
    effects: { pickupRadius: 30 },
  },
  {
    id: 'util-amber',
    name: '호박석 광맥',
    description: '런 종료 호박석 +20%.',
    category: 'util',
    cost: 30,
    position: { x: 404, y: 336 },
    requires: ['util1'],
    effects: { amberGainMult: 0.2 },
  },

  // --- Structure branch (lower flanks) ------------------------------------
  {
    id: 'fac-cannon1',
    name: '포탑 배치도',
    description: '런 시작 시 수련 포탑 설치권 +1.',
    category: 'structure',
    cost: 12,
    position: { x: 446, y: 248 },
    requires: ['root'],
    effects: { startCannons: 1 },
  },
  {
    id: 'fac-cannon2',
    name: '포탑 증설',
    description: '런 시작 시 수련 포탑 설치권 +1.',
    category: 'structure',
    cost: 30,
    position: { x: 540, y: 296 },
    requires: ['fac-cannon1'],
    effects: { startCannons: 1 },
  },
  {
    id: 'fac-power',
    name: '시설 강화',
    description: '모든 시설 데미지 +30%.',
    category: 'structure',
    cost: 42,
    position: { x: 636, y: 344 },
    requires: ['fac-cannon2'],
    effects: { structureDamageMult: 0.3 },
  },
  {
    id: 'fac-cannon3',
    name: '포탑 군집',
    description: '런 시작 시 수련 포탑 설치권 +1.',
    category: 'structure',
    cost: 64,
    position: { x: 728, y: 392 },
    requires: ['fac-power'],
    effects: { startCannons: 1 },
  },
  {
    id: 'fac-fence1',
    name: '울타리 배치도',
    description: '런 시작 시 가시 울타리 설치권 +1.',
    category: 'structure',
    cost: 12,
    position: { x: 194, y: 248 },
    requires: ['root'],
    effects: { startFences: 1 },
  },
  {
    id: 'fac-fence2',
    name: '울타리 증설',
    description: '런 시작 시 가시 울타리 설치권 +1.',
    category: 'structure',
    cost: 30,
    position: { x: 100, y: 296 },
    requires: ['fac-fence1'],
    effects: { startFences: 1 },
  },
  {
    id: 'fac-fence-power',
    name: '가시 강화',
    description: '모든 시설 데미지 +20%.',
    category: 'structure',
    cost: 40,
    position: { x: 16, y: 344 },
    requires: ['fac-fence2'],
    effects: { structureDamageMult: 0.2 },
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
    startCannons: 0,
    startFences: 0,
    structureDamageMult: 0,
    regenPerSec: 0,
    xpGainMult: 0,
    amberGainMult: 0,
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
  structure: 0xff9f43,
};
