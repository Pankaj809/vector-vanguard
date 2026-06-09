#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
DIST="$ROOT/dist/VectorVanguard"

mkdir -p "$BUILD"
cmake -S "$ROOT" -B "$BUILD"
cmake --build "$BUILD" --config Release

rm -rf "$DIST"
mkdir -p "$DIST/assets"
cp "$BUILD/vanguard" "$DIST/"
cp -R "$ROOT/assets/"* "$DIST/assets/"

cat > "$DIST/run.sh" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/vanguard"
EOF
chmod +x "$DIST/run.sh" "$DIST/vanguard"

echo "Standalone package ready: $DIST"
echo "Run: $DIST/run.sh"
