# Vector Vanguard — 5-Minute Presentation

## Files

| File | Description |
|------|-------------|
| `vector-vanguard.tex` | LaTeX Beamer source (10 slides) |
| `vector-vanguard.pdf` | Compiled Beamer slides (recommended for presenting) |
| `vector-vanguard.pptx` | PowerPoint version (editable in Keynote/PowerPoint) |
| `build_presentation.sh` | Rebuild PDF + PPTX |

## Rebuild

```bash
cd docs/presentation
./build_presentation.sh
```

Requires: `pdflatex`, Python 3 (venv created automatically for `python-pptx`).

## 5-Minute Talk Track (~30s per slide)

1. **Title** — Introduce project and GitHub link
2. **What Is It?** — Arcade shooter in plain English
3. **How to Play** — Controls and goal (3 lives, high score)
4. **Game Flow** — Menu → Options → Play → Game Over
5. **MVC Pattern** — Model / View / Controller diagram
6. **GameModel** — Single struct holds all state
7. **View vs Controller** — render.c vs input.c separation
8. **Game Logic** — Spawn, chase, shoot, collide, respawn
9. **Engineering** — Fixed timestep, CMake, deploy scripts
10. **Demo** — Clone repo, run `./run.sh`, Q&A
