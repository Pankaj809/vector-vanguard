#include "../include/vanguard.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static float dist_sq(Vec2 a, Vec2 b) {
    float dx = a.x - b.x; float dy = a.y - b.y; return (dx * dx) + (dy * dy);
}

static Entity* get_player(GameModel* model) {
    for (int i = 0; i < MAX_ENTITIES; i++) {
        if (model->entities[i].active && model->entities[i].type == TYPE_PLAYER)
            return &model->entities[i];
    }
    return NULL;
}

void game_push_log(GameModel* model, const char* msg) {
    for (int i = 0; i < LOG_LINES - 1; i++)
        strcpy(model->event_log[i], model->event_log[i + 1]);
    strncpy(model->event_log[LOG_LINES - 1], msg, LOG_COLS - 1);
    model->event_log[LOG_LINES - 1][LOG_COLS - 1] = '\0';
}

void game_init(GameModel* model) {
    model->current_state = STATE_MENU;
    model->difficulty = DIFF_NORMAL;
    model->menu_selection = 0;
    model->is_running = true;
    for (int i = 0; i < LOG_LINES; i++) model->event_log[i][0] = '\0';

    game_push_log(model, "VANGUARD SYSTEMS ONLINE");

    if (model->audio_enabled && model->sfx_welcome)
        Mix_PlayChannel(-1, model->sfx_welcome, 0);
    sys_play_music(model);
}

void game_reset_match(GameModel* model) {
    model->score = 0;
    model->lives = 3;
    model->enemy_spawn_timer = 0.0f;
    for (int i = 0; i < MAX_ENTITIES; i++) model->entities[i].active = false;

    game_spawn_entity(model, TYPE_PLAYER, (Vec2){PLAY_W / 2.0f, PLAY_Y + PLAY_H / 2.0f});

    game_push_log(model, "DEPLOYMENT CONFIRMED");
    game_push_log(model, "HOSTILES INBOUND");
}

Entity* game_spawn_entity(GameModel* model, EntityType type, Vec2 pos) {
    for (int i = 0; i < MAX_ENTITIES; i++) {
        if (!model->entities[i].active) {
            Entity* e = &model->entities[i];
            e->active = true;
            e->type = type;
            e->pos = pos;
            e->vel = (Vec2){0, 0};
            e->facing = (Vec2){0, -1};
            e->fire_cooldown = 0;
            e->radius = (type == TYPE_BULLET) ? 3.0f : ((type == TYPE_ENEMY) ? 12.0f : 16.0f);
            return e;
        }
    }
    return NULL;
}

void game_spawn_particle(GameModel* model, Vec2 pos, Uint8 r, Uint8 g, Uint8 b) {
    for (int i = 0; i < MAX_PARTICLES; i++) {
        if (!model->particles[i].active) {
            Particle* p = &model->particles[i];
            p->active = true;
            p->pos = pos;
            float angle = (float)(rand() % 360) * 3.14159f / 180.0f;
            float speed = (float)(rand() % 150 + 50);
            p->vel.x = cosf(angle) * speed;
            p->vel.y = sinf(angle) * speed;
            p->lifetime = 0.0f;
            p->max_lifetime = (float)(rand() % 100) / 200.0f + 0.2f;
            p->r = r;
            p->g = g;
            p->b = b;
            return;
        }
    }
}

void game_update(GameModel* model, float dt) {
    for (int i = 0; i < MAX_PARTICLES; i++) {
        Particle* p = &model->particles[i];
        if (!p->active) continue;
        p->lifetime += dt;
        if (p->lifetime >= p->max_lifetime) p->active = false;
        else { p->pos.x += p->vel.x * dt; p->pos.y += p->vel.y * dt; }
    }

    if (model->current_state != STATE_PLAYING) return;

    float spawn_interval = 1.4f;
    float enemy_speed = 100.0f;
    if (model->difficulty == DIFF_EASY) { spawn_interval = 2.0f; enemy_speed = 75.0f; }
    else if (model->difficulty == DIFF_HARD) { spawn_interval = 0.8f; enemy_speed = 135.0f; }

    model->enemy_spawn_timer += dt;
    if (model->enemy_spawn_timer >= spawn_interval) {
        model->enemy_spawn_timer = 0.0f;
        Vec2 s_pos = {(float)(rand() % PLAY_W), (float)PLAY_Y - 10.0f};
        game_spawn_entity(model, TYPE_ENEMY, s_pos);
    }

    Entity* player = get_player(model);

    for (int i = 0; i < MAX_ENTITIES; i++) {
        Entity* e = &model->entities[i];
        if (!e->active) continue;

        if (e->fire_cooldown > 0.0f) e->fire_cooldown -= dt;

        if (e->type == TYPE_ENEMY && player && player->active) {
            float dx = player->pos.x - e->pos.x;
            float dy = player->pos.y - e->pos.y;
            float d = sqrtf(dx * dx + dy * dy);
            if (d > 0) { e->vel.x = (dx / d) * enemy_speed; e->vel.y = (dy / d) * enemy_speed; }
        }

        e->pos.x += e->vel.x * dt;
        e->pos.y += e->vel.y * dt;

        if (e->type == TYPE_PLAYER) {
            if (e->pos.x < e->radius) e->pos.x = e->radius;
            if (e->pos.x > PLAY_W - e->radius) e->pos.x = PLAY_W - e->radius;
            if (e->pos.y < PLAY_Y + e->radius) e->pos.y = PLAY_Y + e->radius;
            if (e->pos.y > SCREEN_HEIGHT - e->radius) e->pos.y = SCREEN_HEIGHT - e->radius;
        }

        if (e->type == TYPE_BULLET &&
            (e->pos.y < PLAY_Y || e->pos.y > SCREEN_HEIGHT ||
             e->pos.x < 0 || e->pos.x > PLAY_W)) {
            e->active = false;
        }
    }

    for (int i = 0; i < MAX_ENTITIES; i++) {
        Entity* a = &model->entities[i];
        if (!a->active || a->type != TYPE_ENEMY) continue;
        for (int j = 0; j < MAX_ENTITIES; j++) {
            Entity* b = &model->entities[j];
            if (!b->active || i == j) continue;

            float r_sum = a->radius + b->radius;
            if (dist_sq(a->pos, b->pos) < (r_sum * r_sum)) {
                if (b->type == TYPE_BULLET) {
                    a->active = false;
                    b->active = false;
                    model->score += 10;
                    game_push_log(model, "HOSTILE NEUTRALIZED");
                    if (model->audio_enabled && model->sfx_explosion)
                        Mix_PlayChannel(-1, model->sfx_explosion, 0);
                    for (int k = 0; k < 10; k++) game_spawn_particle(model, a->pos, 220, 200, 170);
                } else if (b->type == TYPE_PLAYER) {
                    a->active = false;
                    model->lives--;
                    game_push_log(model, "HULL BREACH — LIFE LOST");

                    if (model->audio_enabled && model->sfx_explosion)
                        Mix_PlayChannel(-1, model->sfx_explosion, 0);
                    for (int k = 0; k < 25; k++) game_spawn_particle(model, b->pos, 255, 60, 80);

                    if (model->lives > 0) {
                        b->pos = (Vec2){PLAY_W / 2.0f, PLAY_Y + PLAY_H / 2.0f};
                        b->vel = (Vec2){0, 0};
                    } else {
                        b->active = false;
                        model->current_state = STATE_GAMEOVER;
                        game_push_log(model, "MISSION FAILED");
                        if (model->score > model->high_score) {
                            model->high_score = model->score;
                            io_save_highscore(model);
                        }
                    }
                }
            }
        }
    }
}
