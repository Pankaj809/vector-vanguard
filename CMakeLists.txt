cmake_minimum_required(VERSION 3.10)
project(VectorVanguard C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra -O2 -Wno-unused-parameter")

list(APPEND CMAKE_PREFIX_PATH "/opt/homebrew" "/usr/local")

find_package(PkgConfig REQUIRED)
pkg_check_modules(SDL2 REQUIRED sdl2)
pkg_check_modules(SDL2_MIXER REQUIRED SDL2_mixer)
pkg_check_modules(SDL2_TTF REQUIRED SDL2_ttf)
include_directories(
    ${SDL2_INCLUDE_DIRS}
    ${SDL2_MIXER_INCLUDE_DIRS}
    ${SDL2_TTF_INCLUDE_DIRS}
    include
)
link_directories(
    ${SDL2_LIBRARY_DIRS}
    ${SDL2_MIXER_LIBRARY_DIRS}
    ${SDL2_TTF_LIBRARY_DIRS}
)

file(GLOB SOURCES "src/*.c")
add_executable(vanguard ${SOURCES})

target_link_libraries(vanguard
    ${SDL2_LIBRARIES}
    ${SDL2_MIXER_LIBRARIES}
    ${SDL2_TTF_LIBRARIES}
    m
)

# Copy assets next to the binary so SDL_GetBasePath() resolves them
add_custom_command(TARGET vanguard POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_SOURCE_DIR}/assets
        $<TARGET_FILE_DIR:vanguard>/assets
    COMMENT "Bundling assets for standalone run"
)
