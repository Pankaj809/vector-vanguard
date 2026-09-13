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

/* Village daytime palette */
#define COL_SKY_TOP_R       90
#define COL_SKY_TOP_G      170
#define COL_SKY_TOP_B      230
#define COL_SKY_HORIZON_R  205
#define COL_SKY_HORIZON_G  228
#define COL_SKY_HORIZON_B  236

#define COL_SUN_R 255
#define COL_SUN_G 221
#define COL_SUN_B 140

#define COL_CLOUD_R 255
#define COL_CLOUD_G 255
#define COL_CLOUD_B 250

#define COL_HILL_FAR_R  118
#define COL_HILL_FAR_G  150
#define COL_HILL_FAR_B  120
#define COL_HILL_NEAR_R  74
#define COL_HILL_NEAR_G 128
#define COL_HILL_NEAR_B  82

#define COL_GRASS_TOP_R  96
#define COL_GRASS_TOP_G 148
#define COL_GRASS_TOP_B  78
#define COL_GRASS_BOT_R  60
#define COL_GRASS_BOT_G 102
#define COL_GRASS_BOT_B  54

#define COL_DIRT_R 150
#define COL_DIRT_G 112
#define COL_DIRT_B  72

#define COL_HOUSE_WALL_R 226
#define COL_HOUSE_WALL_G 198
#define COL_HOUSE_WALL_B 158
#define COL_HOUSE_ROOF_R 168
#define COL_HOUSE_ROOF_G  66
#define COL_HOUSE_ROOF_B  54

#define COL_WINDMILL_BODY_R  200
#define COL_WINDMILL_BODY_G  180
#define COL_WINDMILL_BODY_B  150
#define COL_WINDMILL_BLADE_R 235
#define COL_WINDMILL_BLADE_G 232
#define COL_WINDMILL_BLADE_B 220

#define COL_TREE_TRUNK_R 92
#define COL_TREE_TRUNK_G 62
#define COL_TREE_TRUNK_B 40
#define COL_TREE_LEAF_R  46
#define COL_TREE_LEAF_G 104
#define COL_TREE_LEAF_B  54

#define COL_FENCE_R 150
#define COL_FENCE_G 112
#define COL_FENCE_B  72

#define COL_ROBOT_TORSO_R 108
#define COL_ROBOT_TORSO_G 116
#define COL_ROBOT_TORSO_B 128
#define COL_ROBOT_HEAD_R  162
#define COL_ROBOT_HEAD_G  170
#define COL_ROBOT_HEAD_B  180
#define COL_ROBOT_JOINT_R  72
#define COL_ROBOT_JOINT_G  78
#define COL_ROBOT_JOINT_B  88

#define COL_BIRD_BODY_R 52
#define COL_BIRD_BODY_G 46
#define COL_BIRD_BODY_B 42
#define COL_BIRD_BEAK_R 235
#define COL_BIRD_BEAK_G 150
#define COL_BIRD_BEAK_B  40

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

static void fill_circle_a(SDL_Renderer* ren, float cx, float cy, float r, Uint8 cr, Uint8 cg, Uint8 cb, Uint8 a) {
    SDL_SetRenderDrawBlendMode(ren, a < 255 ? SDL_BLENDMODE_BLEND : SDL_BLENDMODE_NONE);
    SDL_SetRenderDrawColor(ren, cr, cg, cb, a);
    int ir = (int)r;
    for (int dy = -ir; dy <= ir; dy++) {
        int dx = (int)sqrtf((float)(ir * ir - dy * dy));
        SDL_RenderDrawLine(ren, (int)cx - dx, (int)cy + dy, (int)cx + dx, (int)cy + dy);
    }
    SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_NONE);
}

static void draw_tree(SDL_Renderer* ren, int cx, int gy, int size) {
    int trunk_w = size / 4 > 3 ? size / 4 : 3;
    int trunk_h = size;
    fill_rect(ren, cx - trunk_w / 2, gy - trunk_h, trunk_w, trunk_h, COL_TREE_TRUNK_R, COL_TREE_TRUNK_G, COL_TREE_TRUNK_B, 255);

    float top_y = (float)(gy - trunk_h);
    fill_circle_a(ren, cx, top_y - size * 0.5f, size, COL_TREE_LEAF_R, COL_TREE_LEAF_G, COL_TREE_LEAF_B, 255);
    fill_circle_a(ren, cx - size * 0.6f, top_y - size * 0.15f, size * 0.7f, COL_TREE_LEAF_R, COL_TREE_LEAF_G, COL_TREE_LEAF_B, 255);
    fill_circle_a(ren, cx + size * 0.6f, top_y - size * 0.15f, size * 0.7f, COL_TREE_LEAF_R, COL_TREE_LEAF_G, COL_TREE_LEAF_B, 255);
}

static void draw_house(SDL_Renderer* ren, int cx, int gy, int size) {
    int wall_w = size;
    int wall_h = (int)(size * 0.75f);
    int wall_x = cx - wall_w / 2;
    int wall_y = gy - wall_h;
    fill_rect(ren, wall_x, wall_y, wall_w, wall_h, COL_HOUSE_WALL_R, COL_HOUSE_WALL_G, COL_HOUSE_WALL_B, 255);

    int door_w = wall_w / 5, door_h = wall_h / 2;
    fill_rect(ren, cx - door_w / 2, gy - door_h, door_w, door_h, 108, 74, 48, 255);

    fill_rect(ren, wall_x + wall_w / 6, wall_y + wall_h / 4, wall_w / 6, wall_h / 4, 150, 200, 220, 230);

    int roof_h = (int)(size * 0.55f);
    SDL_SetRenderDrawColor(ren, COL_HOUSE_ROOF_R, COL_HOUSE_ROOF_G, COL_HOUSE_ROOF_B, 255);
    for (int i = 0; i <= roof_h; i++) {
        float t = (float)i / (float)roof_h;
        int half_w = (int)((wall_w / 2 + 10) * (1.0f - t));
        int y = wall_y - roof_h + i;
        SDL_RenderDrawLine(ren, cx - half_w, y, cx + half_w, y);
    }

    fill_rect(ren, cx + wall_w / 3, wall_y - roof_h - 14, 10, 24, 120, 90, 70, 255);
}

static void draw_windmill(SDL_Renderer* ren, int cx, int gy, int size, Uint32 ticks) {
    int tower_w = size / 4;
    int tower_h = size;
    fill_rect(ren, cx - tower_w / 2, gy - tower_h, tower_w, tower_h, COL_WINDMILL_BODY_R, COL_WINDMILL_BODY_G, COL_WINDMILL_BODY_B, 255);

    SDL_SetRenderDrawColor(ren, 150, 70, 60, 255);
    for (int i = 0; i < 16; i++) {
        int y = gy - tower_h - i;
        int half_w = (tower_w / 2 + 6) - i / 2;
        if (half_w < 0) half_w = 0;
        SDL_RenderDrawLine(ren, cx - half_w, y, cx + half_w, y);
    }

    int hub_y = gy - tower_h - 4;
    float angle = (float)ticks * 0.0016f;
    float blade_len = size * 0.9f;
    SDL_SetRenderDrawColor(ren, COL_WINDMILL_BLADE_R, COL_WINDMILL_BLADE_G, COL_WINDMILL_BLADE_B, 255);
    for (int b = 0; b < 4; b++) {
        float a = angle + b * (3.14159f / 2.0f);
        float ex = cx + cosf(a) * blade_len;
        float ey = hub_y + sinf(a) * blade_len;
        float perp = a + 3.14159f / 2.0f;
        float wx = ex - cosf(perp) * 8.0f;
        float wy = ey - sinf(perp) * 8.0f;
        SDL_RenderDrawLine(ren, cx, hub_y, (int)ex, (int)ey);
        SDL_RenderDrawLine(ren, cx, hub_y, (int)wx, (int)wy);
        SDL_RenderDrawLine(ren, (int)ex, (int)ey, (int)wx, (int)wy);
    }
    fill_circle_a(ren, cx, hub_y, 5, 90, 70, 60, 255);
}

static void draw_fence(SDL_Renderer* ren, int start_x, int gy, int length) {
    int posts = length / 26;
    SDL_SetRenderDrawColor(ren, COL_FENCE_R, COL_FENCE_G, COL_FENCE_B, 255);
    SDL_RenderDrawLine(ren, start_x, gy - 22, start_x + length, gy - 22);
    SDL_RenderDrawLine(ren, start_x, gy - 12, start_x + length, gy - 12);
    for (int i = 0; i <= posts; i++) {
        int x = start_x + i * 26;
        fill_rect(ren, x - 2, gy - 30, 4, 32, COL_FENCE_R, COL_FENCE_G, COL_FENCE_B, 255);
    }
}

static void draw_village_bg(SDL_Renderer* ren) {
    Uint32 ticks = SDL_GetTicks();
    int horizon_y = PLAY_Y + (int)(PLAY_H * 0.40f);

    /* Sky gradient */
    for (int y = PLAY_Y; y < horizon_y; y++) {
        float t = (float)(y - PLAY_Y) / (float)(horizon_y - PLAY_Y);
        Uint8 r = (Uint8)(COL_SKY_TOP_R + (COL_SKY_HORIZON_R - COL_SKY_TOP_R) * t);
        Uint8 g = (Uint8)(COL_SKY_TOP_G + (COL_SKY_HORIZON_G - COL_SKY_TOP_G) * t);
        Uint8 b = (Uint8)(COL_SKY_TOP_B + (COL_SKY_HORIZON_B - COL_SKY_TOP_B) * t);
        SDL_SetRenderDrawColor(ren, r, g, b, 255);
        SDL_RenderDrawLine(ren, 0, y, PLAY_W, y);
    }

    /* Sun with soft glow */
    int sun_x = PLAY_W - 130, sun_y = PLAY_Y + 70;
    fill_circle_a(ren, sun_x, sun_y, 60, COL_SUN_R, COL_SUN_G, COL_SUN_B, 35);
    fill_circle_a(ren, sun_x, sun_y, 42, COL_SUN_R, COL_SUN_G, COL_SUN_B, 60);
    fill_circle_a(ren, sun_x, sun_y, 26, COL_SUN_R, COL_SUN_G, COL_SUN_B, 255);

    /* Drifting clouds */
    float drift = (float)(ticks % 60000) / 60000.0f;
    int cloud_specs[3][3] = { {90, 40, 26}, {360, 90, 20}, {560, 55, 30} };
    for (int c = 0; c < 3; c++) {
        int cy = cloud_specs[c][1] + PLAY_Y;
        int cr = cloud_specs[c][2];
        float cx = fmodf((float)cloud_specs[c][0] + drift * (PLAY_W + 200.0f), (float)(PLAY_W + 200)) - 100.0f;
        fill_circle_a(ren, cx, cy, cr, COL_CLOUD_R, COL_CLOUD_G, COL_CLOUD_B, 235);
        fill_circle_a(ren, cx + cr * 0.9f, cy + 4, cr * 0.75f, COL_CLOUD_R, COL_CLOUD_G, COL_CLOUD_B, 235);
        fill_circle_a(ren, cx - cr * 0.9f, cy + 6, cr * 0.65f, COL_CLOUD_R, COL_CLOUD_G, COL_CLOUD_B, 235);
    }

    /* Far hill ridge */
    SDL_SetRenderDrawColor(ren, COL_HILL_FAR_R, COL_HILL_FAR_G, COL_HILL_FAR_B, 255);
    for (int x = 0; x < PLAY_W; x++) {
        float h = sinf(x * 0.012f) * 20.0f + cosf(x * 0.005f + 1.3f) * 14.0f;
        int y = horizon_y - 46 + (int)h;
        SDL_RenderDrawLine(ren, x, y, x, horizon_y + 20);
    }

    /* Near hill ridge */
    SDL_SetRenderDrawColor(ren, COL_HILL_NEAR_R, COL_HILL_NEAR_G, COL_HILL_NEAR_B, 255);
    for (int x = 0; x < PLAY_W; x++) {
        float h = sinf(x * 0.009f + 2.1f) * 30.0f + cosf(x * 0.02f) * 10.0f;
        int y = horizon_y - 10 + (int)h;
        SDL_RenderDrawLine(ren, x, y, x, horizon_y + 60);
    }

    /* Grass field */
    for (int y = horizon_y; y < SCREEN_HEIGHT; y++) {
        float t = (float)(y - horizon_y) / (float)(SCREEN_HEIGHT - horizon_y);
        Uint8 r = (Uint8)(COL_GRASS_TOP_R + (COL_GRASS_BOT_R - COL_GRASS_TOP_R) * t);
        Uint8 g = (Uint8)(COL_GRASS_TOP_G + (COL_GRASS_BOT_G - COL_GRASS_TOP_G) * t);
        Uint8 b = (Uint8)(COL_GRASS_TOP_B + (COL_GRASS_BOT_B - COL_GRASS_TOP_B) * t);
        SDL_SetRenderDrawColor(ren, r, g, b, 255);
        SDL_RenderDrawLine(ren, 0, y, PLAY_W, y);
    }

    /* Winding dirt path */
    SDL_SetRenderDrawColor(ren, COL_DIRT_R, COL_DIRT_G, COL_DIRT_B, 210);
    SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_BLEND);
    for (int y = horizon_y; y < SCREEN_HEIGHT; y++) {
        float t = (float)(y - horizon_y);
        int cx = PLAY_W / 2 + (int)(sinf(t * 0.012f) * 110.0f);
        int w = 30 + (int)(t * 0.05f);
        SDL_RenderDrawLine(ren, cx - w / 2, y, cx + w / 2, y);
    }
    SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_NONE);

    /* Village dressing */
    draw_tree(ren, 90, horizon_y + 40, 22);
    draw_tree(ren, 220, horizon_y + 150, 30);
    draw_house(ren, 150, horizon_y + 260, 70);
    draw_windmill(ren, PLAY_W - 180, horizon_y + 90, 90, ticks);
    draw_fence(ren, 340, horizon_y + 300, 160);
    draw_tree(ren, PLAY_W - 260, horizon_y + 380, 26);
    draw_house(ren, PLAY_W - 100, horizon_y + 470, 60);
    draw_tree(ren, 520, horizon_y + 520, 24);

    /* Arena edge */
    SDL_SetRenderDrawColor(ren, 255, 255, 255, 40);
    SDL_RenderDrawLine(ren, 0, PLAY_Y, PLAY_W, PLAY_Y);
}

static void draw_robot(SDL_Renderer* ren, Entity* e, Uint32 ticks) {
    float x = e->pos.x, y = e->pos.y, r = e->radius;
    Vec2 f = e->facing;
    float bob = sinf((float)ticks * 0.008f) * 1.5f;

    /* energy field */
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 70);
    draw_circle(ren, x, y, r + 8.0f, 20);

    /* ground shadow */
    fill_circle_a(ren, x, y + r * 0.75f, r * 0.7f, 0, 0, 0, 70);

    /* gun barrel, drawn under the torso */
    float bl = r * 1.6f;
    if (f.x != 0.0f)
        fill_rect(ren, (int)(x + (f.x > 0 ? 0.0f : -bl)), (int)(y - 3), (int)bl, 6, 40, 42, 48, 255);
    else
        fill_rect(ren, (int)(x - 3), (int)(y + (f.y > 0 ? 0.0f : -bl)), 6, (int)bl, 40, 42, 48, 255);
    SDL_SetRenderDrawColor(ren, COL_WARN_R, COL_WARN_G, COL_WARN_B, 255);
    SDL_RenderDrawPoint(ren, (int)(x + f.x * bl), (int)(y + f.y * bl));

    /* arms */
    fill_rect(ren, (int)(x - r * 0.95f), (int)(y - r * 0.1f + bob), (int)(r * 0.28f), (int)(r * 0.55f),
              COL_ROBOT_JOINT_R, COL_ROBOT_JOINT_G, COL_ROBOT_JOINT_B, 255);
    fill_rect(ren, (int)(x + r * 0.67f), (int)(y - r * 0.1f + bob), (int)(r * 0.28f), (int)(r * 0.55f),
              COL_ROBOT_JOINT_R, COL_ROBOT_JOINT_G, COL_ROBOT_JOINT_B, 255);

    /* torso */
    fill_rect(ren, (int)(x - r * 0.55f), (int)(y - r * 0.3f + bob), (int)(r * 1.1f), (int)(r * 0.95f),
              COL_ROBOT_TORSO_R, COL_ROBOT_TORSO_G, COL_ROBOT_TORSO_B, 255);
    SDL_SetRenderDrawColor(ren, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 220);
    SDL_Rect chest = { (int)(x - r * 0.55f), (int)(y - r * 0.3f + bob), (int)(r * 1.1f), (int)(r * 0.95f) };
    SDL_RenderDrawRect(ren, &chest);
    fill_circle_a(ren, x, y - r * 0.05f + bob, r * 0.16f, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 255);

    /* head */
    fill_rect(ren, (int)(x - r * 0.38f), (int)(y - r * 0.95f + bob), (int)(r * 0.76f), (int)(r * 0.55f),
              COL_ROBOT_HEAD_R, COL_ROBOT_HEAD_G, COL_ROBOT_HEAD_B, 255);
    fill_circle_a(ren, x, y - r * 0.68f + bob, r * 0.14f, COL_ACCENT_R, COL_ACCENT_G, COL_ACCENT_B, 255);

    /* antenna */
    SDL_SetRenderDrawColor(ren, COL_ROBOT_HEAD_R, COL_ROBOT_HEAD_G, COL_ROBOT_HEAD_B, 255);
    SDL_RenderDrawLine(ren, (int)x, (int)(y - r * 0.95f + bob), (int)x, (int)(y - r * 1.35f + bob));
    fill_circle_a(ren, x, y - r * 1.35f + bob, 3.0f, COL_WARN_R, COL_WARN_G, COL_WARN_B, 255);
}

static void draw_bird(SDL_Renderer* ren, Entity* e, Uint32 ticks) {
    float x = e->pos.x, y = e->pos.y, r = e->radius;
    float phase = (float)ticks * 0.012f + x * 0.05f + y * 0.03f;
    float flap = sinf(phase);
    float wing_len = r * 1.7f;
    float lift = flap * r * 0.85f;

    SDL_SetRenderDrawColor(ren, COL_BIRD_BODY_R, COL_BIRD_BODY_G, COL_BIRD_BODY_B, 255);
    for (int i = -1; i <= 1; i++) {
        SDL_RenderDrawLine(ren, (int)x, (int)y + i, (int)(x - wing_len), (int)(y - lift) + i);
        SDL_RenderDrawLine(ren, (int)(x - wing_len), (int)(y - lift) + i, (int)(x - wing_len * 0.45f), (int)(y - lift * 0.25f) + i);
        SDL_RenderDrawLine(ren, (int)x, (int)y + i, (int)(x + wing_len), (int)(y - lift) + i);
        SDL_RenderDrawLine(ren, (int)(x + wing_len), (int)(y - lift) + i, (int)(x + wing_len * 0.45f), (int)(y - lift * 0.25f) + i);
    }

    fill_circle_a(ren, x, y, r * 0.5f, COL_BIRD_BODY_R, COL_BIRD_BODY_G, COL_BIRD_BODY_B, 255);

    SDL_SetRenderDrawColor(ren, COL_BIRD_BEAK_R, COL_BIRD_BEAK_G, COL_BIRD_BEAK_B, 255);
    SDL_RenderDrawLine(ren, (int)x, (int)(y + r * 0.35f), (int)x, (int)(y + r * 0.85f));

    SDL_SetRenderDrawColor(ren, 235, 60, 60, 255);
    SDL_RenderDrawPoint(ren, (int)(x - r * 0.15f), (int)(y - r * 0.1f));
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
    draw_village_bg(ren);
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
        Uint32 ticks = SDL_GetTicks();

        for (int i = 0; i < MAX_PARTICLES; i++) {
            if (!model->particles[i].active) continue;
            SDL_SetRenderDrawColor(ren, model->particles[i].r, model->particles[i].g, model->particles[i].b, 255);
            SDL_RenderDrawPoint(ren, (int)model->particles[i].pos.x, (int)model->particles[i].pos.y);
        }

        for (int i = 0; i < MAX_ENTITIES; i++) {
            Entity* e = &model->entities[i];
            if (!e->active) continue;

            if (e->type == TYPE_PLAYER) {
                draw_robot(ren, e, ticks);
            } else if (e->type == TYPE_ENEMY) {
                draw_bird(ren, e, ticks);
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
