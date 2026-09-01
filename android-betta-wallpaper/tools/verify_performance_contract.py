from pathlib import Path

service = Path("android-betta-wallpaper/app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt").read_text()
renderer = Path("android-betta-wallpaper/app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt").read_text()
required_service = [
    "setSurfaceSize",
    "setMotionTargets",
    "notifySettingsChanged",
    "LockSupport.parkNanos",
    "publishPerformance",
]
forbidden_service = [
    "tiltSource: () -> Triple",
    "val (targetX, targetY, page) = tiltSource()",
    "EGL14.eglQuerySurface",
    "SystemClock.sleep",
]
required_renderer = [
    "cachedMotionMultiplier",
    "nextTargetCheckNs",
    "setPresetUniformsIfNeeded",
    "updateViewport(width, height)",
    "GLES30.glDisable(GLES30.GL_BLEND)",
]
missing = [x for x in required_service if x not in service] + [x for x in required_renderer if x not in renderer]
forbidden = [x for x in forbidden_service if x in service]
if missing or forbidden:
    raise SystemExit(f"Android performance contract failed; missing={missing}, forbidden={forbidden}")
print("Android performance contract: OK")
