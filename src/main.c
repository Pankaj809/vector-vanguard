#include "../include/vanguard.h"

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    SDL_Window* window = NULL;
    SDL_Renderer* renderer = NULL;
    GameModel model = {0};

    sys_init(&model, &window, &renderer);
    game_init(&model);
    io_load_highscore(&model);

    Uint64 prev_counter = SDL_GetPerformanceCounter();
    float accumulator = 0.0f;
    const float TIME_STEP = 1.0f / 60.0f;

    while (model.is_running) {
        Uint64 current_counter = SDL_GetPerformanceCounter();
        float dt = (float)(current_counter - prev_counter) / SDL_GetPerformanceFrequency();
        prev_counter = current_counter;

        if (dt > 0.25f) dt = 0.25f; // Clamp to avoid spiral of death

        input_process(&model);

        accumulator += dt;
        while (accumulator >= TIME_STEP) {
            game_update(&model, TIME_STEP);
            accumulator -= TIME_STEP;
        }

        render_draw(&model, renderer);
    }

    io_save_highscore(&model);
    sys_cleanup(&model, window, renderer);
    return 0;
}

