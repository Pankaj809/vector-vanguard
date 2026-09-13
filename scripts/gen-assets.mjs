// Rasterizes resources/*.svg into the PWA icons used by web/manifest.webmanifest
// and the 1024/2732 source PNGs consumed by `@capacitor/assets`.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icon = resolve(root, 'resources/icon.svg');
const splash = resolve(root, 'resources/splash.svg');

const out = async (p) => {
  await mkdir(dirname(p), { recursive: true });
  return p;
};

async function png(src, size, dest) {
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: 'contain', background: '#080c16' })
    .png()
    .toFile(await out(resolve(root, dest)));
  console.log('  ✓', dest, `${size}x${size}`);
}

console.log('Generating web icons…');
await png(icon, 192, 'web/icons/icon-192.png');
await png(icon, 512, 'web/icons/icon-512.png');
await png(icon, 512, 'web/icons/icon-maskable-512.png');

console.log('Generating @capacitor/assets sources…');
await png(icon, 1024, 'resources/icon.png');
await sharp(splash, { density: 192 })
  .resize(2732, 2732, { fit: 'contain', background: '#080c16' })
  .png()
  .toFile(await out(resolve(root, 'resources/splash.png')));
console.log('  ✓ resources/splash.png 2732x2732');
// Dark-mode splash is identical (the art is already dark).
await sharp(splash, { density: 192 })
  .resize(2732, 2732, { fit: 'contain', background: '#080c16' })
  .png()
  .toFile(await out(resolve(root, 'resources/splash-dark.png')));
console.log('  ✓ resources/splash-dark.png 2732x2732');
console.log('Done.');
