#include "../include/vanguard.h"
#include <stdio.h>
#include <string.h>
#include <string.h>

static bool file_exists(const char* path) {
    FILE* f = fopen(path, "rb");
    if (f) { fclose(f); return true; }
    return false;
}

void sys_asset_path(GameModel* model, const char* filename, char* out, size_t out_size) {
    char try_path[512];
    if (model->exe_base[0]) {
        snprintf(try_path, sizeof(try_path), "%sassets/%s", model->exe_base, filename);
        if (file_exists(try_path)) { snprintf(out, out_size, "%s", try_path); return; }
    }
    snprintf(try_path, sizeof(try_path), "assets/%s", filename);
    if (file_exists(try_path)) { snprintf(out, out_size, "%s", try_path); return; }
    snprintf(try_path, sizeof(try_path), "../assets/%s", filename);
    if (file_exists(try_path)) { snprintf(out, out_size, "%s", try_path); return; }
    snprintf(out, out_size, "assets/%s", filename);
}

static void highscore_path(GameModel* model, char* out, size_t out_size) {
    if (model->exe_base[0]) snprintf(out, out_size, "%shighscore.dat", model->exe_base);
    else snprintf(out, out_size, "highscore.dat");
}

static Mix_Chunk* load_sfx(GameModel* model, const char* filename) {
    char path[512];
    sys_asset_path(model, filename, path, sizeof(path));
    Mix_Chunk* chunk = Mix_LoadWAV(path);
    if (!chunk) printf("[WARN] Missing %s (%s)\n", filename, path);
    return chunk;
}

static TTF_Font* load_font(GameModel* model, int size) {
    char path[512];
    sys_asset_path(model, "Roboto-Regular.ttf", path, sizeof(path));
    TTF_Font* font = TTF_OpenFont(path, size);
    if (!font) printf("[WARN] Font load failed: %s (%s)\n", TTF_GetError(), path);
    return font;
}

void sys_play_music(GameModel* model) {
    if (!model->audio_enabled || !model->music_bgm) return;
    if (!Mix_PlayingMusic()) Mix_PlayMusic(model->music_bgm, -1);
}

void sys_stop_music(GameModel* model) {
    (void)model;
    if (Mix_PlayingMusic()) Mix_HaltMusic();
}

void sys_init(GameModel* model, SDL_Window** win, SDL_Renderer** ren) {
    model->exe_base[0] = '\0';
    char* base = SDL_GetBasePath();
    if (base) {
        snprintf(model->exe_base, sizeof(model->exe_base), "%s", base);
        SDL_free(base);
    }

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO) < 0) {
        printf("SDL Init Error: %s\n", SDL_GetError());
        exit(1);
    }

    if (TTF_Init() == -1) {
        printf("TTF Init Error: %s\n", TTF_GetError());
        exit(1);
    }
    if (Mix_OpenAudio(44100, MIX_DEFAULT_FORMAT, 2, 1024) < 0) {
        model->audio_enabled = false;
        printf("[WARN] Audio failed: %s\n", Mix_GetError());
    } else {
        model->audio_enabled = true;
        Mix_AllocateChannels(16);
        model->sfx_shoot = load_sfx(model, "shoot.wav");
        model->sfx_explosion = load_sfx(model, "explosion.wav");
        model->sfx_welcome = load_sfx(model, "welcome.wav");

        char music_path[512];
        sys_asset_path(model, "music.wav", music_path, sizeof(music_path));
        model->music_bgm = Mix_LoadMUS(music_path);
        if (!model->music_bgm) printf("[WARN] Missing music.wav (%s)\n", music_path);
        if (model->music_bgm) Mix_VolumeMusic(48);
    }

    *win = SDL_CreateWindow("Vector Vanguard", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                            SCREEN_WIDTH, SCREEN_HEIGHT, SDL_WINDOW_SHOWN);
    *ren = SDL_CreateRenderer(*win, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);

    model->font_title   = load_font(model, 56);
    model->font_heading = load_font(model, 28);
    model->font_body    = load_font(model, 20);
    model->font_caption = load_font(model, 14);
    if (!model->font_body) printf("[ERROR] No font loaded — text will not render.\n");
}

void io_load_highscore(GameModel* model) {
    char path[512];
    highscore_path(model, path, sizeof(path));
    FILE* file = fopen(path, "rb");
    if (file) { fread(&model->high_score, sizeof(int), 1, file); fclose(file); }
    else { model->high_score = 0; }
}

void io_save_highscore(GameModel* model) {
    char path[512];
    highscore_path(model, path, sizeof(path));
    FILE* file = fopen(path, "wb");
    if (file) { fwrite(&model->high_score, sizeof(int), 1, file); fclose(file); }
}

void sys_cleanup(GameModel* model, SDL_Window* win, SDL_Renderer* ren) {
    if (model->sfx_shoot) Mix_FreeChunk(model->sfx_shoot);
    if (model->sfx_explosion) Mix_FreeChunk(model->sfx_explosion);
    if (model->sfx_welcome) Mix_FreeChunk(model->sfx_welcome);
    if (model->music_bgm) Mix_FreeMusic(model->music_bgm);

    if (model->font_title) TTF_CloseFont(model->font_title);
    if (model->font_heading) TTF_CloseFont(model->font_heading);
    if (model->font_body) TTF_CloseFont(model->font_body);
    if (model->font_caption) TTF_CloseFont(model->font_caption);

    Mix_CloseAudio();
    TTF_Quit();
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
}
