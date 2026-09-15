# Play Store graphics

Generated from the composite artwork supplied on 2026-09-15
(`VECTOR VANGUARD — BLAST · SURVIVE · CONQUER`, 1254×1254).

| Asset | File | Size | Source |
|---|---|---|---|
| App icon | `icon-512.png` | 512×512 | composite, x16–380 y57–449, inset 16px, corners inpainted |
| Feature graphic | `feature-graphic.png` | 1024×500 | composite, x391–1243 y54–477, cropped to 2.048 |
| Native icon master | `../icon.png` | 1024×1024 | same crop as app icon |
| Phone screenshots | `screenshots/phone/` | 1080×1920 | real in-game captures |
| 7-inch tablet | `screenshots/tablet-7/` | 1080×1920 | real in-game captures |
| 10-inch tablet | `screenshots/tablet-10/` | 1200×2133 | real captures, upscaled to clear the 1080 minimum |

The previous vector-art icon and feature graphic are kept in `legacy/`.

## Why the composite's bottom panels were not used as screenshots

The supplied composite has five game-screen panels along the bottom. They are
**not** used, for two reasons:

1. **They are truncated.** In the source they occupy y495–769 — only 275px tall
   — and the image is solid black below y769. Each panel is cut off partway
   down, so no valid 16:9 or 9:16 screenshot can be cropped from them.
2. **They do not depict this app.** The panels are photorealistic concept art
   (detailed enemy craft, a boss, an upgrade tree, a hangar). The actual game
   renders flat vector geometry — see `screenshots/phone/2-gameplay.png`.
   Play's metadata policy requires screenshots to show the real in-app
   experience; mismatched art risks rejection or removal.

Promotional artwork is held to a different standard, which is why the same
composite is fine as the icon and feature graphic.

## Still worth doing

- Only **3** screenshots exist. Play wants ≥2, but ≥4 (with ≥3 at 1080px+)
  to be eligible for promotion. A fourth real capture would help.
- Tablet sets are the phone captures at tablet-legal dimensions. Genuine
  tablet-layout captures would present better on large screens.
