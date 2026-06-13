// Central place for resolution, grid, and balance-independent constants.
export const GAME = {
  WIDTH: 640,
  HEIGHT: 360,
  TILE: 32,
} as const;

export const SCENE_KEYS = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  GAME: 'Game',
  UI: 'UI',
} as const;

// Texture keys for the programmatically generated placeholder art.
export const TEX = {
  LAND: 'tex-land',
  WATER: 'tex-water',
  PLAYER: 'tex-player',
  ENEMY: 'tex-enemy',
  JOY_BASE: 'tex-joy-base',
  JOY_THUMB: 'tex-joy-thumb',
  SKILL_BTN: 'tex-skill-btn',
} as const;
