#include "../include/vanguard.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

/* Palette — dark arcade, single accent */
#define COL_BG_R      8
#define COL_BG_G      12
#define COL_BG_B      22
#define COL_PANEL_R  14
#define COL_PANEL_G  20
#define COL_PANEL_B  36
#define COL_GRID_R   24
#define COL_GRID_G   36
#define COL_GRID_B   58
#define COL_ACCENT_R  0
#define COL_ACCENT_G 212
#define COL_ACCENT_B 255
#define COL_TEXT_R  210
#define COL_TEXT_G  218
#define COL_TEXT_B  230
#define COL_DIM_R   110
#define COL_DIM_G   125
#define COL_DIM_B   145
#define COL_WARN_R  255
#define COL_WARN_G  190
#define COL_WARN_B   60
#define COL_DANGER_R 255
#define COL_DANGER_G  72
#define COL_DANGER_B  96

static SDL_Color col_accent(void)  { return (SDL_Color){COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 255}; }
static SDL_Color col_text(void)    { return (SDL_Color){COL_TEXT_R, COL_TEXT_G, COL_TEXT_B, 255}; }
static SDL_Color col_dim(void)     { return (SDL_Color){COL_DIM_R, COL_DIM_G, COL_DIM_B, 255}; }
static SDL_Color col_warn(void)    { return (SDL_Color){COL_WARN_R, COL_WARN_G, COL_WARN_B, 255}; }
static SDL_Color col_danger(void)  { return (SDL_Color){COL_DANGER_R, COL_DANGER_G, COL_DANGER_B, 255}; }

static void fill_rect(SDL_Renderer* ren, int x, int y, int w, int h, Uint8 r, Uint8 g, Uint8 b, Uint8 a) {
    SDL_SetRenderDrawBlendMode(ren, a < 255 ? SDL_BLENDMODE_BLEND : SDL_BLENDMODE_NONE);
    SDL_SetRenderDrawColor(ren, r, g, b, a);
    SDL_Rect rect = {x, y, w, h};
    SDL_RenderFillRect(ren, &rect);
    SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_NONE);
}

static void draw_text(SDL_Renderer* ren, TTF_Font* font, const char* text, int x, int y, SDL_Color color) {
    if (!font || !text || !text[0]) return;
    SDL_Surface* surf = TTF_RenderText_Blended(font, text, color);
    if (!surf) return;
    SDL_Texture* tex = SDL_CreateTextureFromSurface(ren, surf);
    SDL_Rect dst = {x, y, surf->w, surf->h};
    SDL_RenderCopy(ren, tex, NULL, &dst);
    SDL_FreeSurface(surf);
    SDL_DestroyTexture(tex);
}

static void draw_text_centered(SDL_Renderer* ren, TTF_Font* font, const char* text, int cx, int y, SDL_Color color) {
    if (!font || !text) return;
    int tw = 0, th = 0;
    if (TTF_SizeText(font, text, &tw, &th) != 0) return;
    draw_text(ren, font, text, cx - tw / 2, y, color);
}

static void draw_circle(SDL_Renderer* ren, float cx, float cy, float r, int segments) {
    float step = (2.0f * 3.14159f) / (float)segments;
    for (int i = 0; i < segments; i++) {
        float a1 = i * step, a2 = (i + 1) * step;
        SDL_RenderDrawLine(ren,
            (int)(cx + cosf(a1) * r), (int)(cy + sinf(a1) * r),
            (int)(cx + cosf(a2) * r), (int)(cy + sinf(a2) * r));
    }
}

static void draw_playfield_bg(SDL_Renderer* ren) {
    fill_rect(ren, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, COL_BG_R, COL_BG_G, COL_BG_B, 255);

    /* Subtle vertical gradient in play zone */
    for (int y = PLAY_Y; y < SCREEN_HEIGHT; y++) {
        float t = (float)(y - PLAY_Y) / (float)PLAY_H;
        Uint8 r = (Uint8)(COL_BG_R + t * 6);
        Uint8 g = (Uint8)(COL_BG_G + t * 8);
        Uint8 b = (Uint8)(COL_BG_B + t * 14);
        SDL_SetRenderDrawColor(ren, r, g, b, 255);
        SDL_RenderDrawLine(ren, 0, y, PLAY_W, y);
    }

    /* Tactical grid */
    SDL_SetRenderDrawColor(ren, COL_GRID_R, COL_GRID_G, COL_GRID_B, 255);
    for (int x = 0; x < PLAY_W; x += 48)
        SDL_RenderDrawLine(ren, x, PLAY_Y, x, SCREEN_HEIGHT);
    for (int y = PLAY_Y; y < SCREEN_HEIGHT; y += 48)
        SDL_RenderDrawLine(ren, 0, y, PLAY_W, y);

    /* Arena border glow */
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 80);
    SDL_RenderDrawLine(ren, 0, PLAY_Y, PLAY_W, PLAY_Y);
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 40);
    SDL_RenderDrawLine(ren, PLAY_W - 1, PLAY_Y, PLAY_W - 1, SCREEN_HEIGHT);
}

static void draw_hud_bar(GameModel* model, SDL_Renderer* ren) {
    fill_rect(ren, 0, 0, PLAY_W, HUD_H, COL_PANEL_R, COL_PANEL_G, COL_PANEL_B, 240);
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 100);
    SDL_RenderDrawLine(ren, 0, HUD_H - 1, PLAY_W, HUD_H - 1);

    char buf[64];
    snprintf(buf, sizeof(buf), "SCORE  %d", model->score);
    draw_text(ren, model->font_body, buf, 24, 14, col_text());

    snprintf(buf, sizeof(buf), "LIVES  %d", model->lives);
    draw_text(ren, model->font_body, buf, 220, 14, col_warn());

    const char* diff = "NORMAL";
    if (model->difficulty == DIFF_EASY) diff = "EASY";
    else if (model->difficulty == DIFF_HARD) diff = "HARD";
    snprintf(buf, sizeof(buf), "DIFF  %s", diff);
    draw_text(ren, model->font_body, buf, 400, 14, col_dim());

    snprintf(buf, sizeof(buf), "BEST  %d", model->high_score);
    draw_text(ren, model->font_caption, buf, PLAY_W - 130, 18, col_dim());
}

static void draw_sidebar(GameModel* model, SDL_Renderer* ren) {
    int sx = PLAY_W;

    fill_rect(ren, sx, 0, SIDEBAR_W, SCREEN_HEIGHT, COL_PANEL_R, COL_PANEL_G, COL_PANEL_B, 255);
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 60);
    SDL_RenderDrawLine(ren, sx, 0, sx, SCREEN_HEIGHT);

    draw_text(ren, model->font_caption, "VECTOR VANGUARD", sx + 20, 24, col_accent());
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 50);
    SDL_RenderDrawLine(ren, sx + 16, 52, sx + SIDEBAR_W - 16, 52);

    draw_text(ren, model->font_caption, "CONTROLS", sx + 20, 68, col_dim());
    draw_text(ren, model->font_caption, "Move   WASD / Arrows", sx + 20, 92, col_text());
    draw_text(ren, model->font_caption, "Fire   Space / Ctrl", sx + 20, 112, col_text());
    draw_text(ren, model->font_caption, "Menu   Enter / Esc", sx + 20, 132, col_text());

    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 50);
    SDL_RenderDrawLine(ren, sx + 16, 162, sx + SIDEBAR_W - 16, 162);

    draw_text(ren, model->font_caption, "COMBAT LOG", sx + 20, 178, col_accent());
    for (int i = 0; i < LOG_LINES; i++) {
        if (model->event_log[i][0])
            draw_text(ren, model->font_caption, model->event_log[i], sx + 20, 204 + i * 22, col_dim());
    }

    if (model->current_state == STATE_PLAYING) {
        draw_text(ren, model->font_caption, "OBJECTIVE", sx + 20, SCREEN_HEIGHT - 120, col_dim());
        draw_text(ren, model->font_caption, "Destroy hostiles.", sx + 20, SCREEN_HEIGHT - 98, col_text());
        draw_text(ren, model->font_caption, "Survive. Score high.", sx + 20, SCREEN_HEIGHT - 78, col_text());
    }
}

static void draw_menu_item(SDL_Renderer* ren, TTF_Font* font, const char* label,
                           int cx, int y, bool selected) {
    if (selected) {
        int tw = 0, th = 0;
        TTF_SizeText(font, label, &tw, &th);
        fill_rect(ren, cx - tw / 2 - 20, y - 6, tw + 40, th + 12,
                  COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 30);
        SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 180);
        SDL_Rect frame = {cx - tw / 2 - 20, y - 6, tw + 40, th + 12};
        SDL_RenderDrawRect(ren, &frame);
    }
    draw_text_centered(ren, font, label, cx, y, selected ? col_warn() : col_dim());
}

static void draw_overlay(SDL_Renderer* ren, int x, int y, int w, int h) {
    fill_rect(ren, x, y, w, h, 0, 0, 0, 160);
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 40);
    SDL_Rect border = {x, y, w, h};
    SDL_RenderDrawRect(ren, &border);
}

static const char* difficulty_name(Difficulty d) {
    if (d == DIFF_EASY) return "EASY";
    if (d == DIFF_HARD) return "HARD";
    return "NORMAL";
}

void render_draw(GameModel* model, SDL_Renderer* ren) {
    draw_playfield_bg(ren);
    draw_sidebar(model, ren);

    int center_x = PLAY_W / 2;

    if (model->current_state == STATE_MENU) {
        draw_hud_bar(model, ren);
        draw_overlay(ren, 40, 100, PLAY_W - 80, PLAY_H - 60);

        draw_text_centered(ren, model->font_title, "VECTOR", center_x, 160, col_accent());
        draw_text_centered(ren, model->font_title, "VANGUARD", center_x, 230, col_text());
        draw_text_centered(ren, model->font_body, "Arcade survival shooter", center_x, 310, col_dim());
        draw_text_centered(ren, model->font_caption, "Pilot your ship. Hold the line.", center_x, 345, col_dim());

        draw_menu_item(ren, model->font_heading, "START MISSION", center_x, 430, model->menu_selection == 0);
        draw_menu_item(ren, model->font_heading, "OPTIONS", center_x, 490, model->menu_selection == 1);
        draw_menu_item(ren, model->font_heading, "EXIT", center_x, 550, model->menu_selection == 2);

        draw_text_centered(ren, model->font_caption, "UP / DOWN  to navigate     ENTER  to select",
                           center_x, PLAY_Y + PLAY_H - 50, col_dim());
    }
    else if (model->current_state == STATE_OPTIONS) {
        draw_hud_bar(model, ren);
        draw_overlay(ren, 80, 120, PLAY_W - 160, PLAY_H - 80);

        draw_text_centered(ren, model->font_heading, "OPTIONS", center_x, 170, col_text());
        draw_text_centered(ren, model->font_body, "DIFFICULTY", center_x, 250, col_accent());

        draw_menu_item(ren, model->font_body, "1  —  EASY", center_x, 320, model->difficulty == DIFF_EASY);
        draw_menu_item(ren, model->font_body, "2  —  NORMAL", center_x, 370, model->difficulty == DIFF_NORMAL);
        draw_menu_item(ren, model->font_body, "3  —  HARD", center_x, 420, model->difficulty == DIFF_HARD);

        char buf[48];
        snprintf(buf, sizeof(buf), "Selected: %s", difficulty_name(model->difficulty));
        draw_text_centered(ren, model->font_caption, buf, center_x, 500, col_dim());
        draw_text_centered(ren, model->font_caption, "ENTER or ESC to return", center_x, PLAY_Y + PLAY_H - 50, col_dim());
    }
    else if (model->current_state == STATE_PLAYING) {
        draw_hud_bar(model, ren);

        for (int i = 0; i < MAX_PARTICLES; i++) {
            if (!model->particles[i].active) continue;
            SDL_SetRenderDrawColor(ren, model->particles[i].r, model->particles[i].g, model->particles[i].b, 255);
            SDL_RenderDrawPoint(ren, (int)model->particles[i].pos.x, (int)model->particles[i].pos.y);
        }

        for (int i = 0; i < MAX_ENTITIES; i++) {
            Entity* e = &model->entities[i];
            if (!e->active) continue;

            if (e->type == TYPE_PLAYER) {
                SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 255);
                draw_circle(ren, e->pos.x, e->pos.y, e->radius, 3);
                SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 80);
                draw_circle(ren, e->pos.x, e->pos.y, e->radius + 6.0f, 16);
            } else if (e->type == TYPE_ENEMY) {
                SDL_SetRenderDrawColor(ren, COL_DANGER_R, COL_DANGER_G, COL_DANGER_B, 255);
                draw_circle(ren, e->pos.x, e->pos.y, e->radius, 8);
            } else if (e->type == TYPE_BULLET) {
                SDL_SetRenderDrawColor(ren, COL_WARN_R, COL_WARN_G, COL_WARN_B, 255);
                draw_circle(ren, e->pos.x, e->pos.y, e->radius, 4);
            }
        }
    }
    else if (model->current_state == STATE_GAMEOVER) {
        draw_hud_bar(model, ren);
        draw_overlay(ren, 60, 110, PLAY_W - 120, PLAY_H - 70);

        draw_text_centered(ren, model->font_title, "GAME OVER", center_x, 180, col_danger());
        draw_text_centered(ren, model->font_body, "The sector has fallen.", center_x, 260, col_dim());

        char buf[48];
        snprintf(buf, sizeof(buf), "FINAL SCORE  %d", model->score);
        draw_text_centered(ren, model->font_heading, buf, center_x, 340, col_text());

        snprintf(buf, sizeof(buf), "HIGH SCORE  %d", model->high_score);
        bool record = model->score > 0 && model->score >= model->high_score;
        draw_text_centered(ren, model->font_body, buf, center_x, 400, record ? col_warn() : col_dim());

        if (record)
            draw_text_centered(ren, model->font_caption, "NEW RECORD", center_x, 440, col_warn());

        draw_text_centered(ren, model->font_caption, "Press ENTER to return to menu", center_x, PLAY_Y + PLAY_H - 50, col_dim());
    }

    SDL_RenderPresent(ren);
}
