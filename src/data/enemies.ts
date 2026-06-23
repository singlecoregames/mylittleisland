// Data-driven alien types. The spawner rolls a type (weighted, gated by run
// time) and scales the run's base HP/speed by the type's multipliers; the Enemy
// applies the visual + behaviour fields. Keeping this declarative makes adding
// new aliens a data edit rather than a code change.
export interface EnemyType {
  id: string;
  color: number; // body colour; a per-type texture is generated from it
  scale: number; // visual scale (hitbox stays the placeholder size)
  hpMult: number; // multiplies the run's ramping base HP
  speedMult: number; // multiplies the run's ramping base speed
  turnRate?: number; // steering responsiveness override (default in Enemy)
  knockbackResist: number; // 0..1 fraction of knockback force/duration ignored
  xp: number; // gem value dropped on death
  contactDmg?: number; // per-overlap-frame damage to the player (default 0.5)
  isBoss?: boolean; // scheduled separately + draws an HP bar
  splitInto?: { type: string; count: number }; // children spawned on death
  // Ranged attacker. Fires every `cooldownMs` while within `range`. `hold`
  // (default true) makes it stop at standoff range; bosses set it false to keep
  // chasing while shooting. `burst`/`spread` define a fan or radial volley.
  ranged?: {
    range: number;
    cooldownMs: number;
    projectileSpeed: number;
    damage: number;
    hold?: boolean;
    burst?: number; // bullets per volley (default 1)
    spread?: number; // total fan angle in radians; >= 2π = full radial
  };
}

export const ENEMY_TYPES: Record<string, EnemyType> = {
  // Baseline chaser — the bulk of every wave.
  grunt: {
    id: 'grunt',
    color: 0xb24bd8,
    scale: 1,
    hpMult: 1,
    speedMult: 1,
    knockbackResist: 0,
    xp: 1,
  },
  // Fast, fragile, banks hard — rushes the frog.
  charger: {
    id: 'charger',
    color: 0xff7043,
    scale: 0.85,
    hpMult: 0.55,
    speedMult: 1.8,
    turnRate: 9,
    knockbackResist: 0,
    xp: 1,
  },
  // Slow, tough, shrugs off knockback — a wall that soaks damage.
  tank: {
    id: 'tank',
    color: 0x7e57c2,
    scale: 1.5,
    hpMult: 4.5,
    speedMult: 0.55,
    turnRate: 3,
    knockbackResist: 0.85,
    xp: 4,
  },
  // Bursts into a few spawnlings on death.
  splitter: {
    id: 'splitter',
    color: 0x66bb6a,
    scale: 1.2,
    hpMult: 1.6,
    speedMult: 0.9,
    knockbackResist: 0.2,
    xp: 2,
    splitInto: { type: 'spawnling', count: 3 },
  },
  // Ranged attacker: hangs back and lobs bullets at the frog.
  ranger: {
    id: 'ranger',
    color: 0x42a5f5,
    scale: 1,
    hpMult: 1.3,
    speedMult: 0.85,
    knockbackResist: 0,
    xp: 3,
    ranged: { range: 150, cooldownMs: 1600, projectileSpeed: 160, damage: 6 },
  },
  // Elite boss — scheduled on a timer, not rolled. Huge, slow, knockback-proof,
  // chases while emitting radial bullet rings. Big XP payout on death.
  boss: {
    id: 'boss',
    color: 0x8b1a1a,
    scale: 2.6,
    hpMult: 40,
    speedMult: 0.5,
    turnRate: 2.5,
    knockbackResist: 1,
    contactDmg: 1,
    isBoss: true,
    xp: 30,
    ranged: {
      range: 240,
      cooldownMs: 2400,
      projectileSpeed: 120,
      damage: 8,
      hold: false,
      burst: 14,
      spread: Math.PI * 2,
    },
  },
  // Splitter offspring — small, quick, never rolled naturally.
  spawnling: {
    id: 'spawnling',
    color: 0x9ccc65,
    scale: 0.6,
    hpMult: 0.35,
    speedMult: 1.25,
    knockbackResist: 0,
    xp: 1,
  },
};

export const GRUNT = ENEMY_TYPES.grunt;

// Texture key for a type's generated body sprite (see TextureFactory).
export const enemyTexKey = (id: string): string => `enemy-${id}`;
