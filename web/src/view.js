// view.js — shared canvas transform so input can map device pixels to the
// fixed logical playfield. render.js writes it on every resize; input.js reads it.

export const view = {
  scale: 1, // logical -> CSS px
  offX: 0, // letterbox offset (CSS px)
  offY: 0,
  cssW: 0,
  cssH: 0,
  dpr: 1,
  safeTop: 0,
  safeBottom: 0,
};

export function screenToLogical(sx, sy) {
  return { x: (sx - view.offX) / view.scale, y: (sy - view.offY) / view.scale };
}
