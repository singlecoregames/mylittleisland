// Central place for resolution, grid, and balance-independent constants.
export const GAME = {
  WIDTH: 640,
  HEIGHT: 360,
  TILE: 32,
} as const;

export const SCENE_KEYS = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  TITLE: 'Title',
  GAME: 'Game',
  UI: 'UI',
  PAUSE: 'Pause',
  RESULT: 'Result',
  META: 'Meta',
} as const;

// Texture keys for the programmatically generated placeholder art.
export const TEX = {
  LAND: 'tex-land',
  WATER: 'tex-water',
  PLAYER: 'tex-player',
  ENEMY: 'tex-enemy',
  GEM: 'tex-gem',
  PROJECTILE: 'tex-projectile',
  JOY_BASE: 'tex-joy-base',
  JOY_THUMB: 'tex-joy-thumb',
  SKILL_BTN: 'tex-skill-btn',
  CANNON: 'tex-cannon',
  FENCE: 'tex-fence',
} as const;
