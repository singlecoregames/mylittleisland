import { TEX } from '../config';

// Defensive structures placed on island tiles. Data-driven like weapons so new
// structures (fences, gardens, ponds...) are added here without touching the
// system. Step 1 ships the Lily Cannon turret.
export interface StructureDef {
  id: string;
  name: string;
  tex: string;
  range: number; // px — engages enemies within this radius
  cooldownMs: number;
  damage: number;
  projectileSpeed: number; // px/sec
}

export const STRUCTURES: Record<string, StructureDef> = {
  cannon: {
    id: 'cannon',
    name: '수련 포탑',
    tex: TEX.CANNON,
    range: 130,
    cooldownMs: 850,
    damage: 6,
    projectileSpeed: 240,
  },
};
