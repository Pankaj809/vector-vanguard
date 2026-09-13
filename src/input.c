#include "../include/vanguard.h"

static Entity* get_player(GameModel* model) {
    for (int i = 0; i < MAX_ENTITIES; i++) {
        if (model->entities[i].active && model->entities[i].type == TYPE_PLAYER)
            return &model->entities[i];
    }
    return NULL;
}

void input_process(GameModel* model) {
SDL_Event event;
    while (SDL_PollEvent(&event)) {
        if (event.type == SDL_QUIT) model->is_running = false;

        if (event.type == SDL_KEYDOWN) {
            if (model->current_state == STATE_MENU) {
                if (event.key.keysym.sym == SDLK_UP) {
                    model->menu_selection--;
                    if (model->menu_selection < 0) model->menu_selection = 2;
                }
                if (event.key.keysym.sym == SDLK_DOWN) {
                    model->menu_selection++;
                    if (model->menu_selection > 2) model->menu_selection = 0;
                }
                if (event.key.keysym.sym == SDLK_RETURN) {
                    if (model->menu_selection == 0) {
                        game_reset_match(model);
                        model->current_state = STATE_PLAYING;
                    } else if (model->menu_selection == 1) {
                        model->current_state = STATE_OPTIONS;
                    } else if (model->menu_selection == 2) {
                        model->is_running = false;
                    }
                }
            } else if (model->current_state == STATE_OPTIONS) {
                if (event.key.keysym.sym == SDLK_ESCAPE || event.key.keysym.sym == SDLK_RETURN)
                    model->current_state = STATE_MENU;
                if (event.key.keysym.sym == SDLK_1) model->difficulty = DIFF_EASY;
                if (event.key.keysym.sym == SDLK_2) model->difficulty = DIFF_NORMAL;
                if (event.key.keysym.sym == SDLK_3) model->difficulty = DIFF_HARD;
            } else if (model->current_state == STATE_GAMEOVER) {
                if (event.key.keysym.sym == SDLK_RETURN) model->current_state = STATE_MENU;
            }
        }
    }

    if (model->current_state != STATE_PLAYING) return;

    const Uint8* keys = SDL_GetKeyboardState(NULL);
    const float SPEED = 280.0f;
    const float B_SPEED = 520.0f;

    Entity* player = get_player(model);
    if (!player) return;

    player->vel = (Vec2){0, 0};
    if (keys[SDL_SCANCODE_W] || keys[SDL_SCANCODE_UP])    { player->vel.y = -SPEED; player->facing = (Vec2){0, -1}; }
    if (keys[SDL_SCANCODE_S] || keys[SDL_SCANCODE_DOWN])  { player->vel.y =  SPEED; player->facing = (Vec2){0,  1}; }
    if (keys[SDL_SCANCODE_A] || keys[SDL_SCANCODE_LEFT])  { player->vel.x = -SPEED; player->facing = (Vec2){-1, 0}; }
    if (keys[SDL_SCANCODE_D] || keys[SDL_SCANCODE_RIGHT]) { player->vel.x =  SPEED; player->facing = (Vec2){ 1, 0}; }

    if ((keys[SDL_SCANCODE_SPACE] || keys[SDL_SCANCODE_LCTRL]) && player->fire_cooldown <= 0.0f) {
        Entity* bullet = game_spawn_entity(model, TYPE_BULLET, player->pos);
        if (bullet) {
            bullet->vel = (Vec2){player->facing.x * B_SPEED, player->facing.y * B_SPEED};
            player->fire_cooldown = 0.18f;
            if (model->audio_enabled && model->sfx_shoot)
                Mix_PlayChannel(-1, model->sfx_shoot, 0);
        }
    }
}
