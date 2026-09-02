#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

swift run BettaMetalLab --self-test
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
DIST="$ROOT/dist"
APP="$DIST/Sindhorn Betta Metal Lab.app"
ZIP="$DIST/Sindhorn-Betta-Metal-Lab-macOS.zip"
AIR="$DIST/BettaShaders.air"
METALLIB="$APP/Contents/Resources/BettaShaders.metallib"
SAFE_SHADER="$ROOT/Sources/BettaMetalLab/ShadersSafe.metal"
GIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"

rm -rf "$DIST"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/BettaMetalLab" "$APP/Contents/MacOS/BettaMetalLab"

# 0.4.0 builds on the stable 0.3.8 startup/recovery and Metal kernel.
# It adds exact saved presets/favorites, full XYZ landscape rotation,
# a configurable 1–6 membrane stack, and native AppKit Liquid Glass UI
# on macOS 26 with the established visual-effect fallback on older macOS.
xcrun -sdk macosx metal -mmacosx-version-min=13.0 -c "$SAFE_SHADER" -o "$AIR"
xcrun -sdk macosx metallib "$AIR" -o "$METALLIB"
rm -f "$AIR"

# Precompiled and source fallback paths use the same runtime-safe kernel.
cp "$SAFE_SHADER" "$APP/Contents/Resources/Shaders.metal"

test -s "$METALLIB"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>BettaMetalLab</string>
<key>CFBundleIdentifier</key><string>com.sindhornmidtown.BettaMetalLab</string>
<key>CFBundleName</key><string>Sindhorn Betta Metal Lab</string>
<key>CFBundleDisplayName</key><string>Sindhorn Betta Metal Lab</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.4.0</string>
<key>CFBundleVersion</key><string>12</string>
<key>BettaGitSHA</key><string>__BETTA_GIT_SHA__</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
/usr/bin/sed -i '' "s/__BETTA_GIT_SHA__/$GIT_SHA/" "$APP/Contents/Info.plist"

codesign --force --deep --sign - "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
echo "Built: $APP"
echo "Metal library: $METALLIB"
echo "Runtime kernel: ShadersSafe.metal"
echo "Git SHA: $GIT_SHA"
echo "Archive: $ZIP"
