#ifndef VANGUARD_H
#define VANGUARD_H

#include <SDL2/SDL.h>
#include <SDL2/SDL_mixer.h>
#include <SDL2/SDL_ttf.h>
#include <stdbool.h>

#define SCREEN_WIDTH 1024
#define SCREEN_HEIGHT 768
#define HUD_H 52
#define SIDEBAR_W 260
#define PLAY_W (SCREEN_WIDTH - SIDEBAR_W)
#define PLAY_H (SCREEN_HEIGHT - HUD_H)
#define PLAY_Y HUD_H

#define MAX_ENTITIES 512
#define MAX_PARTICLES 200
#define LOG_LINES 8
#define LOG_COLS 40

typedef enum { STATE_MENU, STATE_OPTIONS, STATE_PLAYING, STATE_GAMEOVER } GameState;
typedef enum { TYPE_NONE, TYPE_PLAYER, TYPE_ENEMY, TYPE_BULLET } EntityType;
typedef enum { DIFF_EASY, DIFF_NORMAL, DIFF_HARD } Difficulty;

typedef struct { float x; float y; } Vec2;

typedef struct {
    bool active; EntityType type; Vec2 pos; Vec2 vel; Vec2 facing; float radius; float fire_cooldown;
} Entity;

typedef struct {
    bool active; Vec2 pos; Vec2 vel; float lifetime; float max_lifetime; Uint8 r, g, b;
} Particle;

typedef struct {
    GameState current_state;
    Difficulty difficulty;
    int menu_selection;
    bool is_running;
    bool audio_enabled;
    int score;
    int high_score;
    int lives;
    float enemy_spawn_timer;

    char event_log[LOG_LINES][LOG_COLS];

    Entity entities[MAX_ENTITIES];
    Particle particles[MAX_PARTICLES];

    Mix_Chunk* sfx_shoot;
    Mix_Chunk* sfx_explosion;
    Mix_Chunk* sfx_welcome;
    Mix_Music* music_bgm;

    char exe_base[512];

    TTF_Font* font_title;
    TTF_Font* font_heading;
    TTF_Font* font_body;
    TTF_Font* font_caption;
} GameModel;

void sys_init(GameModel* model, SDL_Window** win, SDL_Renderer** ren);
void sys_cleanup(GameModel* model, SDL_Window* win, SDL_Renderer* ren);
void sys_asset_path(GameModel* model, const char* filename, char* out, size_t out_size);
void sys_play_music(GameModel* model);
void sys_stop_music(GameModel* model);
void io_load_highscore(GameModel* model);
void io_save_highscore(GameModel* model);

void input_process(GameModel* model);
void game_init(GameModel* model);
void game_reset_match(GameModel* model);
void game_update(GameModel* model, float dt);
void game_push_log(GameModel* model, const char* msg);
void game_spawn_particle(GameModel* model, Vec2 pos, Uint8 r, Uint8 g, Uint8 b);
Entity* game_spawn_entity(GameModel* model, EntityType type, Vec2 pos);

void render_draw(GameModel* model, SDL_Renderer* ren);

#endif
