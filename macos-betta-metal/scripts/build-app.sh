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

rm -rf "$DIST"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/BettaMetalLab" "$APP/Contents/MacOS/BettaMetalLab"

# 0.3.2 deliberately ships the runtime-safe High Detail kernel. The full
# experimental kernel stays in source control for later incremental re-entry,
# but is not allowed to block app startup on the user's M4.
xcrun -sdk macosx metal -mmacosx-version-min=13.0 -c "$SAFE_SHADER" -o "$AIR"
xcrun -sdk macosx metallib "$AIR" -o "$METALLIB"
rm -f "$AIR"

# The source fallback is the same safe kernel byte-for-byte, so precompiled and
# fallback startup paths cannot diverge.
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
<key>CFBundleShortVersionString</key><string>0.3.2</string>
<key>CFBundleVersion</key><string>5</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

codesign --force --deep --sign - "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
echo "Built: $APP"
echo "Metal library: $METALLIB"
echo "Runtime kernel: ShadersSafe.metal"
echo "Archive: $ZIP"
