# vector-vanguard

A single-player arcade survival shooter built in **C99** and **SDL2**. Pilot your ship, destroy incoming hostiles, and chase the high score.

![Resolution](https://img.shields.io/badge/resolution-1024x768-blue)
![Language](https://img.shields.io/badge/language-C99-orange)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)

## Features

- Deterministic fixed-timestep physics loop (60 FPS)
- Procedural vector-style playfield with tactical grid
- Live combat log sidebar with in-game instructions
- Difficulty modes: Easy, Normal, Hard
- SFX + looping background music
- Persistent high score saved locally

## Quick Start

```bash
git clone https://github.com/Pankaj809/vector-vanguard.git
cd vector-vanguard
./run.sh
```

`run.sh` configures CMake, builds the game, and launches it.

## Manual Build

```bash
mkdir -p build && cd build
cmake ..
make
./vanguard
```

Assets are copied next to the binary automatically during build.

## Controls

| Action | Keys |
|--------|------|
| Move | `WASD` or Arrow Keys |
| Fire | `Space` or Left `Ctrl` |
| Menu navigate | `Up` / `Down` |
| Select / Confirm | `Enter` |
| Back | `Esc` |

## Standalone Package

Ship a portable folder you can share with others:

```bash
./package.sh
./dist/VectorVanguard/run.sh
```

## Requirements

See [REQUIREMENTS.md](REQUIREMENTS.md) for full platform setup.

**Minimum:**

| Tool | Version |
|------|---------|
| CMake | 3.10+ |
| C compiler | C99 (GCC or Clang) |
| SDL2 | 2.x |
| SDL2_mixer | 2.x |
| SDL2_ttf | 2.x |

**macOS (Homebrew):**

```bash
brew install cmake sdl2 sdl2_mixer sdl2_ttf pkg-config
```

**Ubuntu / Debian:**

```bash
sudo apt update
sudo apt install build-essential cmake pkg-config \
  libsdl2-dev libsdl2-mixer-dev libsdl2-ttf-dev
```

## Project Structure

```
vector-vanguard/
├── assets/          # Font and audio (bundled on build)
├── include/         # vanguard.h — shared structs and API
├── src/
│   ├── main.c       # Game loop
│   ├── system.c     # SDL init, assets, high score I/O
│   ├── input.c      # Keyboard and menu input
│   ├── game.c       # Physics, collision, spawning
│   └── render.c     # UI and drawing
├── CMakeLists.txt
├── run.sh           # Build + run
└── package.sh       # Create dist bundle
```

## Architecture

The engine uses a single `GameModel` struct passed by reference to discrete modules:

- **system** — platform init, asset loading, save/load
- **input** — event handling and player controls
- **game** — simulation and game rules
- **render** — drawing only (no game logic)

## License

MIT — feel free to use, modify, and share.
