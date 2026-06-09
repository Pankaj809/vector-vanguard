# Requirements — Vector Vanguard

## Build Tools

| Dependency | Minimum | Purpose |
|------------|---------|---------|
| CMake | 3.10 | Build system |
| GCC or Clang | C99 | Compiler |
| pkg-config | any | Locate SDL2 libraries |

## Runtime Libraries

| Library | Purpose |
|---------|---------|
| SDL2 | Window, renderer, input, timing |
| SDL2_mixer | Sound effects and background music |
| SDL2_ttf | UI text rendering |

## Platform Install

### macOS (Homebrew)

```bash
brew install cmake sdl2 sdl2_mixer sdl2_ttf pkg-config
```

Apple Silicon note: Homebrew installs to `/opt/homebrew`. CMakeLists.txt already checks that path.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y build-essential cmake pkg-config \
  libsdl2-dev libsdl2-mixer-dev libsdl2-ttf-dev
```

### Fedora

```bash
sudo dnf install cmake gcc SDL2-devel SDL2_mixer-devel SDL2_ttf-devel pkgconfig
```

### Arch Linux

```bash
sudo pacman -S cmake gcc sdl2 sdl2_mixer sdl2_ttf pkgconf
```

## Bundled Assets

These ship in `assets/` and are copied beside the binary on build:

| File | Required |
|------|----------|
| `Roboto-Regular.ttf` | Yes — all UI text |
| `shoot.wav` | Yes — fire SFX |
| `explosion.wav` | Yes — hit SFX |
| `welcome.wav` | Yes — boot chime |
| `music.wav` | Yes — background music loop |

## Verify Installation

```bash
pkg-config --modversion sdl2 SDL2_mixer SDL2_ttf
```

All three should print a version number without errors.

## Troubleshooting

**`library 'SDL2' not found` (macOS)**  
Re-run cmake from a clean build folder after installing SDL2:

```bash
rm -rf build && mkdir build && cd build && cmake .. && make
```

**No text on screen**  
Confirm `assets/Roboto-Regular.ttf` exists. Rebuild so the post-build asset copy runs.

**No audio**  
Check system volume. The game continues without audio if SDL_mixer fails to init.

**Game won't start from wrong directory**  
Always run `./vanguard` from `build/` or use `./run.sh` from the project root. Assets resolve relative to the executable.
