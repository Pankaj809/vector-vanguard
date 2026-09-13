// config.js — tunables, palette and difficulty table.
// All gameplay coordinates are in "logical" units on a fixed portrait canvas;
// render.js scales these to the physical device resolution.

export const BASE_W = 540;
export const BASE_H = 960;

// Fixed-timestep simulation (ported from the original 60 Hz loop in main.c).
export const TIME_STEP = 1 / 60;
export const MAX_FRAME_DT = 0.25; // clamp to avoid the "spiral of death"

// HUD band height at the top of the playfield (logical units).
export const HUD_H = 92;
export const PLAY_TOP = HUD_H;

// Player / combat tuning (carried over from input.c / game.c, retuned for portrait).
export const PLAYER_SPEED = 300; // units/s
export const BULLET_SPEED = 640; // units/s (always fires "up" in the vertical shooter)
export const FIRE_COOLDOWN = 0.18; // seconds
export const PLAYER_RADIUS = 18;
export const ENEMY_RADIUS = 16;
export const BULLET_RADIUS = 4;
export const START_LIVES = 3;
export const SCORE_PER_KILL = 10;

export const MAX_PARTICLES = 260;

// Difficulty — mirrors game.c, with a gentle spawn ramp added for progression.
export const DIFFICULTY = {
  easy: { label: 'EASY', spawnInterval: 2.0, enemySpeed: 95, rampEvery: 180, rampMin: 1.1 },
  normal: { label: 'NORMAL', spawnInterval: 1.4, enemySpeed: 125, rampEvery: 150, rampMin: 0.8 },
  hard: { label: 'HARD', spawnInterval: 0.8, enemySpeed: 160, rampEvery: 120, rampMin: 0.45 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

// Cohesive dark-arcade palette with a single cyan accent (from render.c).
export const COLORS = {
  bg: '#080c16',
  bgGrad: '#0b1226',
  panel: '#0e1424',
  panelEdge: '#14213a',
  grid: '#18243a',
  accent: '#00d4ff',
  accentDim: '#0a7d96',
  text: '#d2dae6',
  dim: '#6e7d91',
  warn: '#ffbe3c',
  danger: '#ff4860',
  player: '#00d4ff',
  bullet: '#ffe9a6',
  enemy: '#ff5a72',
  enemyCore: '#ffd2da',
  star: '#3a4a6a',
  earthOcean: '#0f4c81',
  earthLand: '#2f9e6f',
  earthGlow: '#4fd1ff',
  moon: '#8891a3',
  shield: '#4fd1ff',
  rapid: '#ff9a3c',
  spread: '#b98cff',
  life: '#ff6f9c',
  sentinel: '#c23cff',
  sentinelCore: '#f0c8ff',
};

export const STORAGE_KEYS = {
  highScore: 'vv_highscore',
  difficulty: 'vv_difficulty',
  muted: 'vv_muted',
  autofire: 'vv_autofire',
  callsign: 'vv_callsign',
};

// Real-world military-style rank ladder — gives the player a relatable sense
// of identity/progression as their score climbs (shown in HUD + toasts).
export const RANKS = [
  { at: 0, label: 'CADET' },
  { at: 150, label: 'PILOT' },
  { at: 400, label: 'ACE PILOT' },
  { at: 800, label: 'FLIGHT LIEUTENANT' },
  { at: 1500, label: 'SQUADRON LEADER' },
  { at: 2600, label: 'COMMANDER' },
  { at: 4200, label: 'VANGUARD' },
  { at: 7000, label: 'LEGEND OF THE FLEET' },
];

// Combo window: consecutive kills inside this many seconds keep the streak alive.
export const COMBO_WINDOW = 1.4;
export const COMBO_STEP = 5; // kills per +0.5x multiplier
export const COMBO_MAX_MULT = 4;

// Power-ups fall like enemies but are friendly; collect by touching them.
export const POWERUP_INTERVAL = [10, 16]; // seconds, random range between drops
export const POWERUP_SPEED = 110;
export const POWERUP_RADIUS = 16;
export const POWERUP_TYPES = ['shield', 'rapid', 'spread', 'life'];
export const SHIELD_DURATION = 4;
export const RAPID_DURATION = 7;
export const SPREAD_DURATION = 7;

// Sentinel — a tougher mini-boss enemy that appears every SENTINEL_SCORE_STEP
// points to break up the pace and reward focused fire.
export const SENTINEL_SCORE_STEP = 300;
export const SENTINEL_RADIUS = 34;
export const SENTINEL_HP = 5;
export const SENTINEL_SCORE = 150;
