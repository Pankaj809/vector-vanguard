// input.js — touch-first controls with a desktop keyboard fallback.
//
// While playing:
//   * A floating virtual joystick appears wherever the player first touches the
//     left/movement zone and drives analog movement.
//   * A dedicated fire button (bottom-right) holds-to-fire.
//   * The HUD pause button is a normal UI button.
// In menus / pause / game-over: taps are hit-tested against UI buttons that
// render.js registers each frame via setButtons().

import { BASE_W, BASE_H } from './config.js';
import { screenToLogical, view } from './view.js';

const JOY_MAX = 72; // logical radius at which movement is full-speed

export const FIRE_BTN = { x: BASE_W - 74, y: BASE_H - 96, r: 58 };

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.intent = { moveX: 0, moveY: 0, firing: false };
    this.buttons = []; // [{id,x,y,w,h}] in logical coords, set by render each frame
    this.onAction = () => {};
    this.pressedButtonId = null;

    this.joystick = { active: false, baseX: 0, baseY: 0, curX: 0, curY: 0 };

    // pointerId -> { role: 'joystick'|'fire'|'ui', buttonId? }
    this._pointers = new Map();
    this._keys = new Set();

    this._bind();
  }

  setButtons(list) {
    this.buttons = list;
  }

  _hitButton(lx, ly) {
    // Iterate last-registered-first so topmost buttons win.
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return b;
    }
    return null;
  }

  _inFireButton(lx, ly) {
    return (lx - FIRE_BTN.x) ** 2 + (ly - FIRE_BTN.y) ** 2 <= FIRE_BTN.r * FIRE_BTN.r;
  }

  _bind() {
    const c = this.canvas;
    const opts = { passive: false };

    c.addEventListener('pointerdown', (e) => this._onDown(e), opts);
    c.addEventListener('pointermove', (e) => this._onMove(e), opts);
    c.addEventListener('pointerup', (e) => this._onUp(e), opts);
    c.addEventListener('pointercancel', (e) => this._onUp(e), opts);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
  }

  // The "gameplay" flag tells input whether the sim is live (joystick/fire) or
  // we're in a menu-like state (button taps only).
  setPlaying(isPlaying) {
    this._playing = isPlaying;
    if (!isPlaying) {
      this.intent.moveX = this.intent.moveY = 0;
      this.intent.firing = false;
      this.joystick.active = false;
    }
  }

  _localXY(e) {
    const rect = this.canvas.getBoundingClientRect();
    return screenToLogical(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    const { x: lx, y: ly } = this._localXY(e);

    // UI buttons take priority in every state (pause button exists mid-game).
    const btn = this._hitButton(lx, ly);
    if (btn) {
      this._pointers.set(e.pointerId, { role: 'ui', buttonId: btn.id });
      this.pressedButtonId = btn.id;
      return;
    }

    if (!this._playing) return;

    if (this._inFireButton(lx, ly)) {
      this._pointers.set(e.pointerId, { role: 'fire' });
      this.intent.firing = true;
      return;
    }

    // Otherwise start/relocate the movement joystick.
    this._pointers.set(e.pointerId, { role: 'joystick' });
    this.joystick.active = true;
    this.joystick.baseX = lx;
    this.joystick.baseY = ly;
    this.joystick.curX = lx;
    this.joystick.curY = ly;
    this._updateJoyIntent();
  }

  _onMove(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x: lx, y: ly } = this._localXY(e);

    if (p.role === 'joystick') {
      this.joystick.curX = lx;
      this.joystick.curY = ly;
      this._updateJoyIntent();
    } else if (p.role === 'ui') {
      // Cancel the press if the finger slides off the button.
      const btn = this.buttons.find((b) => b.id === p.buttonId);
      const stillOn =
        btn && lx >= btn.x && lx <= btn.x + btn.w && ly >= btn.y && ly <= btn.y + btn.h;
      this.pressedButtonId = stillOn ? p.buttonId : null;
    }
  }

  _onUp(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this._pointers.delete(e.pointerId);

    if (p.role === 'joystick') {
      this.joystick.active = false;
      this.intent.moveX = 0;
      this.intent.moveY = 0;
    } else if (p.role === 'fire') {
      // Only clear firing if no other fire pointer remains.
      const anotherFire = [...this._pointers.values()].some((x) => x.role === 'fire');
      if (!anotherFire) this.intent.firing = false;
    } else if (p.role === 'ui') {
      const { x: lx, y: ly } = this._localXY(e);
      const btn = this._hitButton(lx, ly);
      if (btn && btn.id === p.buttonId) this.onAction(btn.id);
      this.pressedButtonId = null;
    }
  }

  _updateJoyIntent() {
    let dx = this.joystick.curX - this.joystick.baseX;
    let dy = this.joystick.curY - this.joystick.baseY;
    const mag = Math.hypot(dx, dy);
    if (mag > JOY_MAX) {
      dx = (dx / mag) * JOY_MAX;
      dy = (dy / mag) * JOY_MAX;
      // Clamp the visible knob so it never flies past the ring.
      this.joystick.curX = this.joystick.baseX + dx;
      this.joystick.curY = this.joystick.baseY + dy;
    }
    this.intent.moveX = dx / JOY_MAX;
    this.intent.moveY = dy / JOY_MAX;
  }

  _onKey(e, down) {
    const k = e.key.toLowerCase();
    if (down) this._keys.add(k);
    else this._keys.delete(k);

    // Menu navigation / confirm / back for desktop and hardware keyboards.
    if (down) {
      if (k === 'enter' || k === ' ') {
        if (!this._playing) this.onAction('confirm');
      }
      if (k === 'escape' || k === 'backspace') this.onAction('back');
      if (k === 'arrowup' || k === 'w') this.onAction('nav-up');
      if (k === 'arrowdown' || k === 's') this.onAction('nav-down');
      if (k === 'p') this.onAction('pause-toggle');
    }

    if (this._playing) this._applyKeyIntent();
  }

  _applyKeyIntent() {
    const kx =
      (this._keys.has('arrowright') || this._keys.has('d') ? 1 : 0) -
      (this._keys.has('arrowleft') || this._keys.has('a') ? 1 : 0);
    const ky =
      (this._keys.has('arrowdown') || this._keys.has('s') ? 1 : 0) -
      (this._keys.has('arrowup') || this._keys.has('w') ? 1 : 0);
    // Don't override an active touch joystick.
    if (!this.joystick.active) {
      this.intent.moveX = kx;
      this.intent.moveY = ky;
    }
    this.intent.firing =
      this.joystick.active || [...this._pointers.values()].some((p) => p.role === 'fire')
        ? this.intent.firing
        : this._keys.has(' ') || this._keys.has('control');
  }
}
