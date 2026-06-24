// Data-driven spawn schedule. The run is divided into time phases; the spawner
// uses the active phase's cadence, batch size, and enemy-type weights. Enemy
// HP/speed still ramp continuously with run time (see EnemySpawner); this table
// governs *what* spawns, *how often*, and *how many* — the difficulty curve in
// one editable place. Boss spawns are scheduled separately on a fixed timer.
export interface WavePhase {
  atMin: number; // phase becomes active at this run-minute
  intervalMs: number; // delay between spawn ticks
  batch: number; // enemies spawned per tick
  weights: Record<string, number>; // enemy type id -> relative roll weight
}

// Must stay sorted by atMin ascending; the first entry must be atMin 0.
// Batch sizes are tuned for a dense, Vampire-Survivors-style swarm (~2x the
// early prototype); enemy HP is lowered a touch in the spawner to compensate.
export const WAVE_PHASES: WavePhase[] = [
  { atMin: 0, intervalMs: 1100, batch: 2, weights: { grunt: 100 } },
  { atMin: 0.5, intervalMs: 950, batch: 2, weights: { grunt: 100, charger: 40 } },
  { atMin: 1, intervalMs: 850, batch: 2, weights: { grunt: 90, charger: 45, splitter: 30 } },
  {
    atMin: 1.5,
    intervalMs: 760,
    batch: 2,
    weights: { grunt: 80, charger: 45, splitter: 30, tank: 22 },
  },
  {
    atMin: 2,
    intervalMs: 680,
    batch: 4,
    weights: { grunt: 70, charger: 50, splitter: 30, tank: 25, ranger: 28 },
  },
  {
    atMin: 3,
    intervalMs: 600,
    batch: 4,
    weights: { grunt: 60, charger: 55, splitter: 35, tank: 30, ranger: 32 },
  },
  {
    atMin: 4.5,
    intervalMs: 500,
    batch: 4,
    weights: { grunt: 50, charger: 60, splitter: 40, tank: 35, ranger: 36 },
  },
  {
    atMin: 6,
    intervalMs: 420,
    batch: 6,
    weights: { grunt: 45, charger: 60, splitter: 45, tank: 40, ranger: 40 },
  },
];

export const BOSS_EVERY_MS = 90000; // an elite boss every 90s

// Returns the active phase for the given run time (minutes).
export function currentPhase(minutes: number): WavePhase {
  let phase = WAVE_PHASES[0];
  for (const p of WAVE_PHASES) {
    if (minutes >= p.atMin) phase = p;
    else break;
  }
  return phase;
}
