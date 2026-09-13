// game.js — simulation and rules only (no drawing, no DOM).
// Ported from the original src/game.c, retuned for a portrait vertical shooter.

import {
  BASE_W,
  BASE_H,
  PLAY_TOP,
  PLAYER_SPEED,
  BULLET_SPEED,
  FIRE_COOLDOWN,
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  BULLET_RADIUS,
  START_LIVES,
  SCORE_PER_KILL,
  MAX_PARTICLES,
  DIFFICULTY,
  RANKS,
  COMBO_WINDOW,
  COMBO_STEP,
  COMBO_MAX_MULT,
  POWERUP_INTERVAL,
  POWERUP_SPEED,
  POWERUP_RADIUS,
  POWERUP_TYPES,
  SHIELD_DURATION,
  RAPID_DURATION,
  SPREAD_DURATION,
  SENTINEL_SCORE_STEP,
  SENTINEL_RADIUS,
  SENTINEL_HP,
  SENTINEL_SCORE,
} from './config.js';
import { audio } from './audio.js';
import { storage } from './storage.js';

const rand = (min, max) => Math.random() * (max - min) + min;

export class Game {
  constructor() {
    this.state = 'menu'; // menu | options | playing | paused | gameover
    this.difficulty = storage.getDifficulty();
    if (!DIFFICULTY[this.difficulty]) this.difficulty = 'normal';
    this.autofire = storage.getAutofire();
    this.muted = storage.getMuted();

    this.score = 0;
    this.highScore = storage.getHighScore();
    this.newRecord = false;
    this.lives = START_LIVES;

    this.elapsed = 0;
    this.spawnTimer = 0;

    this.player = { x: BASE_W / 2, y: 0, vx: 0, vy: 0, fireCooldown: 0, invuln: 0 };
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.floaters = []; // floating score popups
    this.toasts = []; // transient combat-log messages

    this.shake = 0;

    // Progression / juice state.
    this.rankIndex = 0;
    this.combo = 0;
    this.comboMult = 1;
    this.comboTimer = 0;
    this.killCount = 0;
    this.nextSentinelScore = SENTINEL_SCORE_STEP;
    this.powerupTimer = rand(POWERUP_INTERVAL[0], POWERUP_INTERVAL[1]);
    this.shieldTimer = 0;
    this.rapidTimer = 0;
    this.spreadTimer = 0;
  }

  get playBottom() {
    return BASE_H;
  }

  startMatch() {
    this.score = 0;
    this.lives = START_LIVES;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.newRecord = false;
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.powerups.length = 0;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.player.x = BASE_W / 2;
    this.player.y = PLAY_TOP + (BASE_H - PLAY_TOP) * 0.78; // ship sits low in portrait
    this.player.vx = this.player.vy = 0;
    this.player.fireCooldown = 0;
    this.player.invuln = 1.0;
    this.state = 'playing';

    this.rankIndex = 0;
    this.combo = 0;
    this.comboMult = 1;
    this.comboTimer = 0;
    this.killCount = 0;
    this.nextSentinelScore = SENTINEL_SCORE_STEP;
    this.powerupTimer = rand(POWERUP_INTERVAL[0], POWERUP_INTERVAL[1]);
    this.shieldTimer = 0;
    this.rapidTimer = 0;
    this.spreadTimer = 0;

    this.toast(`WELCOME BACK, ${RANKS[0].label}`);
    this.toast('HOSTILES INBOUND');
  }

  get rank() {
    return RANKS[this.rankIndex].label;
  }

  // Persistent "career" rank derived from the all-time high score — shown on
  // the menu so the pilot has a sense of identity even before a match starts.
  get highScoreRank() {
    let label = RANKS[0].label;
    for (const r of RANKS) if (this.highScore >= r.at) label = r.label;
    return label;
  }

  _checkRankUp() {
    let next = this.rankIndex;
    while (next + 1 < RANKS.length && this.score >= RANKS[next + 1].at) next++;
    if (next !== this.rankIndex) {
      this.rankIndex = next;
      this.toast(`RANK UP — ${RANKS[next].label}`);
      this.spawnParticles(this.player.x, this.player.y - 20, '#ffe9a6', 18, [40, 140]);
      audio.rankUp();
    }
  }

  toast(msg) {
    this.toasts.push({ msg, life: 2.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  spawnParticles(x, y, color, count, speedRange = [60, 220]) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = rand(0, Math.PI * 2);
      const sp = rand(speedRange[0], speedRange[1]);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.25, 0.7),
        color,
        size: rand(1.5, 3.5),
      });
    }
  }

  spawnEnemy() {
    const x = rand(ENEMY_RADIUS, BASE_W - ENEMY_RADIUS);
    this.enemies.push({
      x,
      y: PLAY_TOP - ENEMY_RADIUS,
      vx: 0,
      vy: 0,
      radius: ENEMY_RADIUS,
      spin: rand(0, Math.PI * 2),
      hp: 1,
      sentinel: false,
      flash: 0,
    });
  }

  spawnSentinel() {
    const x = rand(SENTINEL_RADIUS, BASE_W - SENTINEL_RADIUS);
    this.enemies.push({
      x,
      y: PLAY_TOP - SENTINEL_RADIUS,
      vx: 0,
      vy: 0,
      radius: SENTINEL_RADIUS,
      spin: rand(0, Math.PI * 2),
      hp: SENTINEL_HP,
      maxHp: SENTINEL_HP,
      sentinel: true,
      flash: 0,
    });
    this.toast('WARNING — SENTINEL DETECTED');
  }

  spawnPowerup() {
    const kind = POWERUP_TYPES[Math.floor(rand(0, POWERUP_TYPES.length))];
    this.powerups.push({
      x: rand(POWERUP_RADIUS + 20, BASE_W - POWERUP_RADIUS - 20),
      y: PLAY_TOP - POWERUP_RADIUS,
      kind,
      spin: 0,
    });
  }

  fire() {
    if (this.player.fireCooldown > 0) return;
    const spread = this.spreadTimer > 0;
    const angles = spread ? [-0.22, 0, 0.22] : [0];
    for (const a of angles) {
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - PLAYER_RADIUS,
        vx: Math.sin(a) * BULLET_SPEED,
        vy: -Math.cos(a) * BULLET_SPEED,
        radius: BULLET_RADIUS,
      });
    }
    this.player.fireCooldown = this.rapidTimer > 0 ? FIRE_COOLDOWN * 0.45 : FIRE_COOLDOWN;
    audio.shoot();
  }

  // input: { moveX, moveY, firing }
  update(dt, input) {
    this.shake = Math.max(0, this.shake - dt * 60);

    // Particles + floaters animate in every state so menus feel alive.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.particles.splice(i, 1);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 40 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }

    if (this.state !== 'playing') return;

    this.elapsed += dt;
    const diff = DIFFICULTY[this.difficulty];

    // Spawn interval tightens gradually over time for a sense of progression.
    const ramps = Math.floor(this.elapsed / diff.rampEvery);
    const interval = Math.max(diff.rampMin, diff.spawnInterval * Math.pow(0.9, ramps));
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Sentinel mini-boss every SENTINEL_SCORE_STEP points.
    if (this.score >= this.nextSentinelScore) {
      this.nextSentinelScore += SENTINEL_SCORE_STEP;
      this.spawnSentinel();
    }

    // Power-up drops on a randomized timer.
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      this.powerupTimer = rand(POWERUP_INTERVAL[0], POWERUP_INTERVAL[1]);
      this.spawnPowerup();
    }

    // Timed buffs.
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.rapidTimer > 0) this.rapidTimer -= dt;
    if (this.spreadTimer > 0) this.spreadTimer -= dt;

    // Combo streak decays if the player stops scoring kills.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboMult = 1;
      }
    }

    // --- Player ---
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;

    p.vx = (input.moveX || 0) * PLAYER_SPEED;
    p.vy = (input.moveY || 0) * PLAYER_SPEED;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(PLAYER_RADIUS, Math.min(BASE_W - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAY_TOP + PLAYER_RADIUS, Math.min(BASE_H - PLAYER_RADIUS, p.y));

    if ((input.firing || this.autofire) && this.state === 'playing') this.fire();

    // --- Enemies home toward the player (as in game.c) ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.spin += dt * (e.sentinel ? 1.4 : 3);
      if (e.flash > 0) e.flash -= dt;
      const speed = e.sentinel ? diff.enemySpeed * 0.55 : diff.enemySpeed;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        e.vx = (dx / d) * speed;
        e.vy = (dy / d) * speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Cull enemies that drift far below the screen (player dodged past).
      if (e.y > BASE_H + 60) this.enemies.splice(i, 1);
    }

    // --- Power-ups fall straight down and are collected on touch ---
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      u.spin += dt * 2;
      u.y += POWERUP_SPEED * dt;
      if (u.y > BASE_H + 40) {
        this.powerups.splice(i, 1);
        continue;
      }
      const rs = POWERUP_RADIUS + PLAYER_RADIUS;
      if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 < rs * rs) {
        this._collectPowerup(u.kind);
        this.powerups.splice(i, 1);
      }
    }

    // --- Bullets ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < PLAY_TOP - 20 || b.y > BASE_H + 20 || b.x < -20 || b.x > BASE_W + 20) {
        this.bullets.splice(i, 1);
      }
    }

    this._collisions();
    this._checkRankUp();

    if (this.lives <= 0) this._gameOver();
  }

  _collectPowerup(kind) {
    audio.powerup();
    this.spawnParticles(this.player.x, this.player.y, '#ffffff', 14, [50, 160]);
    switch (kind) {
      case 'shield':
        this.shieldTimer = SHIELD_DURATION;
        this.player.invuln = Math.max(this.player.invuln, SHIELD_DURATION);
        this.toast('SHIELD ONLINE');
        break;
      case 'rapid':
        this.rapidTimer = RAPID_DURATION;
        this.toast('RAPID FIRE ENGAGED');
        break;
      case 'spread':
        this.spreadTimer = SPREAD_DURATION;
        this.toast('SPREAD CANNON ONLINE');
        break;
      case 'life':
        this.lives = Math.min(5, this.lives + 1);
        this.toast('HULL REPAIRED — +1 LIFE');
        break;
    }
  }

  _collisions() {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Enemy vs bullets
      let hit = false;
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        const rs = e.radius + b.radius;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rs * rs) {
          this.bullets.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        e.hp -= 1;
        e.flash = 0.08;
        this.spawnParticles(e.x, e.y, e.sentinel ? '#f0c8ff' : '#ffbe3c', e.sentinel ? 6 : 12);
        if (e.hp > 0) {
          audio.hitSmall();
          continue; // sentinel survives, keep going
        }

        this.enemies.splice(i, 1);
        const base = e.sentinel ? SENTINEL_SCORE : SCORE_PER_KILL;

        // Combo streak: kills landed within COMBO_WINDOW stack the multiplier.
        this.combo += 1;
        this.comboTimer = COMBO_WINDOW;
        this.comboMult = Math.min(COMBO_MAX_MULT, 1 + Math.floor(this.combo / COMBO_STEP) * 0.5);
        const gained = Math.round(base * this.comboMult);
        this.score += gained;
        this.killCount += 1;

        this.spawnParticles(e.x, e.y, e.sentinel ? '#c23cff' : '#ffbe3c', e.sentinel ? 30 : 12);
        this.addFloater(
          e.x,
          e.y,
          this.comboMult > 1 ? `+${gained} x${this.comboMult.toFixed(1)}` : `+${gained}`,
          e.sentinel ? '#f0c8ff' : '#ffe9a6',
        );
        if (this.combo > 0 && this.combo % COMBO_STEP === 0) {
          this.toast(`COMBO x${this.comboMult.toFixed(1)}!`);
        }
        audio.explosion();
        this.shake = Math.min(e.sentinel ? 14 : 6, this.shake + (e.sentinel ? 10 : 2));
        continue;
      }

      // Enemy vs player (ignored during the post-hit invulnerability window)
      if (p.invuln <= 0) {
        const rs = e.radius + PLAYER_RADIUS;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rs * rs) {
          if (!e.sentinel) {
            this.enemies.splice(i, 1);
          } else {
            // Sentinels survive a collision but get knocked back to the top
            // so the player isn't chain-hit while respawning.
            e.y = PLAY_TOP - e.radius;
          }
          this.lives--;
          this.combo = 0;
          this.comboMult = 1;
          this.comboTimer = 0;
          this.spawnParticles(p.x, p.y, '#ff4860', 26);
          this.toast('HULL BREACH — LIFE LOST');
          audio.hit();
          this.shake = 16;
          if (this.lives > 0) {
            p.x = BASE_W / 2;
            p.y = PLAY_TOP + (BASE_H - PLAY_TOP) * 0.78;
            p.vx = p.vy = 0;
            p.invuln = 1.4;
          }
        }
      }
    }
  }

  _gameOver() {
    this.state = 'gameover';
    this.newRecord = this.score > 0 && this.score >= this.highScore;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      storage.setHighScore(this.highScore);
    }
    audio.stopMusic();
    this.toast('MISSION FAILED');
  }

  setDifficulty(d) {
    if (!DIFFICULTY[d]) return;
    this.difficulty = d;
    storage.setDifficulty(d);
  }

  setAutofire(v) {
    this.autofire = v;
    storage.setAutofire(v);
  }

  setMuted(v) {
    this.muted = v;
    storage.setMuted(v);
    audio.setMuted(v);
  }
}
