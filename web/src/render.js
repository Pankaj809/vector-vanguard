// render.js — all drawing. Owns the canvas transform and the per-frame UI
// button registry. Contains no game rules.

import { BASE_W, BASE_H, PLAY_TOP, HUD_H, COLORS, DIFFICULTY, RANKS } from './config.js';
import { view } from './view.js';
import { FIRE_BTN } from './input.js';

const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;

export class Renderer {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this._btns = [];

    // Parallax starfield (three depth layers), each star twinkling independently.
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      const layer = i % 3;
      this.stars.push({
        x: Math.random() * BASE_W,
        y: Math.random() * BASE_H,
        speed: 20 + layer * 35,
        size: 0.6 + layer * 0.7,
        alpha: 0.25 + layer * 0.25,
        twinklePhase: Math.random() * TAU,
        twinkleSpeed: 1.2 + Math.random() * 1.8,
      });
    }

    // Earth sits below the playfield's bottom edge — the world the pilot is
    // defending. Its cloud bands slowly rotate for a living, real-place feel.
    this.earth = { cx: BASE_W * 0.5, cy: BASE_H + BASE_H * 0.62, r: BASE_H * 0.72, rot: 0 };
    this.moon = { cx: BASE_W * 0.84, cy: BASE_H * 0.1, r: 26, rot: 0 };
    this.shootingStar = null;
    this._shootingStarTimer = rand(4, 10);

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this._onResize();
  }

  _onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    // Fit the 9:16 logical field inside the screen (letterbox), centered.
    const scale = Math.min(cssW / BASE_W, cssH / BASE_H);
    view.scale = scale;
    view.offX = (cssW - BASE_W * scale) / 2;
    view.offY = (cssH - BASE_H * scale) / 2;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
  }

  // ---- low-level helpers (operate in logical units) ----
  _begin(shakeX = 0, shakeY = 0) {
    const ctx = this.ctx;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); // to device px
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Letterbox background.
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, view.cssW, view.cssH);
    // Into logical space (+ optional screen-shake).
    ctx.translate(view.offX + shakeX, view.offY + shakeY);
    ctx.scale(view.scale, view.scale);
  }

  _text(text, x, y, { size = 20, color = COLORS.text, align = 'left', weight = 400, spacing = 0 } = {}) {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px Roboto, system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Registers + draws a button. Returns nothing; taps are resolved by input.
  _button(id, x, y, w, h, label, { primary = false, size = 22, selected = false } = {}) {
    const ctx = this.ctx;
    const pressed = this.input.pressedButtonId === id;
    const s = pressed ? 0.96 : 1;
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    const accent = COLORS.accent;
    this._roundRect(x, y, w, h, 12);
    ctx.fillStyle = primary || selected ? 'rgba(0,212,255,0.14)' : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = primary || selected ? accent : 'rgba(110,125,145,0.5)';
    ctx.stroke();

    this._text(label, cx, cy + size * 0.34, {
      size,
      color: primary || selected ? accent : COLORS.text,
      align: 'center',
      weight: 600,
      spacing: 1,
    });
    ctx.restore();

    this._btns.push({ id, x, y, w, h });
  }

  // ---- scene ----
  draw(game, dt) {
    const shakeMag = game.shake;
    const sx = shakeMag ? (Math.random() * 2 - 1) * shakeMag : 0;
    const sy = shakeMag ? (Math.random() * 2 - 1) * shakeMag : 0;
    this._begin(sx, sy);
    this._btns = [];

    this._drawBackground(dt, game.state === 'playing');

    if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover') {
      this._drawEntities(game);
    }

    switch (game.state) {
      case 'menu':
        this._drawMenu(game);
        break;
      case 'options':
        this._drawOptions(game);
        break;
      case 'playing':
        this._drawHud(game);
        this._drawTouchControls();
        this._drawToasts(game);
        break;
      case 'paused':
        this._drawHud(game);
        this._drawPause(game);
        break;
      case 'gameover':
        this._drawHud(game);
        this._drawGameOver(game);
        break;
    }

    this.input.setButtons(this._btns);
  }

  _drawBackground(dt, scroll) {
    const ctx = this.ctx;
    // Vertical gradient — deep space.
    const g = ctx.createLinearGradient(0, 0, 0, BASE_H);
    g.addColorStop(0, COLORS.bgGrad);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Soft drifting nebula clouds — pure gradients, no image assets.
    const t = performance.now() / 1000;
    this._nebulaBlob(BASE_W * 0.22 + Math.sin(t * 0.05) * 30, BASE_H * 0.28, 260, 'rgba(90,60,180,0.16)');
    this._nebulaBlob(BASE_W * 0.78 + Math.cos(t * 0.04) * 24, BASE_H * 0.52, 220, 'rgba(0,140,180,0.12)');

    // Moon — small cratered disc, upper-right, drifts very slightly.
    this._drawMoon(dt);

    // Earth — the world being defended, its curved limb visible along the
    // bottom of the playfield with a soft atmosphere glow.
    this._drawEarth(dt, scroll);

    // Faint tactical grid.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let x = 0; x <= BASE_W; x += 45) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BASE_H);
    }
    for (let y = 0; y <= BASE_H; y += 45) {
      ctx.moveTo(0, y);
      ctx.lineTo(BASE_W, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Parallax stars drifting downward, each twinkling on its own phase.
    for (const s of this.stars) {
      if (scroll) {
        s.y += s.speed * dt;
        if (s.y > BASE_H) {
          s.y = 0;
          s.x = Math.random() * BASE_W;
        }
      }
      s.twinklePhase += dt * s.twinkleSpeed;
      const tw = 0.65 + 0.35 * Math.sin(s.twinklePhase);
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillStyle = COLORS.star;
      ctx.fillRect(s.x, s.y, s.size, s.size * 2.2);
    }
    ctx.globalAlpha = 1;

    this._drawShootingStar(dt, scroll);
  }

  _nebulaBlob(x, y, r, color) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  _drawMoon(dt) {
    const ctx = this.ctx;
    const m = this.moon;
    m.rot += dt * 0.02;
    ctx.save();
    ctx.translate(m.cx, m.cy);
    ctx.shadowColor = COLORS.moon;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#aab3c4';
    ctx.beginPath();
    ctx.arc(0, 0, m.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Craters.
    ctx.fillStyle = 'rgba(100,110,130,0.55)';
    [[-8, -6, 5], [7, 3, 4], [-2, 10, 3]].forEach(([cx, cy, cr]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawEarth(dt, scroll) {
    const ctx = this.ctx;
    const e = this.earth;
    if (scroll) e.rot += dt * 0.01;
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.cx, e.cy, e.r, 0, TAU);
    ctx.clip();

    // Ocean base.
    const oceanGrad = ctx.createRadialGradient(
      e.cx - e.r * 0.3,
      e.cy - e.r * 0.9,
      e.r * 0.2,
      e.cx,
      e.cy,
      e.r * 1.3,
    );
    oceanGrad.addColorStop(0, '#1c6fae');
    oceanGrad.addColorStop(1, COLORS.earthOcean);
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(e.cx - e.r, e.cy - e.r, e.r * 2, e.r * 2);

    // Landmasses — soft rotating blobs so the whole planet feels alive.
    ctx.fillStyle = COLORS.earthLand;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) {
      const a = e.rot + (i / 6) * TAU;
      const lx = e.cx + Math.cos(a) * e.r * 0.62;
      const ly = e.cy + Math.sin(a) * e.r * 0.62 * 0.4 - e.r * 0.55;
      const lr = e.r * (0.14 + 0.05 * ((i % 3) - 1));
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr * 1.4, lr, a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cloud bands.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = e.r * 0.03;
    for (let i = 0; i < 4; i++) {
      const cy = e.cy - e.r * (0.85 - i * 0.18);
      ctx.beginPath();
      ctx.ellipse(e.cx + Math.sin(e.rot + i) * 30, cy, e.r * 0.7, e.r * 0.06, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // Atmosphere glow rim along the visible limb.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = COLORS.earthGlow;
    ctx.lineWidth = 6;
    ctx.shadowColor = COLORS.earthGlow;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(e.cx, e.cy, e.r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  _drawShootingStar(dt, scroll) {
    const ctx = this.ctx;
    if (!scroll) return;
    this._shootingStarTimer -= dt;
    if (!this.shootingStar && this._shootingStarTimer <= 0) {
      this.shootingStar = {
        x: rand(0, BASE_W),
        y: rand(-40, BASE_H * 0.3),
        vx: rand(-120, -220),
        vy: rand(260, 360),
        life: 0,
      };
    }
    const s = this.shootingStar;
    if (!s) return;
    s.life += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const fade = Math.min(1, s.life * 4) * Math.max(0, 1 - s.life / 0.8);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.06, s.y - s.vy * 0.06);
    ctx.stroke();
    ctx.restore();
    if (s.life > 0.8 || s.y > BASE_H + 40) {
      this.shootingStar = null;
      this._shootingStarTimer = rand(5, 12);
    }
  }

  _drawEntities(game) {
    const ctx = this.ctx;

    // Particles
    for (const p of game.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Bullets (glow)
    for (const b of game.bullets) {
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius, b.radius * 2.4, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Power-ups (falling collectibles)
    for (const u of game.powerups) this._drawPowerup(u);

    // Enemies (spinning angular hull; sentinels are larger with an HP bar)
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.spin);
      const flashing = e.flash > 0;
      const color = e.sentinel ? COLORS.sentinel : COLORS.enemy;
      ctx.shadowColor = color;
      ctx.shadowBlur = e.sentinel ? 20 : 12;
      ctx.fillStyle = flashing ? '#ffffff' : color;
      ctx.beginPath();
      const r = e.radius;
      if (e.sentinel) {
        // Hexagonal hull reads as "tougher" than the basic diamond grunt.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
      } else {
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = flashing ? color : COLORS.enemyCore;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();

      if (e.sentinel) {
        const bw = r * 2.2;
        const bx = e.x - bw / 2;
        const by = e.y - r - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = COLORS.sentinel;
        ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 5);
      }
    }

    // Player ship — hidden only once fully dead (gameover keeps wreck hidden).
    if (game.state !== 'gameover') this._drawShip(game);
  }

  _drawPowerup(u) {
    const ctx = this.ctx;
    const colorMap = { shield: COLORS.shield, rapid: COLORS.rapid, spread: COLORS.spread, life: COLORS.life };
    const color = colorMap[u.kind] || COLORS.accent;
    ctx.save();
    ctx.translate(u.x, u.y);
    const bob = Math.sin(u.spin * 2) * 2;
    ctx.translate(0, bob);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(8,12,22,0.75)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = '700 16px Roboto, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { shield: 'S', rapid: 'R', spread: '»', life: '+' }[u.kind] || '?';
    ctx.fillText(glyph, 0, 1);
    ctx.restore();
  }

  _drawShip(game) {
    const ctx = this.ctx;
    const p = game.player;
    // Blink during invulnerability.
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;

    const r = 18;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Shield bubble while a shield power-up is active.
    if (game.shieldTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(performance.now() / 90);
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Thruster flame (flickers)
    const flame = 10 + Math.random() * 8;
    ctx.fillStyle = 'rgba(255,190,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(-6, r * 0.6);
    ctx.lineTo(0, r * 0.6 + flame);
    ctx.lineTo(6, r * 0.6);
    ctx.closePath();
    ctx.fill();

    // Hull (triangle pointing up)
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, r * 0.8);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.85, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---- HUD ----
  _drawHud(game) {
    const ctx = this.ctx;
    this._roundRect(8, 10, BASE_W - 16, HUD_H - 14, 14);
    ctx.fillStyle = 'rgba(14,20,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this._text('SCORE', 24, 36, { size: 12, color: COLORS.dim, weight: 600, spacing: 2 });
    this._text(String(game.score), 24, 66, { size: 30, color: COLORS.text, weight: 700 });

    this._text('BEST', BASE_W / 2, 36, { size: 12, color: COLORS.dim, weight: 600, spacing: 2, align: 'center' });
    this._text(String(game.highScore), BASE_W / 2, 66, { size: 22, color: COLORS.warn, weight: 700, align: 'center' });

    // Lives as small ship icons.
    this._text('LIVES', BASE_W - 150, 36, { size: 12, color: COLORS.dim, weight: 600, spacing: 2 });
    for (let i = 0; i < game.lives; i++) {
      const lx = BASE_W - 150 + i * 22;
      ctx.save();
      ctx.translate(lx + 8, 58);
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 7);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Pause button (top-right).
    this._button('pause', BASE_W - 62, 20, 44, 44, '', {});
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(BASE_W - 62 + 15, 32, 5, 20);
    ctx.fillRect(BASE_W - 62 + 24, 32, 5, 20);

    // Slim status strip — current rank + active buff timers.
    const bits = [game.rank];
    if (game.shieldTimer > 0) bits.push(`SHIELD ${Math.ceil(game.shieldTimer)}s`);
    if (game.rapidTimer > 0) bits.push(`RAPID ${Math.ceil(game.rapidTimer)}s`);
    if (game.spreadTimer > 0) bits.push(`SPREAD ${Math.ceil(game.spreadTimer)}s`);
    this._text(bits.join('   ·   '), 24, 84, { size: 10, color: COLORS.dim, weight: 600, spacing: 1 });

    this._drawComboBadge(game);
  }

  _drawComboBadge(game) {
    if (game.comboMult <= 1 || game.comboTimer <= 0) return;
    const ctx = this.ctx;
    const pulse = 1 + 0.06 * Math.sin(performance.now() / 70);
    ctx.save();
    ctx.translate(BASE_W / 2, PLAY_TOP + 16);
    ctx.scale(pulse, pulse);
    this._text(`COMBO x${game.comboMult.toFixed(1)}`, 0, 0, {
      size: 18,
      color: COLORS.warn,
      align: 'center',
      weight: 800,
      spacing: 1,
    });
    ctx.restore();
  }

  _drawTouchControls() {
    const ctx = this.ctx;
    const joy = this.input.joystick;

    // Joystick (only while engaged).
    if (joy.active) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(joy.baseX, joy.baseY, 72, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,212,255,0.35)';
      ctx.beginPath();
      ctx.arc(joy.curX, joy.curY, 30, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Fire button.
    const f = FIRE_BTN;
    const pressed = this.input.intent.firing;
    ctx.globalAlpha = pressed ? 0.55 : 0.32;
    ctx.fillStyle = COLORS.danger;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = COLORS.danger;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    this._text('FIRE', f.x, f.y + 6, { size: 18, color: '#fff', align: 'center', weight: 700, spacing: 1 });
  }

  _drawToasts(game) {
    let y = PLAY_TOP + 44;
    for (const t of game.toasts) {
      const a = Math.min(1, t.life);
      this.ctx.globalAlpha = a;
      this._text(t.msg, BASE_W / 2, y, { size: 14, color: COLORS.dim, align: 'center', weight: 600, spacing: 1 });
      this.ctx.globalAlpha = 1;
      y += 20;
    }
    // Floating score popups.
    for (const f of game.floaters) {
      this.ctx.globalAlpha = Math.max(0, f.life / f.max);
      this._text(f.text, f.x, f.y, { size: 18, color: f.color, align: 'center', weight: 700 });
      this.ctx.globalAlpha = 1;
    }
  }

  // ---- full-screen overlays ----
  _dim(alpha = 0.72) {
    this.ctx.fillStyle = `rgba(6,9,16,${alpha})`;
    this.ctx.fillRect(0, 0, BASE_W, BASE_H);
  }

  _title(y) {
    this._text('VECTOR', BASE_W / 2, y, { size: 52, color: COLORS.accent, align: 'center', weight: 800, spacing: 4 });
    this._text('VANGUARD', BASE_W / 2, y + 56, { size: 52, color: COLORS.text, align: 'center', weight: 800, spacing: 4 });
  }

  _drawMenu(game) {
    this._dim(0.55);
    this._title(220);
    this._text('ARCADE SURVIVAL SHOOTER', BASE_W / 2, 300, { size: 14, color: COLORS.dim, align: 'center', weight: 600, spacing: 3 });

    this._button('start', BASE_W / 2 - 150, 400, 300, 64, 'START MISSION', { primary: true, size: 24 });
    this._button('options', BASE_W / 2 - 150, 484, 300, 58, 'OPTIONS', { size: 22 });

    this._text(`DIFFICULTY: ${DIFFICULTY[game.difficulty].label}`, BASE_W / 2, 590, { size: 14, color: COLORS.dim, align: 'center', weight: 600, spacing: 1 });

    this._soundToggle(game, BASE_W / 2 - 90, 640);
    this._text('HIGH SCORE  ' + game.highScore, BASE_W / 2, 726, { size: 16, color: COLORS.warn, align: 'center', weight: 700 });
    this._text(`CAREER RANK — ${game.highScoreRank}`, BASE_W / 2, 752, { size: 13, color: COLORS.accent, align: 'center', weight: 700, spacing: 1 });
    this._text('© Code Pariwar Pvt. Ltd.', BASE_W / 2, BASE_H - 40, { size: 12, color: COLORS.dim, align: 'center', spacing: 1 });
  }

  _drawOptions(game) {
    this._dim();
    this._text('OPTIONS', BASE_W / 2, 180, { size: 34, color: COLORS.text, align: 'center', weight: 800, spacing: 3 });
    this._text('DIFFICULTY', BASE_W / 2, 250, { size: 14, color: COLORS.accent, align: 'center', weight: 700, spacing: 2 });

    this._button('diff-easy', BASE_W / 2 - 150, 280, 300, 52, 'EASY', { selected: game.difficulty === 'easy', size: 20 });
    this._button('diff-normal', BASE_W / 2 - 150, 342, 300, 52, 'NORMAL', { selected: game.difficulty === 'normal', size: 20 });
    this._button('diff-hard', BASE_W / 2 - 150, 404, 300, 52, 'HARD', { selected: game.difficulty === 'hard', size: 20 });

    this._button('toggle-autofire', BASE_W / 2 - 150, 486, 300, 52, `AUTO-FIRE: ${game.autofire ? 'ON' : 'OFF'}`, { selected: game.autofire, size: 20 });
    this._soundToggleButton(game, BASE_W / 2 - 150, 548, 300, 52);

    this._button('back', BASE_W / 2 - 110, 650, 220, 56, 'BACK', { primary: true, size: 22 });
  }

  _drawPause(game) {
    this._dim();
    this._text('PAUSED', BASE_W / 2, 300, { size: 40, color: COLORS.accent, align: 'center', weight: 800, spacing: 4 });
    this._button('resume', BASE_W / 2 - 150, 390, 300, 62, 'RESUME', { primary: true, size: 24 });
    this._button('restart', BASE_W / 2 - 150, 466, 300, 54, 'RESTART', { size: 20 });
    this._soundToggleButton(game, BASE_W / 2 - 150, 530, 300, 54);
    this._button('quit', BASE_W / 2 - 150, 594, 300, 54, 'QUIT TO MENU', { size: 20 });
  }

  _drawGameOver(game) {
    this._dim();
    this._text('MISSION FAILED', BASE_W / 2, 280, { size: 36, color: COLORS.danger, align: 'center', weight: 800, spacing: 2 });
    this._text('FINAL SCORE', BASE_W / 2, 360, { size: 14, color: COLORS.dim, align: 'center', weight: 600, spacing: 2 });
    this._text(String(game.score), BASE_W / 2, 404, { size: 44, color: COLORS.text, align: 'center', weight: 800 });

    this._text('HIGH SCORE  ' + game.highScore, BASE_W / 2, 456, {
      size: 18,
      color: game.newRecord ? COLORS.warn : COLORS.dim,
      align: 'center',
      weight: 700,
    });
    if (game.newRecord) {
      this._text('★ NEW RECORD ★', BASE_W / 2, 488, { size: 16, color: COLORS.warn, align: 'center', weight: 700, spacing: 2 });
    }

    this._text(`RANK ACHIEVED — ${game.rank}`, BASE_W / 2, 516, { size: 14, color: COLORS.accent, align: 'center', weight: 700, spacing: 1 });
    this._text(`${game.killCount} HOSTILES DESTROYED`, BASE_W / 2, 538, { size: 12, color: COLORS.dim, align: 'center', weight: 600, spacing: 1 });

    this._button('retry', BASE_W / 2 - 150, 570, 300, 58, 'RETRY', { primary: true, size: 24 });
    this._button('menu', BASE_W / 2 - 150, 638, 300, 52, 'MAIN MENU', { size: 20 });
  }

  _soundToggle(game, x, y) {
    // Compact icon-style toggle used on the menu.
    this._button('toggle-sound', x, y, 180, 48, `SOUND: ${game.muted ? 'OFF' : 'ON'}`, { selected: !game.muted, size: 18 });
  }

  _soundToggleButton(game, x, y, w, h) {
    this._button('toggle-sound', x, y, w, h, `SOUND: ${game.muted ? 'OFF' : 'ON'}`, { selected: !game.muted, size: 20 });
  }
}
