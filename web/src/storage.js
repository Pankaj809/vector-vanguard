// storage.js — tiny persistence wrapper.
// Uses localStorage, which works both in the browser and inside the Capacitor
// Android WebView. Every access is guarded so a storage failure never crashes
// the game (private-mode / quota / WebView quirks).

import { STORAGE_KEYS } from './config.js';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore — persistence is best-effort */
  }
}

export const storage = {
  getHighScore() {
    const n = parseInt(read(STORAGE_KEYS.highScore, '0'), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  setHighScore(n) {
    write(STORAGE_KEYS.highScore, Math.max(0, Math.floor(n)));
  },
  getDifficulty() {
    return read(STORAGE_KEYS.difficulty, 'normal');
  },
  setDifficulty(d) {
    write(STORAGE_KEYS.difficulty, d);
  },
  getMuted() {
    return read(STORAGE_KEYS.muted, '0') === '1';
  },
  setMuted(m) {
    write(STORAGE_KEYS.muted, m ? '1' : '0');
  },
  getAutofire() {
    return read(STORAGE_KEYS.autofire, '0') === '1';
  },
  setAutofire(a) {
    write(STORAGE_KEYS.autofire, a ? '1' : '0');
  },
};
