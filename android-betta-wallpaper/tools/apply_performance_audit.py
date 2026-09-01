from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'{label}: expected source block not found in {path}')
    path.write_text(text.replace(old, new, 1))

root = Path('android-betta-wallpaper')

# Settings / telemetry keys.
settings = root / 'app/src/main/java/com/sindhornmidtown/betta/BettaSettings.kt'
replace_once(
    settings,
    '    const val KEY_RENDERER_ERROR = "renderer_error"\n',
    '''    const val KEY_RENDERER_ERROR = "renderer_error"\n    const val KEY_PERF_FPS_X100 = "perf_fps_x100"\n    const val KEY_PERF_FRAME_MS_X100 = "perf_frame_ms_x100"\n    const val KEY_PERF_P95_MS_X100 = "perf_p95_ms_x100"\n    const val KEY_PERF_RENDER_MS_X100 = "perf_render_ms_x100"\n    const val KEY_PERF_SURFACE = "perf_surface"\n    const val KEY_GL_RENDERER = "gl_renderer"\n    const val KEY_GL_VERSION = "gl_version"\n''',
    'performance settings keys',
)

# Renderer: cache settings/time checks, camera projection, and common uniforms.
renderer = root / 'app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt'
replace_once(
    renderer,
    '    private var reportedFirstFrame = false\n    private val bgLocations = HashMap<String, Int>()\n',
    '''    private var reportedFirstFrame = false\n    private var viewportWidth = 0\n    private var viewportHeight = 0\n    private var cameraZ = 10.4f\n    private var cachedMode = BettaSettings.MODE_LIVE\n    private var cachedManualIndex = 0\n    private var cachedTiltEnabled = true\n    private var cachedTiltStrength = 1f\n    private var cachedMotionMultiplier = 1f\n    private var forceTargetCheck = true\n    private var nextTargetCheckNs = 0L\n    private var commonUniformFrom = -1\n    private var commonUniformTo = -1\n    private val bgLocations = HashMap<String, Int>()\n''',
    'renderer cached state fields',
)
replace_once(
    renderer,
    '''        GLES30.glDisable(GLES30.GL_CULL_FACE)\n        GLES30.glDisable(GLES30.GL_DITHER)\n        GLES30.glEnable(GLES30.GL_BLEND)\n        GLES30.glBlendFunc(GLES30.GL_SRC_ALPHA, GLES30.GL_ONE_MINUS_SRC_ALPHA)\n        checkGl("renderer-state")\n        activeTimeSeconds = 0f\n        val initial = desiredIndex()\n''',
    '''        GLES30.glDisable(GLES30.GL_CULL_FACE)\n        GLES30.glDisable(GLES30.GL_DITHER)\n        GLES30.glDisable(GLES30.GL_DEPTH_TEST)\n        GLES30.glDisable(GLES30.GL_BLEND)\n        GLES30.glBlendFunc(GLES30.GL_SRC_ALPHA, GLES30.GL_ONE_MINUS_SRC_ALPHA)\n        checkGl("renderer-state")\n        activeTimeSeconds = 0f\n        refreshPreferences()\n        val initial = desiredIndex()\n''',
    'renderer startup state',
)
old_draw = '''    fun draw(width: Int, height: Int, nowNs: Long, deltaSeconds: Float, tiltX: Float, tiltY: Float) {\n        if (width <= 0 || height <= 0 || finProgram == 0) return\n        updateTarget(nowNs)\n        val e = transitionMix(nowNs)\n        val from = BettaPresets.all[fromIndex]\n        val to = BettaPresets.all[toIndex]\n        val aspect = width.toFloat() / height.toFloat()\n        val cameraZ = if (aspect < .7f) 10.4f else 9f\n\n        GLES30.glViewport(0, 0, width, height)\n        GLES30.glDisable(GLES30.GL_DEPTH_TEST)\n        drawBackground(from, to, e)\n\n        Matrix.perspectiveM(proj, 0, 32f, aspect, .1f, 50f)\n        Matrix.setLookAtM(view, 0, 0f, 0f, cameraZ, 0f, 0f, 0f, 0f, 1f, 0f)\n        Matrix.multiplyMM(viewProj, 0, proj, 0, view, 0)\n\n        GLES30.glUseProgram(finProgram)\n        uniformMatrix("uViewProj", viewProj)\n        uniform3("uCameraPosition", 0f, 0f, cameraZ)\n        activeTimeSeconds += deltaSeconds.coerceIn(0f, .05f) * motionMultiplier()\n        uniform1("uTime", activeTimeSeconds)\n        setSatelliteUniforms()\n        GLES30.glBindVertexArray(vao)\n        for (layerIndex in 0..1) drawLayer(from, to, e, layerIndex, tiltX, tiltY)\n        GLES30.glBindVertexArray(0)\n\n        if (!reportedFirstFrame) {\n            checkGl("first-draw")\n            reportedFirstFrame = true\n            recordStatus("running")\n        }\n    }\n'''
new_draw = '''    fun draw(width: Int, height: Int, nowNs: Long, deltaSeconds: Float, tiltX: Float, tiltY: Float) {\n        if (width <= 0 || height <= 0 || finProgram == 0) return\n        updateTarget(nowNs)\n        val e = transitionMix(nowNs)\n        val from = BettaPresets.all[fromIndex]\n        val to = BettaPresets.all[toIndex]\n\n        updateViewport(width, height)\n        GLES30.glDisable(GLES30.GL_BLEND)\n        drawBackground(from, to, e)\n        GLES30.glEnable(GLES30.GL_BLEND)\n\n        GLES30.glUseProgram(finProgram)\n        activeTimeSeconds += deltaSeconds.coerceIn(0f, .05f) * cachedMotionMultiplier\n        uniform1("uTime", activeTimeSeconds)\n        setSatelliteUniforms()\n        setPresetUniformsIfNeeded(from, to, e)\n        GLES30.glBindVertexArray(vao)\n        for (layerIndex in 0..1) drawLayer(from, to, e, layerIndex, tiltX, tiltY)\n        GLES30.glBindVertexArray(0)\n\n        if (!reportedFirstFrame) {\n            checkGl("first-draw")\n            reportedFirstFrame = true\n            recordStatus("running")\n        }\n    }\n\n    fun refreshPreferences() {\n        cachedMode = prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE) ?: BettaSettings.MODE_LIVE\n        cachedManualIndex = prefs.getInt(BettaSettings.KEY_MANUAL_INDEX, 0).coerceIn(0, BettaPresets.all.lastIndex)\n        cachedTiltEnabled = prefs.getBoolean(BettaSettings.KEY_TILT, true)\n        cachedTiltStrength = prefs.getInt(BettaSettings.KEY_TILT_STRENGTH, 100).coerceIn(0, 160) / 100f\n        cachedMotionMultiplier = prefs.getInt(BettaSettings.KEY_MOTION, 100).coerceIn(20, 160) / 100f\n        forceTargetCheck = true\n    }\n\n    private fun updateViewport(width: Int, height: Int) {\n        if (width == viewportWidth && height == viewportHeight) return\n        viewportWidth = width\n        viewportHeight = height\n        val aspect = width.toFloat() / height.toFloat()\n        cameraZ = if (aspect < .7f) 10.4f else 9f\n        GLES30.glViewport(0, 0, width, height)\n        Matrix.perspectiveM(proj, 0, 32f, aspect, .1f, 50f)\n        Matrix.setLookAtM(view, 0, 0f, 0f, cameraZ, 0f, 0f, 0f, 0f, 1f, 0f)\n        Matrix.multiplyMM(viewProj, 0, proj, 0, view, 0)\n        GLES30.glUseProgram(finProgram)\n        uniformMatrix("uViewProj", viewProj)\n        uniform3("uCameraPosition", 0f, 0f, cameraZ)\n    }\n'''
replace_once(renderer, old_draw, new_draw, 'renderer draw loop')

old_layer_prefix = '''        fun p(x: Float, y: Float) = lerp(x, y, e)\n        uniform1("uSeed", p(la.seed, lb.seed))\n        uniform1("uPhase", p(la.phase, lb.phase))\n        uniform1("uSpread", p(a.spread, b.spread))\n        uniform1("uFoldDensity", p(a.foldDensity, b.foldDensity))\n        uniform1("uCurl", p(a.curl, b.curl))\n        uniform1("uTwist", p(a.twist, b.twist))\n        uniform1("uEdgeFlutter", p(a.edgeFlutter, b.edgeFlutter))\n        uniform1("uDepth", p(a.depth, b.depth))\n        uniform1("uCurrentStrength", p(a.currentStrength, b.currentStrength))\n        uniform1("uMotionSpeed", p(a.motionSpeed, b.motionSpeed))\n        uniform1("uTurbulence", p(a.turbulence, b.turbulence))\n        uniform1("uMotionAmplitude", p(a.motionAmplitude, b.motionAmplitude))\n        uniform1("uOpacity", p(a.opacity, b.opacity))\n        uniform1("uTransmission", p(a.transmission, b.transmission))\n        uniform1("uRimStrength", p(a.rimStrength, b.rimStrength))\n        uniform1("uFoldHighlight", p(a.foldHighlight, b.foldHighlight))\n        uniform1("uIridescence", p(a.iridescence, b.iridescence))\n        uniform1("uBloom", p(a.bloom, b.bloom))\n        uniform1("uSaturation", p(a.saturation, b.saturation))\n        uniform1("uBrightness", p(a.brightness, b.brightness))\n        uniform1("uGradientPosition", p(a.gradientPosition, b.gradientPosition))\n        uniform1("uLayerAlpha", p(la.alpha, lb.alpha))\n        uniform1("uMorphModeFrom", from.morphMode)\n        uniform1("uMorphModeTo", to.morphMode)\n        uniform1("uMorphTransition", e)\n        for (i in 0..3) {\n            uniform3("uColor${i}From", from.palette[i])\n            uniform3("uColor${i}To", to.palette[i])\n        }\n\n        val tiltEnabled = prefs.getBoolean(BettaSettings.KEY_TILT, true)\n        val globalTilt = prefs.getInt(BettaSettings.KEY_TILT_STRENGTH, 100).coerceIn(0, 160) / 100f\n'''
new_layer_prefix = '''        fun p(x: Float, y: Float) = lerp(x, y, e)\n        uniform1("uSeed", p(la.seed, lb.seed))\n        uniform1("uPhase", p(la.phase, lb.phase))\n        uniform1("uLayerAlpha", p(la.alpha, lb.alpha))\n\n        val tiltEnabled = cachedTiltEnabled\n        val globalTilt = cachedTiltStrength\n'''
replace_once(renderer, old_layer_prefix, new_layer_prefix, 'renderer layer uniform split')

insert_before_layer = '''    private fun drawLayer(from: BettaPreset, to: BettaPreset, e: Float, layerIndex: Int, tiltX: Float, tiltY: Float) {\n'''
common_fn = '''    private fun setPresetUniformsIfNeeded(from: BettaPreset, to: BettaPreset, e: Float) {\n        val transitionActive = fromIndex != toIndex\n        if (!transitionActive && commonUniformFrom == fromIndex && commonUniformTo == toIndex) return\n        val a = from.params\n        val b = to.params\n        fun p(x: Float, y: Float) = lerp(x, y, e)\n        uniform1("uSpread", p(a.spread, b.spread))\n        uniform1("uFoldDensity", p(a.foldDensity, b.foldDensity))\n        uniform1("uCurl", p(a.curl, b.curl))\n        uniform1("uTwist", p(a.twist, b.twist))\n        uniform1("uEdgeFlutter", p(a.edgeFlutter, b.edgeFlutter))\n        uniform1("uDepth", p(a.depth, b.depth))\n        uniform1("uCurrentStrength", p(a.currentStrength, b.currentStrength))\n        uniform1("uMotionSpeed", p(a.motionSpeed, b.motionSpeed))\n        uniform1("uTurbulence", p(a.turbulence, b.turbulence))\n        uniform1("uMotionAmplitude", p(a.motionAmplitude, b.motionAmplitude))\n        uniform1("uOpacity", p(a.opacity, b.opacity))\n        uniform1("uTransmission", p(a.transmission, b.transmission))\n        uniform1("uRimStrength", p(a.rimStrength, b.rimStrength))\n        uniform1("uFoldHighlight", p(a.foldHighlight, b.foldHighlight))\n        uniform1("uIridescence", p(a.iridescence, b.iridescence))\n        uniform1("uBloom", p(a.bloom, b.bloom))\n        uniform1("uSaturation", p(a.saturation, b.saturation))\n        uniform1("uBrightness", p(a.brightness, b.brightness))\n        uniform1("uGradientPosition", p(a.gradientPosition, b.gradientPosition))\n        uniform1("uMorphModeFrom", from.morphMode)\n        uniform1("uMorphModeTo", to.morphMode)\n        uniform1("uMorphTransition", e)\n        for (i in 0..3) {\n            uniform3("uColor${i}From", from.palette[i])\n            uniform3("uColor${i}To", to.palette[i])\n        }\n        commonUniformFrom = fromIndex\n        commonUniformTo = toIndex\n    }\n\n'''
replace_once(renderer, insert_before_layer, common_fn + insert_before_layer, 'renderer common uniforms function')

old_target = '''    private fun updateTarget(nowNs: Long) {\n        val desired = desiredIndex()\n        if (firstTarget) {\n            fromIndex = desired; toIndex = desired; firstTarget = false; return\n        }\n        if (desired == toIndex) return\n        fromIndex = toIndex\n        toIndex = desired\n        transitionStartNs = nowNs\n        transitionDurationNs = if (prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE) == BettaSettings.MODE_LIVE) 60_000_000_000L else 900_000_000L\n    }\n\n    private fun desiredIndex(): Int {\n        return if (prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE) == BettaSettings.MODE_MANUAL) {\n            prefs.getInt(BettaSettings.KEY_MANUAL_INDEX, 0).coerceIn(0, BettaPresets.all.lastIndex)\n        } else {\n            (ZonedDateTime.now(BANGKOK).hour / 3).coerceIn(0, 7)\n        }\n    }\n'''
new_target = '''    private fun updateTarget(nowNs: Long) {\n        if (!forceTargetCheck && nowNs < nextTargetCheckNs) return\n        forceTargetCheck = false\n        nextTargetCheckNs = nowNs + 500_000_000L\n        val desired = desiredIndex()\n        if (firstTarget) {\n            fromIndex = desired; toIndex = desired; firstTarget = false; return\n        }\n        if (desired == toIndex) return\n        fromIndex = toIndex\n        toIndex = desired\n        commonUniformFrom = -1\n        commonUniformTo = -1\n        transitionStartNs = nowNs\n        transitionDurationNs = if (cachedMode == BettaSettings.MODE_LIVE) 60_000_000_000L else 900_000_000L\n    }\n\n    private fun desiredIndex(): Int {\n        return if (cachedMode == BettaSettings.MODE_MANUAL) {\n            cachedManualIndex\n        } else {\n            (ZonedDateTime.now(BANGKOK).hour / 3).coerceIn(0, 7)\n        }\n    }\n'''
replace_once(renderer, old_target, new_target, 'renderer target throttling')
replace_once(
    renderer,
    '    private fun motionMultiplier(): Float = prefs.getInt(BettaSettings.KEY_MOTION, 100).coerceIn(20, 160) / 100f\n\n',
    '',
    'remove per-frame motion prefs read',
)

# Wallpaper service: remove per-frame allocations/EGL queries and improve pacing/telemetry.
service = root / 'app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt'
replace_once(service, 'import android.os.SystemClock\n', 'import java.util.concurrent.locks.LockSupport\n', 'service pacing import')
old_create = '''            renderThread = BettaRenderThread(holder.surface, prefs) {\n                Triple(targetTiltX, targetTiltY, pageOffset)\n            }.also {\n                it.setWallpaperVisible(visible)\n                it.start()\n            }\n        }\n'''
new_create = '''            renderThread = BettaRenderThread(holder.surface, prefs).also {\n                it.setSurfaceSize(holder.surfaceFrame.width(), holder.surfaceFrame.height())\n                it.setMotionTargets(targetTiltX, targetTiltY, pageOffset)\n                it.setWallpaperVisible(visible)\n                it.start()\n            }\n        }\n\n        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {\n            super.onSurfaceChanged(holder, format, width, height)\n            renderThread?.setSurfaceSize(width, height)\n        }\n'''
replace_once(service, old_create, new_create, 'service render thread creation')
replace_once(
    service,
    '            pageOffset = ((xOffset - .5f) * 2f).coerceIn(-1f, 1f)\n',
    '            pageOffset = ((xOffset - .5f) * 2f).coerceIn(-1f, 1f)\n            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)\n',
    'service page target push',
)
replace_once(
    service,
    '            targetTiltX = ((pitch - pitch0) / .42f).coerceIn(-1f, 1f)\n            targetTiltY = ((roll - roll0) / .42f).coerceIn(-1f, 1f)\n',
    '            targetTiltX = ((pitch - pitch0) / .42f).coerceIn(-1f, 1f)\n            targetTiltY = ((roll - roll0) / .42f).coerceIn(-1f, 1f)\n            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)\n',
    'service tilt target push',
)
replace_once(
    service,
    '''        override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {\n            if (key == BettaSettings.KEY_TILT) {\n                if (visible) {\n                    unregisterTilt()\n                    registerTilt()\n                }\n            }\n        }\n''',
    '''        override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {\n            renderThread?.notifySettingsChanged()\n            if (key == BettaSettings.KEY_TILT && visible) {\n                unregisterTilt()\n                registerTilt()\n            }\n        }\n''',
    'service preferences listener',
)
replace_once(
    service,
    '''            targetTiltX = 0f\n            targetTiltY = 0f\n            if (!prefs.getBoolean(BettaSettings.KEY_TILT, true)) return\n''',
    '''            targetTiltX = 0f\n            targetTiltY = 0f\n            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)\n            if (!prefs.getBoolean(BettaSettings.KEY_TILT, true)) return\n''',
    'service register tilt reset',
)
replace_once(
    service,
    '''            calibrated = false\n            targetTiltX = 0f\n            targetTiltY = 0f\n        }\n''',
    '''            calibrated = false\n            targetTiltX = 0f\n            targetTiltY = 0f\n            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)\n        }\n''',
    'service unregister tilt reset',
)
replace_once(
    service,
    '''private class BettaRenderThread(\n    private val surface: Surface,\n    private val prefs: SharedPreferences,\n    private val tiltSource: () -> Triple<Float, Float, Float>,\n) : Thread("SindhornBettaGL") {\n''',
    '''private class BettaRenderThread(\n    private val surface: Surface,\n    private val prefs: SharedPreferences,\n) : Thread("SindhornBettaGL") {\n''',
    'render thread constructor',
)
replace_once(
    service,
    '''    @Volatile private var wallpaperVisible = false\n    private var currentTiltX = 0f\n    private var currentTiltY = 0f\n    private var currentPage = 0f\n''',
    '''    @Volatile private var wallpaperVisible = false\n    @Volatile private var surfaceWidth = 0\n    @Volatile private var surfaceHeight = 0\n    @Volatile private var targetTiltX = 0f\n    @Volatile private var targetTiltY = 0f\n    @Volatile private var targetPage = 0f\n    @Volatile private var settingsDirty = true\n    private var currentTiltX = 0f\n    private var currentTiltY = 0f\n    private var currentPage = 0f\n    private var perfWindowStartNs = 0L\n    private var perfLastFrameStartNs = 0L\n    private var perfFrameCount = 0\n    private var perfRenderTotalNs = 0L\n    private val perfIntervalsNs = LongArray(240)\n    private var perfIntervalCount = 0\n''',
    'render thread state fields',
)
insert_after_visibility = '''    fun setWallpaperVisible(value: Boolean) {\n        wallpaperVisible = value\n        synchronized(stateLock) { stateLock.notifyAll() }\n    }\n\n'''
new_methods = insert_after_visibility + '''    fun setSurfaceSize(width: Int, height: Int) {\n        surfaceWidth = width.coerceAtLeast(0)\n        surfaceHeight = height.coerceAtLeast(0)\n        synchronized(stateLock) { stateLock.notifyAll() }\n    }\n\n    fun setMotionTargets(tiltX: Float, tiltY: Float, page: Float) {\n        targetTiltX = tiltX\n        targetTiltY = tiltY\n        targetPage = page\n    }\n\n    fun notifySettingsChanged() {\n        settingsDirty = true\n        synchronized(stateLock) { stateLock.notifyAll() }\n    }\n\n'''
replace_once(service, insert_after_visibility, new_methods, 'render thread update methods')

old_loop_core = '''                if (!wallpaperVisible || !surface.isValid) {\n                    synchronized(stateLock) {\n                        if (running && (!wallpaperVisible || !surface.isValid)) stateLock.wait(500)\n                    }\n                    lastNs = System.nanoTime()\n                    continue\n                }\n                val now = System.nanoTime()\n                val dt = ((now - lastNs).coerceAtMost(50_000_000L) / 1_000_000_000f)\n                lastNs = now\n                val (targetX, targetY, page) = tiltSource()\n                val response = 1f - kotlin.math.exp((-dt * 10f).toDouble()).toFloat()\n                currentTiltX += (targetX - currentTiltX) * response\n                currentTiltY += (targetY - currentTiltY) * response\n                currentPage += (page - currentPage) * response\n\n                val size = IntArray(1)\n                EGL14.eglQuerySurface(display, eglSurface, EGL14.EGL_WIDTH, size, 0)\n                val width = size[0]\n                EGL14.eglQuerySurface(display, eglSurface, EGL14.EGL_HEIGHT, size, 0)\n                val height = size[0]\n                val pageParallax = currentPage * .16f\n                renderer.draw(width, height, now, dt, currentTiltX, currentTiltY + pageParallax)\n                if (!EGL14.eglSwapBuffers(display, eglSurface)) {\n                    Log.e(TAG, "eglSwapBuffers failed: 0x${EGL14.eglGetError().toString(16)}")\n                    break\n                }\n                val frameElapsedNs = System.nanoTime() - now\n                val remainingNs = 16_666_667L - frameElapsedNs\n                if (remainingNs > 1_000_000L) SystemClock.sleep(remainingNs / 1_000_000L)\n'''
new_loop_core = '''                if (!wallpaperVisible || !surface.isValid || surfaceWidth <= 0 || surfaceHeight <= 0) {\n                    publishPerformance(System.nanoTime(), surfaceWidth, surfaceHeight, true)\n                    resetPerformanceWindow()\n                    synchronized(stateLock) {\n                        if (running && (!wallpaperVisible || !surface.isValid || surfaceWidth <= 0 || surfaceHeight <= 0)) stateLock.wait(500)\n                    }\n                    lastNs = System.nanoTime()\n                    continue\n                }\n                val now = System.nanoTime()\n                val dt = ((now - lastNs).coerceAtMost(50_000_000L) / 1_000_000_000f)\n                lastNs = now\n                if (settingsDirty) {\n                    renderer.refreshPreferences()\n                    settingsDirty = false\n                }\n                val response = 1f - kotlin.math.exp((-dt * 10f).toDouble()).toFloat()\n                currentTiltX += (targetTiltX - currentTiltX) * response\n                currentTiltY += (targetTiltY - currentTiltY) * response\n                currentPage += (targetPage - currentPage) * response\n\n                val width = surfaceWidth\n                val height = surfaceHeight\n                val pageParallax = currentPage * .16f\n                renderer.draw(width, height, now, dt, currentTiltX, currentTiltY + pageParallax)\n                val drawEndNs = System.nanoTime()\n                if (!EGL14.eglSwapBuffers(display, eglSurface)) {\n                    Log.e(TAG, "eglSwapBuffers failed: 0x${EGL14.eglGetError().toString(16)}")\n                    break\n                }\n                publishPerformance(now, width, height, false, drawEndNs - now)\n                val frameElapsedNs = System.nanoTime() - now\n                val remainingNs = 16_666_667L - frameElapsedNs\n                if (remainingNs > 100_000L) LockSupport.parkNanos(remainingNs)\n'''
replace_once(service, old_loop_core, new_loop_core, 'render loop allocation and pacing')

insert_before_init_egl = '''    private fun initEgl() {\n'''
perf_methods = '''    private fun publishPerformance(nowNs: Long, width: Int, height: Int, force: Boolean, renderNs: Long = 0L) {\n        if (perfWindowStartNs == 0L) perfWindowStartNs = nowNs\n        if (perfLastFrameStartNs != 0L && perfIntervalCount < perfIntervalsNs.size) {\n            perfIntervalsNs[perfIntervalCount++] = (nowNs - perfLastFrameStartNs).coerceAtLeast(0L)\n        }\n        perfLastFrameStartNs = nowNs\n        if (renderNs > 0L) {\n            perfRenderTotalNs += renderNs\n            perfFrameCount++\n        }\n        val elapsed = nowNs - perfWindowStartNs\n        if (!force && elapsed < 3_000_000_000L) return\n        if (perfFrameCount <= 0 || elapsed <= 0L) return\n        val intervals = perfIntervalsNs.copyOf(perfIntervalCount)\n        intervals.sort()\n        val averageIntervalNs = if (intervals.isNotEmpty()) intervals.sum() / intervals.size else 0L\n        val p95Index = if (intervals.isNotEmpty()) ((intervals.size - 1) * .95f).toInt().coerceIn(0, intervals.lastIndex) else 0\n        val p95Ns = if (intervals.isNotEmpty()) intervals[p95Index] else 0L\n        val fpsX100 = ((perfFrameCount * 100.0 * 1_000_000_000.0) / elapsed).toInt().coerceAtLeast(0)\n        val frameMsX100 = (averageIntervalNs / 10_000L).toInt().coerceAtLeast(0)\n        val p95MsX100 = (p95Ns / 10_000L).toInt().coerceAtLeast(0)\n        val renderMsX100 = ((perfRenderTotalNs / perfFrameCount) / 10_000L).toInt().coerceAtLeast(0)\n        prefs.edit()\n            .putInt(BettaSettings.KEY_PERF_FPS_X100, fpsX100)\n            .putInt(BettaSettings.KEY_PERF_FRAME_MS_X100, frameMsX100)\n            .putInt(BettaSettings.KEY_PERF_P95_MS_X100, p95MsX100)\n            .putInt(BettaSettings.KEY_PERF_RENDER_MS_X100, renderMsX100)\n            .putString(BettaSettings.KEY_PERF_SURFACE, "${width}×${height}")\n            .apply()\n        resetPerformanceWindow(nowNs)\n    }\n\n    private fun resetPerformanceWindow(startNs: Long = 0L) {\n        perfWindowStartNs = startNs\n        perfLastFrameStartNs = 0L\n        perfFrameCount = 0\n        perfRenderTotalNs = 0L\n        perfIntervalCount = 0\n    }\n\n'''
replace_once(service, insert_before_init_egl, perf_methods + insert_before_init_egl, 'performance telemetry methods')

replace_once(
    service,
    '''        val glVersion = GLES30.glGetString(GLES30.GL_VERSION).orEmpty()\n        require(glVersion.contains("OpenGL ES 3")) { "Expected OpenGL ES 3, got '$glVersion'" }\n        Log.i(TAG, "Wallpaper EGL ready: EGL ${versions[0]}.${versions[1]}, $glVersion")\n''',
    '''        val glVersion = GLES30.glGetString(GLES30.GL_VERSION).orEmpty()\n        val glRenderer = GLES30.glGetString(GLES30.GL_RENDERER).orEmpty()\n        require(glVersion.contains("OpenGL ES 3")) { "Expected OpenGL ES 3, got '$glVersion'" }\n        prefs.edit()\n            .putString(BettaSettings.KEY_GL_RENDERER, glRenderer)\n            .putString(BettaSettings.KEY_GL_VERSION, glVersion)\n            .apply()\n        Log.i(TAG, "Wallpaper EGL ready: EGL ${versions[0]}.${versions[1]}, $glVersion, $glRenderer")\n''',
    'GL telemetry',
)

# Settings UI: show measured frame pacing after a preview run.
activity = root / 'app/src/main/java/com/sindhornmidtown/betta/MainActivity.kt'
replace_once(
    activity,
    '    private lateinit var diagnosticText: TextView\n',
    '    private lateinit var diagnosticText: TextView\n    private lateinit var performanceText: TextView\n',
    'activity performance field',
)
marker = '''        root.addView(diagnosticText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(22) })\n\n        val preview = button("Preview / Set Live Wallpaper") { openWallpaperPreview() }\n'''
replacement = '''        root.addView(diagnosticText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(18) })\n\n        root.addView(label("PERFORMANCE DIAGNOSTIC"))\n        performanceText = text("Run the wallpaper for a few seconds, then return here.", 13f, Color.rgb(183, 177, 193)).apply {\n            setPadding(dp(14), dp(12), dp(14), dp(12))\n            background = panelDrawable()\n            setTextIsSelectable(true)\n        }\n        root.addView(performanceText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(22) })\n\n        val preview = button("Preview / Set Live Wallpaper") { openWallpaperPreview() }\n'''
replace_once(activity, marker, replacement, 'activity performance panel')
replace_once(
    activity,
    '        setContentView(scroll)\n        updateDiagnostic()\n',
    '        setContentView(scroll)\n        updateDiagnostic()\n        updatePerformanceDiagnostic()\n',
    'activity initial perf update',
)
replace_once(
    activity,
    '        if (::diagnosticText.isInitialized) updateDiagnostic()\n',
    '        if (::diagnosticText.isInitialized) updateDiagnostic()\n        if (::performanceText.isInitialized) updatePerformanceDiagnostic()\n',
    'activity resume perf update',
)
insert_before_preview = '''    private fun openWallpaperPreview() {\n'''
perf_ui = '''    private fun updatePerformanceDiagnostic() {\n        val fpsX100 = prefs.getInt(BettaSettings.KEY_PERF_FPS_X100, -1)\n        if (fpsX100 < 0) {\n            performanceText.text = "Run the wallpaper for at least 3 seconds, then return here. Metrics are measured on the native wallpaper surface."\n            return\n        }\n        fun metric(key: String): String {\n            val value = prefs.getInt(key, 0)\n            return String.format(java.util.Locale.US, "%.2f", value / 100.0)\n        }\n        val fps = String.format(java.util.Locale.US, "%.2f", fpsX100 / 100.0)\n        val surface = prefs.getString(BettaSettings.KEY_PERF_SURFACE, "unknown surface")\n        val gpu = prefs.getString(BettaSettings.KEY_GL_RENDERER, "unknown GPU")\n        val gl = prefs.getString(BettaSettings.KEY_GL_VERSION, "")\n        performanceText.text = "$fps fps · avg ${metric(BettaSettings.KEY_PERF_FRAME_MS_X100)} ms · p95 ${metric(BettaSettings.KEY_PERF_P95_MS_X100)} ms\\nRender submit ${metric(BettaSettings.KEY_PERF_RENDER_MS_X100)} ms · $surface\\n$gpu${if (gl.isNullOrBlank()) "" else " · $gl"}"\n    }\n\n'''
replace_once(activity, insert_before_preview, perf_ui + insert_before_preview, 'activity perf updater')

# Bump build version.
gradle = root / 'app/build.gradle.kts'
text = gradle.read_text()
text = text.replace('versionCode = 5', 'versionCode = 6').replace('versionName = "0.1.4"', 'versionName = "0.1.5"')
if 'versionCode = 6' not in text or 'versionName = "0.1.5"' not in text:
    raise SystemExit('version bump failed')
gradle.write_text(text)

# Permanent CI performance contract.
perf_guard = root / 'tools/verify_performance_contract.py'
perf_guard.write_text('''from pathlib import Path\n\nservice = Path("android-betta-wallpaper/app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaWallpaperService.kt").read_text()\nrenderer = Path("android-betta-wallpaper/app/src/main/java/com/sindhornmidtown/betta/wallpaper/BettaRenderer.kt").read_text()\nrequired_service = [\n    "setSurfaceSize",\n    "setMotionTargets",\n    "notifySettingsChanged",\n    "LockSupport.parkNanos",\n    "publishPerformance",\n]\nforbidden_service = [\n    "tiltSource: () -> Triple",\n    "val (targetX, targetY, page) = tiltSource()",\n    "EGL14.eglQuerySurface",\n    "SystemClock.sleep",\n]\nrequired_renderer = [\n    "cachedMotionMultiplier",\n    "nextTargetCheckNs",\n    "setPresetUniformsIfNeeded",\n    "updateViewport(width, height)",\n    "GLES30.glDisable(GLES30.GL_BLEND)",\n]\nmissing = [x for x in required_service if x not in service] + [x for x in required_renderer if x not in renderer]\nforbidden = [x for x in forbidden_service if x in service]\nif missing or forbidden:\n    raise SystemExit(f"Android performance contract failed; missing={missing}, forbidden={forbidden}")\nprint("Android performance contract: OK")\n''')

# Workflow version + performance guard.
workflow = Path('.github/workflows/android-betta-wallpaper.yml')
y = workflow.read_text()
y = y.replace("'version':'0.1.4'", "'version':'0.1.5'")
y = y.replace("assert d['version'] == '0.1.4'", "assert d['version'] == '0.1.5'")
marker = '      - name: Build debug APK\n'
if marker not in y:
    raise SystemExit('workflow build marker not found')
y = y.replace(marker, '      - name: Guard Android performance contract\n        run: python3 android-betta-wallpaper/tools/verify_performance_contract.py\n\n' + marker, 1)
workflow.write_text(y)

print('Android Betta 0.1.5 performance audit patch applied')
