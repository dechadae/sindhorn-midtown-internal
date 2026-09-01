# Sindhorn Betta — Android Live Wallpaper

Native Android port of the final Sindhorn Midtown procedural Betta WebGL atmosphere.

## Product intent

- Real Android `WallpaperService`, not a WebView, GIF or video loop.
- OpenGL ES 3 procedural radial membrane renderer.
- Eight final Betta identities and the exact production camera compositions.
- Bangkok 3-hour day cycle or manual Fish #1–#8 selection.
- Synchronized fin + dark gradient transitions.
- Device rotation-vector tilt and launcher-page parallax.
- Rendering pauses when the wallpaper is not visible.

## Install / use

1. Build or download the APK.
2. Install it on Android (allow the browser/file manager to install unknown apps for this debug build if prompted).
3. Open **Sindhorn Betta**.
4. Tap **Preview / Set Live Wallpaper**.
5. In Android's system wallpaper preview, choose **Home screen** or **Home and lock screen** when your device offers that option.

Android/OEM firmware owns the final home-vs-lock-screen chooser. The app intentionally does not attempt to bypass system confirmation.

## Current port status

Version `0.1.0` ports the final geometry, palettes, camera compositions, day cycle and tilt interaction to native OpenGL ES. The renderer currently starts from the same neutral bounded environmental driver values as the web engine while the Himawari CPU-analysis pipeline is being ported natively; no static fish image or video fallback is used.

## Build

Requires JDK 17 and Gradle 8.11.1 (CI supplies both):

```bash
gradle -p android-betta-wallpaper :app:assembleDebug
```

APK output:

`android-betta-wallpaper/app/build/outputs/apk/debug/app-debug.apk`
