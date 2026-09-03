#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

swift run BettaMetalLab --self-test
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
DIST="$ROOT/dist"
APP="$DIST/BETTA.app"
ZIP="$DIST/BETTA-1.1.0-macOS-arm64.zip"
DMG="$DIST/BETTA-1.1.0-macOS-arm64.dmg"
AIR="$DIST/BettaShaders.air"
METALLIB="$APP/Contents/Resources/BettaShaders.metallib"
SAFE_SHADER="$ROOT/Sources/BettaMetalLab/ShadersSafe.metal"
GIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
SIGN_IDENTITY="${BETTA_CODESIGN_IDENTITY:--}"
NOTARY_PROFILE="${BETTA_NOTARY_PROFILE:-}"

rm -rf "$DIST"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/BettaMetalLab" "$APP/Contents/MacOS/BettaMetalLab"

# BETTA 1.1 preserves the approved 1.0 native Metal renderer and persistence
# domains. Imagine is an optional Apple Intelligence art-direction layer that
# generates only structured tail/membrane/palette/background parameters; it
# never replaces the renderer, generates images, or mutates camera/composition.
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
<key>CFBundleName</key><string>BETTA</string>
<key>CFBundleDisplayName</key><string>BETTA</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.1.0</string>
<key>CFBundleVersion</key><string>21</string>
<key>BettaGitSHA</key><string>__BETTA_GIT_SHA__</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
/usr/bin/sed -i '' "s/__BETTA_GIT_SHA__/$GIT_SHA/" "$APP/Contents/Info.plist"

if [[ "$SIGN_IDENTITY" == "-" ]]; then
  codesign --force --deep --sign - "$APP"
  SIGNING_MODE="ad-hoc development"
else
  codesign --force --deep --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP"
  SIGNING_MODE="Developer ID / Hardened Runtime"
fi

rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

if [[ -n "$NOTARY_PROFILE" && "$SIGN_IDENTITY" != "-" ]]; then
  xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$APP"
  rm -f "$ZIP"
  ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
fi

if command -v hdiutil >/dev/null 2>&1; then
  rm -f "$DMG"
  hdiutil create -quiet -volname "BETTA" -srcfolder "$APP" -ov -format UDZO "$DMG"
fi

echo "Built: $APP"
echo "Version: 1.1.0 (21)"
echo "Metal library: $METALLIB"
echo "Runtime kernel: ShadersSafe.metal"
echo "Signing: $SIGNING_MODE"
echo "Git SHA: $GIT_SHA"
echo "Archive: $ZIP"
[[ -f "$DMG" ]] && echo "Disk image: $DMG"
