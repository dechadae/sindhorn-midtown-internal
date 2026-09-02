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

rm -rf "$DIST"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/BettaMetalLab" "$APP/Contents/MacOS/BettaMetalLab"

# High Detail is now shipped as a precompiled Metal library. Runtime source
# compilation remains available only as a compatibility fallback in the app.
xcrun -sdk macosx metal -mmacosx-version-min=13.0 -c "$ROOT/Sources/BettaMetalLab/Shaders.metal" -o "$AIR"
xcrun -sdk macosx metallib "$AIR" -o "$METALLIB"
rm -f "$AIR"
cp "$ROOT/Sources/BettaMetalLab/Shaders.metal" "$APP/Contents/Resources/Shaders.metal"

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
<key>CFBundleShortVersionString</key><string>0.3.1</string>
<key>CFBundleVersion</key><string>4</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

codesign --force --deep --sign - "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
echo "Built: $APP"
echo "Metal library: $METALLIB"
echo "Archive: $ZIP"
