package com.sindhornmidtown.betta.wallpaper

import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES30
import java.util.concurrent.locks.LockSupport
import android.service.wallpaper.WallpaperService
import android.util.Log
import android.view.Surface
import android.view.SurfaceHolder
import com.sindhornmidtown.betta.BettaSettings

private const val TAG = "SindhornBettaGL"

class BettaWallpaperService : WallpaperService() {
    override fun onCreateEngine(): Engine = BettaEngine()

    inner class BettaEngine : Engine(), SensorEventListener, SharedPreferences.OnSharedPreferenceChangeListener {
        private val prefs by lazy { BettaSettings.prefs(this@BettaWallpaperService) }
        private val sensorManager by lazy { getSystemService(SENSOR_SERVICE) as SensorManager }
        private val rotationSensor by lazy {
            sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
                ?: sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        }
        private var renderThread: BettaRenderThread? = null
        private var visible = false
        private var calibrated = false
        private var pitch0 = 0f
        private var roll0 = 0f
        private var targetTiltX = 0f
        private var targetTiltY = 0f
        private var pageOffset = 0f
        private val rotationMatrix = FloatArray(9)
        private val orientation = FloatArray(3)

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            setTouchEventsEnabled(false)
            prefs.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            unregisterTilt()
            renderThread?.shutdown()
            renderThread = null
            super.onDestroy()
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            renderThread?.shutdown()
            renderThread = BettaRenderThread(holder.surface, prefs).also {
                it.setSurfaceSize(holder.surfaceFrame.width(), holder.surfaceFrame.height())
                it.setMotionTargets(targetTiltX, targetTiltY, pageOffset)
                it.setWallpaperVisible(visible)
                it.start()
            }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            renderThread?.setSurfaceSize(width, height)
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            renderThread?.shutdown()
            renderThread = null
            super.onSurfaceDestroyed(holder)
        }

        override fun onVisibilityChanged(isVisible: Boolean) {
            visible = isVisible
            renderThread?.setWallpaperVisible(isVisible)
            if (isVisible) registerTilt() else unregisterTilt()
        }

        override fun onOffsetsChanged(
            xOffset: Float,
            yOffset: Float,
            xOffsetStep: Float,
            yOffsetStep: Float,
            xPixelOffset: Int,
            yPixelOffset: Int,
        ) {
            pageOffset = ((xOffset - .5f) * 2f).coerceIn(-1f, 1f)
            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)
        }

        override fun onSensorChanged(event: SensorEvent) {
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
            SensorManager.getOrientation(rotationMatrix, orientation)
            val pitch = orientation[1]
            val roll = orientation[2]
            if (!calibrated) {
                pitch0 = pitch
                roll0 = roll
                calibrated = true
            }
            targetTiltX = ((pitch - pitch0) / .42f).coerceIn(-1f, 1f)
            targetTiltY = ((roll - roll0) / .42f).coerceIn(-1f, 1f)
            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

        override fun onSharedPreferenceChanged(sharedPreferences: SharedPreferences?, key: String?) {
            renderThread?.notifySettingsChanged()
            if (key == BettaSettings.KEY_TILT && visible) {
                unregisterTilt()
                registerTilt()
            }
        }

        private fun registerTilt() {
            calibrated = false
            targetTiltX = 0f
            targetTiltY = 0f
            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)
            if (!prefs.getBoolean(BettaSettings.KEY_TILT, true)) return
            rotationSensor?.let {
                sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
            }
        }

        private fun unregisterTilt() {
            sensorManager.unregisterListener(this)
            calibrated = false
            targetTiltX = 0f
            targetTiltY = 0f
            renderThread?.setMotionTargets(targetTiltX, targetTiltY, pageOffset)
        }
    }
}

private class BettaRenderThread(
    private val surface: Surface,
    private val prefs: SharedPreferences,
) : Thread("SindhornBettaGL") {
    private val stateLock = Object()
    @Volatile private var running = true
    @Volatile private var wallpaperVisible = false
    @Volatile private var surfaceWidth = 0
    @Volatile private var surfaceHeight = 0
    @Volatile private var targetTiltX = 0f
    @Volatile private var targetTiltY = 0f
    @Volatile private var targetPage = 0f
    @Volatile private var settingsDirty = true
    private var currentTiltX = 0f
    private var currentTiltY = 0f
    private var currentPage = 0f
    private var perfWindowStartNs = 0L
    private var perfLastFrameStartNs = 0L
    private var perfFrameCount = 0
    private var perfRenderTotalNs = 0L
    private val perfIntervalsNs = LongArray(240)
    private var perfIntervalCount = 0

    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var context: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE
    private lateinit var renderer: BettaRenderer

    fun setWallpaperVisible(value: Boolean) {
        wallpaperVisible = value
        synchronized(stateLock) { stateLock.notifyAll() }
    }

    fun setSurfaceSize(width: Int, height: Int) {
        surfaceWidth = width.coerceAtLeast(0)
        surfaceHeight = height.coerceAtLeast(0)
        synchronized(stateLock) { stateLock.notifyAll() }
    }

    fun setMotionTargets(tiltX: Float, tiltY: Float, page: Float) {
        targetTiltX = tiltX
        targetTiltY = tiltY
        targetPage = page
    }

    fun notifySettingsChanged() {
        settingsDirty = true
        synchronized(stateLock) { stateLock.notifyAll() }
    }

    fun shutdown() {
        running = false
        synchronized(stateLock) { stateLock.notifyAll() }
        try { join(1500) } catch (_: InterruptedException) { interrupt() }
    }

    override fun run() {
        try {
            initEgl()

            // Put a non-black frame on screen immediately. This also gives us a visible
            // distinction between an EGL failure and a later shader/renderer failure.
            GLES30.glClearColor(.01f, .025f, .055f, 1f)
            GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
            EGL14.eglSwapBuffers(display, eglSurface)

            renderer = BettaRenderer(prefs)
            renderer.onSurfaceCreated()
            var lastNs = System.nanoTime()
            while (running) {
                if (!wallpaperVisible || !surface.isValid || surfaceWidth <= 0 || surfaceHeight <= 0) {
                    publishPerformance(System.nanoTime(), surfaceWidth, surfaceHeight, true)
                    resetPerformanceWindow()
                    synchronized(stateLock) {
                        if (running && (!wallpaperVisible || !surface.isValid || surfaceWidth <= 0 || surfaceHeight <= 0)) stateLock.wait(500)
                    }
                    lastNs = System.nanoTime()
                    continue
                }
                val now = System.nanoTime()
                val dt = ((now - lastNs).coerceAtMost(50_000_000L) / 1_000_000_000f)
                lastNs = now
                if (settingsDirty) {
                    renderer.refreshPreferences()
                    settingsDirty = false
                }
                val response = 1f - kotlin.math.exp((-dt * 10f).toDouble()).toFloat()
                currentTiltX += (targetTiltX - currentTiltX) * response
                currentTiltY += (targetTiltY - currentTiltY) * response
                currentPage += (targetPage - currentPage) * response

                val width = surfaceWidth
                val height = surfaceHeight
                val pageParallax = currentPage * .16f
                renderer.draw(width, height, now, dt, currentTiltX, currentTiltY + pageParallax)
                val drawEndNs = System.nanoTime()
                if (!EGL14.eglSwapBuffers(display, eglSurface)) {
                    Log.e(TAG, "eglSwapBuffers failed: 0x${EGL14.eglGetError().toString(16)}")
                    break
                }
                publishPerformance(now, width, height, false, drawEndNs - now)
                val frameElapsedNs = System.nanoTime() - now
                val remainingNs = 16_666_667L - frameElapsedNs
                if (remainingNs > 100_000L) LockSupport.parkNanos(remainingNs)
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Betta wallpaper renderer failed", error)
            showFailureFrame()
        } finally {
            if (::renderer.isInitialized) renderer.release()
            releaseEgl()
        }
    }

    private fun publishPerformance(nowNs: Long, width: Int, height: Int, force: Boolean, renderNs: Long = 0L) {
        if (perfWindowStartNs == 0L) perfWindowStartNs = nowNs
        if (perfLastFrameStartNs != 0L && perfIntervalCount < perfIntervalsNs.size) {
            perfIntervalsNs[perfIntervalCount++] = (nowNs - perfLastFrameStartNs).coerceAtLeast(0L)
        }
        perfLastFrameStartNs = nowNs
        if (renderNs > 0L) {
            perfRenderTotalNs += renderNs
            perfFrameCount++
        }
        val elapsed = nowNs - perfWindowStartNs
        if (!force && elapsed < 3_000_000_000L) return
        if (perfFrameCount <= 0 || elapsed <= 0L) return
        val intervals = perfIntervalsNs.copyOf(perfIntervalCount)
        intervals.sort()
        val averageIntervalNs = if (intervals.isNotEmpty()) intervals.sum() / intervals.size else 0L
        val p95Index = if (intervals.isNotEmpty()) ((intervals.size - 1) * .95f).toInt().coerceIn(0, intervals.lastIndex) else 0
        val p95Ns = if (intervals.isNotEmpty()) intervals[p95Index] else 0L
        val fpsX100 = ((perfFrameCount * 100.0 * 1_000_000_000.0) / elapsed).toInt().coerceAtLeast(0)
        val frameMsX100 = (averageIntervalNs / 10_000L).toInt().coerceAtLeast(0)
        val p95MsX100 = (p95Ns / 10_000L).toInt().coerceAtLeast(0)
        val renderMsX100 = ((perfRenderTotalNs / perfFrameCount) / 10_000L).toInt().coerceAtLeast(0)
        prefs.edit()
            .putInt(BettaSettings.KEY_PERF_FPS_X100, fpsX100)
            .putInt(BettaSettings.KEY_PERF_FRAME_MS_X100, frameMsX100)
            .putInt(BettaSettings.KEY_PERF_P95_MS_X100, p95MsX100)
            .putInt(BettaSettings.KEY_PERF_RENDER_MS_X100, renderMsX100)
            .putString(BettaSettings.KEY_PERF_SURFACE, "${width}×${height}")
            .apply()
        resetPerformanceWindow(nowNs)
    }

    private fun resetPerformanceWindow(startNs: Long = 0L) {
        perfWindowStartNs = startNs
        perfLastFrameStartNs = 0L
        perfFrameCount = 0
        perfRenderTotalNs = 0L
        perfIntervalCount = 0
    }

    private fun initEgl() {
        display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        require(display != EGL14.EGL_NO_DISPLAY) { "No EGL display" }
        val versions = IntArray(2)
        require(EGL14.eglInitialize(display, versions, 0, versions, 1)) {
            "EGL init failed: 0x${EGL14.eglGetError().toString(16)}"
        }
        require(EGL14.eglBindAPI(EGL14.EGL_OPENGL_ES_API)) {
            "eglBindAPI failed: 0x${EGL14.eglGetError().toString(16)}"
        }

        // Android EGL14 does not expose an EGL_OPENGL_ES3_BIT constant. Selecting
        // an ES2-capable window config and then requesting client version 3 is the
        // portable Android path for an OpenGL ES 3 context.
        val attribs = intArrayOf(
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_NONE,
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val count = IntArray(1)
        require(EGL14.eglChooseConfig(display, attribs, 0, configs, 0, 1, count, 0) && count[0] > 0) {
            "No compatible window config: 0x${EGL14.eglGetError().toString(16)}"
        }
        val config = requireNotNull(configs[0]) { "EGL config missing" }
        context = EGL14.eglCreateContext(
            display,
            config,
            EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 3, EGL14.EGL_NONE),
            0,
        )
        require(context != EGL14.EGL_NO_CONTEXT) {
            "GLES3 context failed: 0x${EGL14.eglGetError().toString(16)}"
        }
        eglSurface = EGL14.eglCreateWindowSurface(display, config, surface, intArrayOf(EGL14.EGL_NONE), 0)
        require(eglSurface != EGL14.EGL_NO_SURFACE) {
            "Wallpaper EGL surface failed: 0x${EGL14.eglGetError().toString(16)}"
        }
        require(EGL14.eglMakeCurrent(display, eglSurface, eglSurface, context)) {
            "eglMakeCurrent failed: 0x${EGL14.eglGetError().toString(16)}"
        }
        EGL14.eglSwapInterval(display, 1)

        val glVersion = GLES30.glGetString(GLES30.GL_VERSION).orEmpty()
        val glRenderer = GLES30.glGetString(GLES30.GL_RENDERER).orEmpty()
        require(glVersion.contains("OpenGL ES 3")) { "Expected OpenGL ES 3, got '$glVersion'" }
        prefs.edit()
            .putString(BettaSettings.KEY_GL_RENDERER, glRenderer)
            .putString(BettaSettings.KEY_GL_VERSION, glVersion)
            .apply()
        Log.i(TAG, "Wallpaper EGL ready: EGL ${versions[0]}.${versions[1]}, $glVersion, $glRenderer")
    }

    private fun showFailureFrame() {
        if (display == EGL14.EGL_NO_DISPLAY || eglSurface == EGL14.EGL_NO_SURFACE || context == EGL14.EGL_NO_CONTEXT) return
        try {
            GLES30.glClearColor(.12f, .012f, .08f, 1f)
            GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
            EGL14.eglSwapBuffers(display, eglSurface)
        } catch (_: Throwable) {
            // Nothing else is safe to do here; Logcat already contains the root failure.
        }
    }

    private fun releaseEgl() {
        if (display != EGL14.EGL_NO_DISPLAY) {
            EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
            if (eglSurface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(display, eglSurface)
            if (context != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(display, context)
            EGL14.eglTerminate(display)
        }
        eglSurface = EGL14.EGL_NO_SURFACE
        context = EGL14.EGL_NO_CONTEXT
        display = EGL14.EGL_NO_DISPLAY
    }
}
