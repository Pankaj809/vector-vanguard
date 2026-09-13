#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> Compiling Beamer PDF..."
pdflatex -interaction=nonstopmode vector-vanguard.tex >/dev/null
pdflatex -interaction=nonstopmode vector-vanguard.tex >/dev/null

echo "==> Building PPTX..."
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install python-pptx -q
fi
.venv/bin/python3 << 'PYEOF'
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
TITLE = prs.slide_layouts[0]
SECTION = prs.slide_layouts[2]

ACCENT = RGBColor(0, 212, 255)
DARK = RGBColor(14, 20, 36)
TEXT = RGBColor(40, 44, 52)

def fill_bg(slide, rgb=DARK):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = rgb

def add_title(slide, title, subtitle=None):
    box = slide.shapes.add_textbox(Inches(0.6), Inches(0.45), Inches(12), Inches(1))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = ACCENT
    if subtitle:
        p2 = tf.add_paragraph()
        p2.text = subtitle
        p2.font.size = Pt(18)
        p2.font.color.rgb = RGBColor(200, 210, 220)

def add_bullets(slide, items, top=1.6, size=20):
    box = slide.shapes.add_textbox(Inches(0.8), Inches(top), Inches(11.5), Inches(5.5))
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = item
        p.level = 0
        p.font.size = Pt(size)
        p.font.color.rgb = TEXT
        p.space_after = Pt(10)

slides = [
    ("title", None, [
        "Vector Vanguard",
        "Arcade Survival Shooter in C + SDL2",
        "github.com/Pankaj809/vector-vanguard",
        "~5 minute presentation",
    ]),
    ("What Is Vector Vanguard?", "In plain English", [
        "You pilot a ship in a grid arena. Red enemies chase you.",
        "Shoot them before they hit you. Survive and score points.",
        "",
        "• Single-player arcade shooter, top-down survival",
        "• 3 difficulty levels (Easy / Normal / Hard)",
        "• Built with C99, SDL2, 1024×768, sound + music + HUD log",
    ]),
    ("How to Play", None, [
        "Move ship .............. WASD or Arrow keys",
        "Fire laser ............. Space or Left Ctrl",
        "Menu navigate .......... Up / Down",
        "Confirm ................ Enter",
        "Go back ................ Esc",
        "",
        "GOAL: Destroy enemies (+10 pts). You have 3 lives.",
        "Beat your high score. Don't let hostiles reach your ship.",
    ]),
    ("Game Flow", None, [
        "Main Menu → Options (pick difficulty)",
        "Main Menu → Start → Playing",
        "Playing → Game Over (when lives = 0)",
        "Game Over → Enter → back to Main Menu",
        "",
        "Easy = slower enemies | Hard = faster spawns",
    ]),
    ("Architecture: MVC Pattern", None, [
        "MODEL (GameModel) — all game state in one struct",
        "VIEW (render.c) — draws screen; never changes rules",
        "CONTROLLER (input.c) — keyboard; never draws pixels",
        "GAME LOGIC (game.c) — physics, collisions, spawning",
        "SYSTEM (system.c) — SDL init, assets, save high score",
        "",
        "main.c loop: Input → Update (60 FPS) → Render",
    ]),
    ("The Model: GameModel", None, [
        "Stores: screen state, score, lives, difficulty",
        "Entities: player, enemies, bullets (up to 512)",
        "Particles, combat log, audio & fonts",
        "",
        "Why one model? Easy to test. No hidden globals.",
        "Memory pool: no malloc during gameplay.",
    ]),
    ("View vs Controller", None, [
        "VIEW (render.c):",
        "  • Grid + HUD, ship/enemies/bullets, menus, combat log",
        "",
        "CONTROLLER (input.c):",
        "  • Keyboard, menu selection, move ship, fire bullets",
        "",
        "Separation keeps code maintainable and exam-friendly.",
    ]),
    ("Game Logic (Simple Terms)", None, [
        "1. Spawn — enemies appear at the top every few seconds",
        "2. Chase — each enemy moves toward your ship",
        "3. Shoot — bullets fly in your last movement direction",
        "4. Hit test — overlap? Enemy dies (+10) or you lose a life",
        "5. Respawn — lives left? Ship returns to center",
        "6. Game Over — save high score to disk",
        "",
        "Fixed 1/60 s physics steps = same speed on every PC.",
    ]),
    ("Engineering Highlights", None, [
        "• MVC modules in separate .c files",
        "• Deterministic accumulator loop in main.c",
        "• Asset pipeline in system.c (font + audio)",
        "• CMake + run.sh — one-command build & play",
        "• package.sh — standalone deploy bundle",
    ]),
    ("Summary & Demo", None, [
        "Vector Vanguard — arcade fun + clean C architecture",
        "",
        "git clone https://github.com/Pankaj809/vector-vanguard.git",
        "./run.sh",
        "",
        "Questions?",
    ]),
]

for i, (title, sub, lines) in enumerate(slides):
    if i == 0:
        slide = prs.slides.add_slide(TITLE)
        fill_bg(slide)
        slide.shapes.title.text = "Vector Vanguard"
        slide.shapes.title.text_frame.paragraphs[0].font.color.rgb = ACCENT
        slide.placeholders[1].text = "Arcade Survival Shooter in C + SDL2\ngithub.com/Pankaj809/vector-vanguard"
    else:
        slide = prs.slides.add_slide(BLANK)
        fill_bg(slide, RGBColor(248, 250, 252) if i % 2 == 0 else RGBColor(255, 255, 255))
        add_title(slide, title, sub)
        add_bullets(slide, lines)

out = "vector-vanguard.pptx"
prs.save(out)
print(f"Saved {out}")
PYEOF

echo "Done."
echo "  PDF  -> $DIR/vector-vanguard.pdf"
echo "  PPTX -> $DIR/vector-vanguard.pptx"
