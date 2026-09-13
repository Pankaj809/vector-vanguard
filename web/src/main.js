// main.js — bootstraps the game: wires input/audio/render to the sim, runs the
// fixed-timestep loop, and integrates Android lifecycle + back button when
// running inside Capacitor (all Capacitor access is optional/guarded).

import { TIME_STEP, MAX_FRAME_DT } from './config.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { InputManager } from './input.js';
import { audio } from './audio.js';

const canvas = document.getElementById('game');
const game = new Game();
const input = new InputManager(canvas);
const renderer = new Renderer(canvas, input);

// Apply persisted mute preference before any sound plays.
audio.setMuted(game.muted);

// ---- state helpers ----
function goPlaying() {
  game.startMatch();
  audio.startMusic();
  syncInputMode();
}
function goMenu() {
  game.state = 'menu';
  audio.stopMusic();
  syncInputMode();
}
function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  audio.stopMusic();
  audio.suspend();
  syncInputMode();
}
function resume() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  audio.resume();
  audio.startMusic();
  syncInputMode();
}
function syncInputMode() {
  input.setPlaying(game.state === 'playing');
}

// ---- action dispatch (ids come from render's buttons + keyboard) ----
input.onAction = (id) => {
  audio.unlock();
  if (id !== 'toggle-sound') audio.click();

  switch (id) {
    // menu
    case 'start':
      goPlaying();
      break;
    case 'options':
      game.state = 'options';
      break;

    // options / pause difficulty + toggles
    case 'diff-easy':
      game.setDifficulty('easy');
      break;
    case 'diff-normal':
      game.setDifficulty('normal');
      break;
    case 'diff-hard':
      game.setDifficulty('hard');
      break;
    case 'toggle-autofire':
      game.setAutofire(!game.autofire);
      break;
    case 'toggle-sound':
      game.setMuted(!game.muted);
      if (!game.muted) audio.click();
      break;

    // in-game
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'restart':
      goPlaying();
      break;
    case 'quit':
      goMenu();
      break;
    case 'retry':
      goPlaying();
      break;
    case 'menu':
      goMenu();
      break;

    // keyboard generics
    case 'confirm':
      if (game.state === 'menu') goPlaying();
      else if (game.state === 'gameover') goPlaying();
      else if (game.state === 'options') game.state = 'menu';
      else if (game.state === 'paused') resume();
      break;
    case 'back':
      handleBack();
      break;
    case 'pause-toggle':
      if (game.state === 'playing') pause();
      else if (game.state === 'paused') resume();
      break;
    default:
      break;
  }
};

function handleBack() {
  switch (game.state) {
    case 'playing':
      pause();
      return true;
    case 'paused':
      resume();
      return true;
    case 'options':
    case 'gameover':
      goMenu();
      return true;
    case 'menu':
    default:
      return false; // allow the OS to exit the app
  }
}

// ---- unlock audio on the very first user interaction ----
function firstGesture() {
  audio.unlock();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
}
window.addEventListener('pointerdown', firstGesture);
window.addEventListener('keydown', firstGesture);

// Auto-pause when the tab/app is backgrounded.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pause();
});

// ---- Capacitor integration (no-op in a plain browser) ----
async function initNative() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      // If we can't handle it in-game, leave the app.
      if (!handleBack()) App.exitApp();
    });
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && game.state === 'playing') pause();
    });
  } catch {
    /* plugin not installed — fine for web builds */
  }
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    StatusBar.setStyle({ style: Style.Dark });
    StatusBar.setOverlaysWebView({ overlay: false });
    StatusBar.setBackgroundColor({ color: '#080c16' });
  } catch {
    /* optional */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* optional */
  }
}
initNative();

// ---- fixed-timestep main loop (ported from main.c) ----
let prev = performance.now();
let accumulator = 0;

function frame(now) {
  let dt = (now - prev) / 1000;
  prev = now;
  if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT; // clamp to avoid the spiral of death

  accumulator += dt;
  while (accumulator >= TIME_STEP) {
    game.update(TIME_STEP, input.intent);
    accumulator -= TIME_STEP;
  }

  renderer.draw(game, dt);
  requestAnimationFrame(frame);
}

// Make sure fonts are ready so the first frame isn't un-styled text.
const start = () => requestAnimationFrame((t) => {
  prev = t;
  frame(t);
});
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(start).catch(start);
} else {
  start();
}
