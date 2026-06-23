import { TEX } from '../config';

// Defensive structures placed on island tiles. Data-driven like weapons so new
// structures (gardens, ponds...) are added here without touching the system.
//   - turret: auto-fires projectiles at enemies in range.
//   - fence:  a solid blocker that aliens cannot cross and that chips contact
//             damage off whatever pushes against it.
export type StructureKind = 'turret' | 'fence';

export interface StructureDef {
  id: string;
  name: string;
  label: string; // short HUD button label
  tex: string;
  kind: StructureKind;

  // turret fields
  range?: number;
  cooldownMs?: number;
  damage?: number;
  projectileSpeed?: number;

  // fence fields
  contactDamage?: number; // applied per contact tick
}

export const STRUCTURES: Record<string, StructureDef> = {
  cannon: {
    id: 'cannon',
    name: '수련 포탑',
    label: '포탑',
    tex: TEX.CANNON,
    kind: 'turret',
    range: 130,
    cooldownMs: 850,
    damage: 6,
    projectileSpeed: 240,
  },
  fence: {
    id: 'fence',
    name: '가시 울타리',
    label: '가시',
    tex: TEX.FENCE,
    kind: 'fence',
    contactDamage: 4,
  },
};

// The structures the player can build, in HUD order.
export const BUILDABLE_IDS = ['cannon', 'fence'] as const;
