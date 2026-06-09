#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"

if [ ! -f "$BUILD/vanguard" ]; then
    mkdir -p "$BUILD"
    cmake -S "$ROOT" -B "$BUILD"
    cmake --build "$BUILD"
fi

exec "$BUILD/vanguard"
