// Data-driven weapon definitions. Balancing lives here, separate from logic so
// new weapons can be added without touching the WeaponSystem.

export type WeaponKind = 'projectile' | 'melee' | 'aura' | 'nova' | 'lightning' | 'orbit';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  baseDamage: number;
  cooldownMs: number;
  maxLevel: number;
  color?: number; // tint for projectiles / visual colour (default white/yellow)
  projectileSpeed?: number; // projectile / nova kind
  baseCount?: number; // projectile shots, nova burst size, or orbit orb count
  pierce?: number; // projectile / nova: enemies pierced before despawn
  range?: number; // melee/aura/lightning radius, or orbit ring radius (px)
  targets?: number; // lightning: base number of enemies struck
}

export const WEAPONS: Record<string, WeaponDef> = {
  // --- Starter trio ---
  spit: {
    id: 'spit',
    name: '침방울',
    kind: 'projectile',
    baseDamage: 6,
    cooldownMs: 800,
    maxLevel: 8,
    projectileSpeed: 210,
    baseCount: 1,
    pierce: 1,
  },
  tongue: {
    id: 'tongue',
    name: '혀 채찍',
    kind: 'melee',
    baseDamage: 11,
    cooldownMs: 650,
    maxLevel: 8,
    range: 52,
    color: 0xff5fa2,
  },
  lotus: {
    id: 'lotus',
    name: '연꽃 가시',
    kind: 'aura',
    baseDamage: 4,
    cooldownMs: 500,
    maxLevel: 8,
    range: 64,
    color: 0x9cff7a,
  },
  // --- Projectile variants ---
  icicle: {
    id: 'icicle',
    name: '고드름',
    kind: 'projectile',
    baseDamage: 5,
    cooldownMs: 520,
    maxLevel: 8,
    projectileSpeed: 330,
    baseCount: 1,
    pierce: 3,
    color: 0x8ee8ff,
  },
  hornet: {
    id: 'hornet',
    name: '말벌 떼',
    kind: 'projectile',
    baseDamage: 3,
    cooldownMs: 900,
    maxLevel: 8,
    projectileSpeed: 260,
    baseCount: 3,
    pierce: 1,
    color: 0xffd24a,
  },
  pebble: {
    id: 'pebble',
    name: '돌팔매',
    kind: 'projectile',
    baseDamage: 16,
    cooldownMs: 1100,
    maxLevel: 8,
    projectileSpeed: 170,
    baseCount: 1,
    pierce: 4,
    color: 0xc8a06a,
  },
  // --- Radial burst ---
  spore: {
    id: 'spore',
    name: '포자 폭발',
    kind: 'nova',
    baseDamage: 7,
    cooldownMs: 1400,
    maxLevel: 8,
    projectileSpeed: 190,
    baseCount: 8,
    pierce: 1,
    color: 0xb6ff8a,
  },
  // --- Orbiting orbs ---
  lilypad: {
    id: 'lilypad',
    name: '연잎 방패',
    kind: 'orbit',
    baseDamage: 6,
    cooldownMs: 360,
    maxLevel: 8,
    range: 46,
    baseCount: 2,
    color: 0x49b85c,
  },
  // --- Chain-free lightning ---
  thunder: {
    id: 'thunder',
    name: '천둥',
    kind: 'lightning',
    baseDamage: 14,
    cooldownMs: 1300,
    maxLevel: 8,
    range: 190,
    targets: 3,
    color: 0xfff2a0,
  },
  // --- Heavy slow aura ---
  bramble: {
    id: 'bramble',
    name: '가시덤불',
    kind: 'aura',
    baseDamage: 9,
    cooldownMs: 900,
    maxLevel: 8,
    range: 54,
    color: 0x7bd14a,
  },
};

export const MAX_WEAPON_SLOTS = 4;

// --- Effective stat helpers (level + run multipliers folded in) ---

export function weaponDamage(def: WeaponDef, level: number, damageMult: number): number {
  return def.baseDamage * (1 + 0.25 * (level - 1)) * damageMult;
}

export function weaponCooldown(def: WeaponDef, cooldownMult: number): number {
  return def.cooldownMs * cooldownMult;
}

// Projectile count grows by +1 every two levels, plus any run bonus.
export function weaponProjectileCount(def: WeaponDef, level: number, extra: number): number {
  const fromLevel = Math.floor((level - 1) / 2);
  return (def.baseCount ?? 1) + fromLevel + extra;
}

// Nova burst grows by +1 per level (plus run bonus) for a denser ring.
export function weaponNovaCount(def: WeaponDef, level: number, extra: number): number {
  return (def.baseCount ?? 8) + (level - 1) + extra;
}

// Orbit orb count grows by +1 every two levels.
export function weaponOrbCount(def: WeaponDef, level: number): number {
  return (def.baseCount ?? 2) + Math.floor((level - 1) / 2);
}

// Lightning strikes one more enemy every two levels.
export function weaponTargets(def: WeaponDef, level: number): number {
  return (def.targets ?? 2) + Math.floor((level - 1) / 2);
}

// Aura/melee/orbit range grows modestly with level.
export function weaponRange(def: WeaponDef, level: number): number {
  return (def.range ?? 48) * (1 + 0.08 * (level - 1));
}
