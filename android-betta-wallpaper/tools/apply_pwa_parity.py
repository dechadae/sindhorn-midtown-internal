from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_or_verify(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"Unexpected source while patching {label}")


shaders = ROOT / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaShaders.kt"
s = shaders.read_text()
old_lighting = """          float biologicalNoise=(micro-.5)*(.025+.03*uSatelliteEnergy);
          base*=.70+wrapA*.34+wrapB*.12;base+=base*foldLight*.24;base+=vec3(1.0,.94,.90)*edgeLight*(.06+.08*uBloom);base+=biologicalNoise;
          float transmitted=(1.0-nv)*uTransmission;base+=base*transmitted*.14;
          float alpha=uOpacity*uLayerAlpha*(.78+.10*rayRidge+.08*vFold);alpha*=1.0-vEdge*.055;
          fragColor=vec4(linearToSrgb(acesTone(max(base,vec3(0.0)))),clamp(alpha,.015,.94));"""
new_lighting = """          float biologicalNoise=(micro-.5)*.045;
          vec3 transmitted=base*(.36+.44*uTransmission+.2*nv);
          vec3 lit=transmitted+base*(foldLight*.42+edgeLight*.25)+vec3(1.0,.82,.92)*edgeLight*uBloom*.13;
          lit+=satTint*uSatelliteCold*vFold*.035;
          lit+=biologicalNoise*base;
          float membrane=.42+.35*(1.0-uTransmission)+.22*(1.0-nv);
          float alpha=uOpacity*membrane;
          alpha*=.72+.28*rayRidge;
          alpha+=vEdge*uOpacity*.09;
          alpha*=uLayerAlpha;
          alpha=clamp(alpha,0.0,.86);
          if(alpha<.001)discard;
          fragColor=vec4(lit,alpha);"""
s = replace_or_verify(s, old_lighting, new_lighting, "final membrane lighting")
shaders.write_text(s)

renderer = ROOT / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt"
r = renderer.read_text()
r = replace_or_verify(r, "    private var startNs = 0L\n", "    private var activeTimeSeconds = 0f\n", "motion field")
r = replace_or_verify(r, "        startNs = System.nanoTime()\n", "        activeTimeSeconds = 0f\n", "motion reset")
r = replace_or_verify(
    r,
    "    fun draw(width: Int, height: Int, nowNs: Long, tiltX: Float, tiltY: Float) {",
    "    fun draw(width: Int, height: Int, nowNs: Long, deltaSeconds: Float, tiltX: Float, tiltY: Float) {",
    "draw signature",
)
r = replace_or_verify(
    r,
    '        uniform1("uTime", ((nowNs - startNs).coerceAtLeast(0L) / 1_000_000_000.0).toFloat() * motionMultiplier())\n',
    '        activeTimeSeconds += deltaSeconds.coerceIn(0f, .05f) * motionMultiplier()\n        uniform1("uTime", activeTimeSeconds)\n',
    "PWA-style accumulated motion time",
)
renderer.write_text(r)

service = ROOT / "app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt"
w = service.read_text()
w = replace_or_verify(
    w,
    "                renderer.draw(width, height, now, currentTiltX, currentTiltY + pageParallax)\n",
    "                renderer.draw(width, height, now, dt, currentTiltX, currentTiltY + pageParallax)\n",
    "renderer delta-time call",
)
w = replace_or_verify(
    w,
    """                if (!EGL14.eglSwapBuffers(display, eglSurface)) {
                    Log.e(TAG, "eglSwapBuffers failed: 0x${EGL14.eglGetError().toString(16)}")
                    break
                }
                SystemClock.sleep(16)""",
    """                if (!EGL14.eglSwapBuffers(display, eglSurface)) {
                    Log.e(TAG, "eglSwapBuffers failed: 0x${EGL14.eglGetError().toString(16)}")
                    break
                }
                val frameElapsedNs = System.nanoTime() - now
                val remainingNs = 16_666_667L - frameElapsedNs
                if (remainingNs > 1_000_000L) SystemClock.sleep(remainingNs / 1_000_000L)""",
    "60 fps frame pacing",
)
w = replace_or_verify(
    w,
    """        require(EGL14.eglMakeCurrent(display, eglSurface, eglSurface, context)) {
            "eglMakeCurrent failed: 0x${EGL14.eglGetError().toString(16)}"
        }

        val glVersion""",
    """        require(EGL14.eglMakeCurrent(display, eglSurface, eglSurface, context)) {
            "eglMakeCurrent failed: 0x${EGL14.eglGetError().toString(16)}"
        }
        EGL14.eglSwapInterval(display, 1)

        val glVersion""",
    "EGL vsync",
)
service.write_text(w)

gradle = ROOT / "app/build.gradle.kts"
g = gradle.read_text()
if 'versionName = "0.1.3"' in g:
    g = g.replace("versionCode = 4", "versionCode = 5").replace('versionName = "0.1.3"', 'versionName = "0.1.4"')
elif 'versionName = "0.1.4"' not in g:
    raise SystemExit("Unexpected Android app version")
gradle.write_text(g)

print("Android Betta parity source is ready for 0.1.4")
