from pathlib import Path

root = Path(__file__).resolve().parents[1]
shaders = (root / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaShaders.kt").read_text()
renderer = (root / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt").read_text()
service = (root / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt").read_text()

required_shader = [
    "vec3 transmitted=base*(.36+.44*uTransmission+.2*nv);",
    "vec3 lit=transmitted+base*(foldLight*.42+edgeLight*.25)+vec3(1.0,.82,.92)*edgeLight*uBloom*.13;",
    "float membrane=.42+.35*(1.0-uTransmission)+.22*(1.0-nv);",
    "alpha=clamp(alpha,0.0,.86);",
    "fragColor=vec4(lit,alpha);",
]
forbidden_shader = [
    "acesTone(max(base",
    "uOpacity*uLayerAlpha*(.78+.10*rayRidge",
]
required_renderer = [
    "private var activeTimeSeconds = 0f",
    "activeTimeSeconds += deltaSeconds.coerceIn(0f, .05f) * motionMultiplier()",
    'uniform1("uTime", activeTimeSeconds)',
]
required_service = [
    "renderer.draw(width, height, now, dt, currentTiltX, currentTiltY + pageParallax)",
    "EGL14.eglSwapInterval(display, 1)",
    "val remainingNs = 16_666_667L - frameElapsedNs",
]

missing = [x for x in required_shader if x not in shaders]
missing += [x for x in required_renderer if x not in renderer]
missing += [x for x in required_service if x not in service]
forbidden = [x for x in forbidden_shader if x in shaders]
if missing or forbidden:
    raise SystemExit(f"Android Betta parity failed; missing={missing}, forbidden={forbidden}")

print("Android Betta visual and motion parity guard passed")
