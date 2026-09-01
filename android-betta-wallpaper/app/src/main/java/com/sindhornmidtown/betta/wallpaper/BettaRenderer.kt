package com.sindhornmidtown.betta.wallpaper

import android.content.SharedPreferences
import android.opengl.GLES30
import android.opengl.Matrix
import com.sindhornmidtown.betta.BettaSettings
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.math.PI
import kotlin.math.sin

class BettaRenderer(private val prefs: SharedPreferences) {
    companion object {
        private const val RAYS = 80
        private const val RADIAL_SEGMENTS = 72
        private const val FLOAT_BYTES = 4
        private const val STRIDE = 3 * FLOAT_BYTES
        private val BANGKOK = ZoneId.of("Asia/Bangkok")
    }

    private var backgroundProgram = 0
    private var finProgram = 0
    private var vao = 0
    private var vbo = 0
    private var ebo = 0
    private var indexCount = 0
    private var activeTimeSeconds = 0f
    private var fromIndex = 0
    private var toIndex = 0
    private var transitionStartNs = 0L
    private var transitionDurationNs = 0L
    private var firstTarget = true
    private var reportedFirstFrame = false
    private val bgLocations = HashMap<String, Int>()
    private val finLocations = HashMap<String, Int>()

    private val model = FloatArray(16)
    private val view = FloatArray(16)
    private val proj = FloatArray(16)
    private val viewProj = FloatArray(16)

    private val satelliteEnergy = .58f
    private val satelliteCloud = .35f
    private val satelliteCold = .35f
    private val satelliteCooling = 0f
    private val satelliteTexture = .32f
    private val satelliteVapor = .42f
    private val satelliteVisible = 0f
    private val satelliteColor = floatArrayOf(.18f, .23f, .52f)
    private val satelliteFingerprint = floatArrayOf(.5f, .5f, .5f)

    fun onSurfaceCreated() {
        recordStatus("background-shader")
        backgroundProgram = link("background", BettaShaders.BACKGROUND_VERTEX, BettaShaders.BACKGROUND_FRAGMENT)
        recordStatus("fin-shader")
        finProgram = link("fin", BettaShaders.FIN_VERTEX, BettaShaders.FIN_FRAGMENT)
        recordStatus("geometry")
        createGeometry()
        checkGl("geometry")
        GLES30.glDisable(GLES30.GL_CULL_FACE)
        GLES30.glDisable(GLES30.GL_DITHER)
        GLES30.glEnable(GLES30.GL_BLEND)
        GLES30.glBlendFunc(GLES30.GL_SRC_ALPHA, GLES30.GL_ONE_MINUS_SRC_ALPHA)
        checkGl("renderer-state")
        activeTimeSeconds = 0f
        val initial = desiredIndex()
        fromIndex = initial
        toIndex = initial
        firstTarget = false
        recordStatus("ready")
    }

    fun release() {
        if (vao != 0) GLES30.glDeleteVertexArrays(1, intArrayOf(vao), 0)
        if (vbo != 0) GLES30.glDeleteBuffers(1, intArrayOf(vbo), 0)
        if (ebo != 0) GLES30.glDeleteBuffers(1, intArrayOf(ebo), 0)
        if (backgroundProgram != 0) GLES30.glDeleteProgram(backgroundProgram)
        if (finProgram != 0) GLES30.glDeleteProgram(finProgram)
        vao = 0; vbo = 0; ebo = 0; backgroundProgram = 0; finProgram = 0
    }

    fun draw(width: Int, height: Int, nowNs: Long, deltaSeconds: Float, tiltX: Float, tiltY: Float) {
        if (width <= 0 || height <= 0 || finProgram == 0) return
        updateTarget(nowNs)
        val e = transitionMix(nowNs)
        val from = BettaPresets.all[fromIndex]
        val to = BettaPresets.all[toIndex]
        val aspect = width.toFloat() / height.toFloat()
        val cameraZ = if (aspect < .7f) 10.4f else 9f

        GLES30.glViewport(0, 0, width, height)
        GLES30.glDisable(GLES30.GL_DEPTH_TEST)
        drawBackground(from, to, e)

        Matrix.perspectiveM(proj, 0, 32f, aspect, .1f, 50f)
        Matrix.setLookAtM(view, 0, 0f, 0f, cameraZ, 0f, 0f, 0f, 0f, 1f, 0f)
        Matrix.multiplyMM(viewProj, 0, proj, 0, view, 0)

        GLES30.glUseProgram(finProgram)
        uniformMatrix("uViewProj", viewProj)
        uniform3("uCameraPosition", 0f, 0f, cameraZ)
        activeTimeSeconds += deltaSeconds.coerceIn(0f, .05f) * motionMultiplier()
        uniform1("uTime", activeTimeSeconds)
        setSatelliteUniforms()
        GLES30.glBindVertexArray(vao)
        for (layerIndex in 0..1) drawLayer(from, to, e, layerIndex, tiltX, tiltY)
        GLES30.glBindVertexArray(0)

        if (!reportedFirstFrame) {
            checkGl("first-draw")
            reportedFirstFrame = true
            recordStatus("running")
        }
    }

    private fun drawBackground(from: BettaPreset, to: BettaPreset, e: Float) {
        GLES30.glUseProgram(backgroundProgram)
        for (i in 0..2) {
            uniform3Bg("uBg${i}From", from.background[i])
            uniform3Bg("uBg${i}To", to.background[i])
        }
        uniform1Bg("uMix", e)
        uniform3Bg("uSatelliteColor", satelliteColor)
        uniform1Bg("uSatelliteMix", .025f + .025f * satelliteCloud + .018f * satelliteVisible)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)
    }

    private fun drawLayer(from: BettaPreset, to: BettaPreset, e: Float, layerIndex: Int, tiltX: Float, tiltY: Float) {
        val a = from.params
        val b = to.params
        val la = from.layers[layerIndex]
        val lb = to.layers[layerIndex]

        fun p(x: Float, y: Float) = lerp(x, y, e)
        uniform1("uSeed", p(la.seed, lb.seed))
        uniform1("uPhase", p(la.phase, lb.phase))
        uniform1("uSpread", p(a.spread, b.spread))
        uniform1("uFoldDensity", p(a.foldDensity, b.foldDensity))
        uniform1("uCurl", p(a.curl, b.curl))
        uniform1("uTwist", p(a.twist, b.twist))
        uniform1("uEdgeFlutter", p(a.edgeFlutter, b.edgeFlutter))
        uniform1("uDepth", p(a.depth, b.depth))
        uniform1("uCurrentStrength", p(a.currentStrength, b.currentStrength))
        uniform1("uMotionSpeed", p(a.motionSpeed, b.motionSpeed))
        uniform1("uTurbulence", p(a.turbulence, b.turbulence))
        uniform1("uMotionAmplitude", p(a.motionAmplitude, b.motionAmplitude))
        uniform1("uOpacity", p(a.opacity, b.opacity))
        uniform1("uTransmission", p(a.transmission, b.transmission))
        uniform1("uRimStrength", p(a.rimStrength, b.rimStrength))
        uniform1("uFoldHighlight", p(a.foldHighlight, b.foldHighlight))
        uniform1("uIridescence", p(a.iridescence, b.iridescence))
        uniform1("uBloom", p(a.bloom, b.bloom))
        uniform1("uSaturation", p(a.saturation, b.saturation))
        uniform1("uBrightness", p(a.brightness, b.brightness))
        uniform1("uGradientPosition", p(a.gradientPosition, b.gradientPosition))
        uniform1("uLayerAlpha", p(la.alpha, lb.alpha))
        uniform1("uMorphModeFrom", from.morphMode)
        uniform1("uMorphModeTo", to.morphMode)
        uniform1("uMorphTransition", e)
        for (i in 0..3) {
            uniform3("uColor${i}From", from.palette[i])
            uniform3("uColor${i}To", to.palette[i])
        }

        val tiltEnabled = prefs.getBoolean(BettaSettings.KEY_TILT, true)
        val globalTilt = prefs.getInt(BettaSettings.KEY_TILT_STRENGTH, 100).coerceIn(0, 160) / 100f
        val layerTilt = if (layerIndex == 0) 1f else .82f
        val tiltStrength = p(a.tiltStrength, b.tiltStrength) * globalTilt * layerTilt
        val rx = lerpAngle(a.rotationX, b.rotationX, e) + if (tiltEnabled) tiltX * tiltStrength else 0f
        val ry = lerpAngle(a.rotationY, b.rotationY, e) + if (tiltEnabled) tiltY * tiltStrength else 0f
        val rz = lerpAngle(a.rotation + la.rotation, b.rotation + lb.rotation, e) + if (tiltEnabled) tiltY * tiltStrength * .12f else 0f
        val x = p(a.offsetX + la.offsetX, b.offsetX + lb.offsetX)
        val y = p(a.offsetY + la.offsetY, b.offsetY + lb.offsetY)
        val z = p(a.cameraDepth + la.offsetZ, b.cameraDepth + lb.offsetZ) + if (tiltEnabled) tiltX * tiltStrength * .18f else 0f
        val scale = p(a.scale * la.scale, b.scale * lb.scale)

        Matrix.setIdentityM(model, 0)
        Matrix.translateM(model, 0, x, y, z)
        Matrix.rotateM(model, 0, radToDeg(ry), 0f, 1f, 0f)
        Matrix.rotateM(model, 0, radToDeg(rx), 1f, 0f, 0f)
        Matrix.rotateM(model, 0, radToDeg(rz), 0f, 0f, 1f)
        Matrix.scaleM(model, 0, scale, scale, scale)
        uniformMatrix("uModel", model)

        GLES30.glDrawElements(GLES30.GL_TRIANGLES, indexCount, GLES30.GL_UNSIGNED_SHORT, 0)
    }

    private fun setSatelliteUniforms() {
        uniform1("uSatelliteEnergy", satelliteEnergy)
        uniform1("uSatelliteCloud", satelliteCloud)
        uniform1("uSatelliteCold", satelliteCold)
        uniform1("uSatelliteCooling", satelliteCooling)
        uniform1("uSatelliteTexture", satelliteTexture)
        uniform1("uSatelliteVapor", satelliteVapor)
        uniform1("uSatelliteVisible", satelliteVisible)
        uniform2("uCurrent", 0f, 0f)
        uniform2("uSatelliteMotion", 0f, 0f)
        uniform3("uSatelliteColor", satelliteColor)
        uniform3("uSatelliteFingerprint", satelliteFingerprint)
    }

    private fun updateTarget(nowNs: Long) {
        val desired = desiredIndex()
        if (firstTarget) {
            fromIndex = desired; toIndex = desired; firstTarget = false; return
        }
        if (desired == toIndex) return
        fromIndex = toIndex
        toIndex = desired
        transitionStartNs = nowNs
        transitionDurationNs = if (prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE) == BettaSettings.MODE_LIVE) 60_000_000_000L else 900_000_000L
    }

    private fun desiredIndex(): Int {
        return if (prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE) == BettaSettings.MODE_MANUAL) {
            prefs.getInt(BettaSettings.KEY_MANUAL_INDEX, 0).coerceIn(0, BettaPresets.all.lastIndex)
        } else {
            (ZonedDateTime.now(BANGKOK).hour / 3).coerceIn(0, 7)
        }
    }

    private fun transitionMix(nowNs: Long): Float {
        if (fromIndex == toIndex || transitionDurationNs <= 0L) return 1f
        val raw = ((nowNs - transitionStartNs).toDouble() / transitionDurationNs.toDouble()).coerceIn(0.0, 1.0).toFloat()
        val eased = 1f - (1f - raw) * (1f - raw) * (1f - raw)
        if (raw >= 1f) { fromIndex = toIndex; transitionDurationNs = 0L }
        return eased
    }

    private fun motionMultiplier(): Float = prefs.getInt(BettaSettings.KEY_MOTION, 100).coerceIn(20, 160) / 100f

    private fun createGeometry() {
        val vertices = FloatArray((RAYS + 1) * (RADIAL_SEGMENTS + 1) * 3)
        var cursor = 0
        val jitters = FloatArray(RAYS + 1)
        for (j in 0..RAYS) {
            val n = sin((j + 1) * 12.9898 + 78.233) * 43758.5453
            val m = sin((j + 7) * 4.123 + 21.731) * 15731.743
            jitters[j] = (((n - kotlin.math.floor(n)) - .5) * 1.4 + ((m - kotlin.math.floor(m)) - .5) * .6).toFloat()
            for (i in 0..RADIAL_SEGMENTS) {
                vertices[cursor++] = i.toFloat() / RADIAL_SEGMENTS
                vertices[cursor++] = j.toFloat() / RAYS
                vertices[cursor++] = jitters[j]
            }
        }
        val indices = ShortArray(RAYS * RADIAL_SEGMENTS * 6)
        cursor = 0
        val row = RADIAL_SEGMENTS + 1
        for (j in 0 until RAYS) for (i in 0 until RADIAL_SEGMENTS) {
            val a = j * row + i
            val b = a + row
            indices[cursor++] = a.toShort(); indices[cursor++] = b.toShort(); indices[cursor++] = (a + 1).toShort()
            indices[cursor++] = b.toShort(); indices[cursor++] = (b + 1).toShort(); indices[cursor++] = (a + 1).toShort()
        }
        indexCount = indices.size
        val vertexBuffer: FloatBuffer = ByteBuffer.allocateDirect(vertices.size * FLOAT_BYTES).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(vertices); position(0) }
        val indexBuffer: ShortBuffer = ByteBuffer.allocateDirect(indices.size * 2).order(ByteOrder.nativeOrder()).asShortBuffer().apply { put(indices); position(0) }
        val ids = IntArray(1)
        GLES30.glGenVertexArrays(1, ids, 0); vao = ids[0]
        GLES30.glGenBuffers(1, ids, 0); vbo = ids[0]
        GLES30.glGenBuffers(1, ids, 0); ebo = ids[0]
        GLES30.glBindVertexArray(vao)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo)
        GLES30.glBufferData(GLES30.GL_ARRAY_BUFFER, vertices.size * FLOAT_BYTES, vertexBuffer, GLES30.GL_STATIC_DRAW)
        GLES30.glBindBuffer(GLES30.GL_ELEMENT_ARRAY_BUFFER, ebo)
        GLES30.glBufferData(GLES30.GL_ELEMENT_ARRAY_BUFFER, indices.size * 2, indexBuffer, GLES30.GL_STATIC_DRAW)
        for (i in 0..2) {
            GLES30.glEnableVertexAttribArray(i)
            GLES30.glVertexAttribPointer(i, 1, GLES30.GL_FLOAT, false, STRIDE, i * FLOAT_BYTES)
        }
        GLES30.glBindVertexArray(0)
    }

    private fun link(label: String, vertexSource: String, fragmentSource: String): Int {
        val vertex = compile("$label vertex", GLES30.GL_VERTEX_SHADER, vertexSource)
        val fragment = compile("$label fragment", GLES30.GL_FRAGMENT_SHADER, fragmentSource)
        val program = GLES30.glCreateProgram()
        GLES30.glAttachShader(program, vertex)
        GLES30.glAttachShader(program, fragment)
        GLES30.glLinkProgram(program)
        val status = IntArray(1)
        GLES30.glGetProgramiv(program, GLES30.GL_LINK_STATUS, status, 0)
        if (status[0] == 0) {
            val message = "$label program link failed: ${GLES30.glGetProgramInfoLog(program)}"
            recordFailure(message)
            throw IllegalStateException(message)
        }
        GLES30.glDeleteShader(vertex)
        GLES30.glDeleteShader(fragment)
        checkGl("$label-link")
        return program
    }

    private fun compile(label: String, type: Int, originalSource: String): Int {
        val source = compatibilitySource(originalSource).trimStart()
        val shader = GLES30.glCreateShader(type)
        GLES30.glShaderSource(shader, source)
        GLES30.glCompileShader(shader)
        val status = IntArray(1)
        GLES30.glGetShaderiv(shader, GLES30.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val driver = GLES30.glGetString(GLES30.GL_RENDERER).orEmpty()
            val sl = GLES30.glGetString(GLES30.GL_SHADING_LANGUAGE_VERSION).orEmpty()
            val message = "$label shader compile failed on $driver / $sl: ${GLES30.glGetShaderInfoLog(shader)}"
            recordFailure(message)
            throw IllegalStateException(message)
        }
        return shader
    }

    private fun compatibilitySource(source: String): String {
        var out = source
        out = out.replace(
            "const vec2 P[3] = vec2[](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));",
            "// Samsung-safe fullscreen triangle: avoid array constructors in the vertex shader."
        )
        out = out.replace(
            "vec2 p=P[gl_VertexID];",
            "vec2 p; if(gl_VertexID==0) p=vec2(-1.0,-1.0); else if(gl_VertexID==1) p=vec2(3.0,-1.0); else p=vec2(-1.0,3.0);"
        )
        out = out.replace(
            "return vec3(\n            c.r<=.0031308?c.r*12.92:1.055*pow(c.r,1.0/2.4)-.055,\n            c.g<=.0031308?c.g*12.92:1.055*pow(c.g,1.0/2.4)-.055,\n            c.b<=.0031308?c.b*12.92:1.055*pow(c.b,1.0/2.4)-.055\n          );",
            "vec3 low=c*12.92; vec3 high=1.055*pow(c,vec3(1.0/2.4))-.055; return mix(low,high,step(vec3(.0031308),c));"
        )
        return out
    }

    private fun checkGl(stage: String) {
        var error = GLES30.glGetError()
        if (error == GLES30.GL_NO_ERROR) return
        val values = ArrayList<String>()
        while (error != GLES30.GL_NO_ERROR) {
            values += "0x${error.toString(16)}"
            error = GLES30.glGetError()
        }
        val message = "$stage GL error: ${values.joinToString()}"
        recordFailure(message)
        throw IllegalStateException(message)
    }

    private fun recordStatus(status: String) {
        prefs.edit()
            .putString(BettaSettings.KEY_RENDERER_STATUS, status)
            .remove(BettaSettings.KEY_RENDERER_ERROR)
            .apply()
    }

    private fun recordFailure(message: String) {
        prefs.edit()
            .putString(BettaSettings.KEY_RENDERER_STATUS, "failed")
            .putString(BettaSettings.KEY_RENDERER_ERROR, message.take(1800))
            .apply()
    }

    private fun finLoc(name: String) = finLocations.getOrPut(name) { GLES30.glGetUniformLocation(finProgram, name) }
    private fun bgLoc(name: String) = bgLocations.getOrPut(name) { GLES30.glGetUniformLocation(backgroundProgram, name) }
    private fun uniform1(name: String, value: Float) = GLES30.glUniform1f(finLoc(name), value)
    private fun uniform2(name: String, x: Float, y: Float) = GLES30.glUniform2f(finLoc(name), x, y)
    private fun uniform3(name: String, x: Float, y: Float, z: Float) = GLES30.glUniform3f(finLoc(name), x, y, z)
    private fun uniform3(name: String, value: FloatArray) = uniform3(name, value[0], value[1], value[2])
    private fun uniformMatrix(name: String, value: FloatArray) = GLES30.glUniformMatrix4fv(finLoc(name), 1, false, value, 0)
    private fun uniform1Bg(name: String, value: Float) = GLES30.glUniform1f(bgLoc(name), value)
    private fun uniform3Bg(name: String, value: FloatArray) = GLES30.glUniform3f(bgLoc(name), value[0], value[1], value[2])

    private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t
    private fun lerpAngle(a: Float, b: Float, t: Float): Float {
        var d = (b - a) % (2f * PI.toFloat())
        if (d > PI) d -= 2f * PI.toFloat()
        if (d < -PI) d += 2f * PI.toFloat()
        return a + d * t
    }
    private fun radToDeg(value: Float) = value * (180f / PI.toFloat())
}
