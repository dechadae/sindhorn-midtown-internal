package com.sindhornmidtown.betta

import android.content.Context

object BettaSettings {
    const val PREFS = "sindhorn_betta_wallpaper"
    const val KEY_MODE = "mode"
    const val KEY_MANUAL_INDEX = "manual_index"
    const val KEY_TILT = "tilt"
    const val KEY_TILT_STRENGTH = "tilt_strength"
    const val KEY_MOTION = "motion"
    const val KEY_RENDERER_STATUS = "renderer_status"
    const val KEY_RENDERER_ERROR = "renderer_error"
    const val KEY_PERF_FPS_X100 = "perf_fps_x100"
    const val KEY_PERF_FRAME_MS_X100 = "perf_frame_ms_x100"
    const val KEY_PERF_P95_MS_X100 = "perf_p95_ms_x100"
    const val KEY_PERF_RENDER_MS_X100 = "perf_render_ms_x100"
    const val KEY_PERF_SURFACE = "perf_surface"
    const val KEY_GL_RENDERER = "gl_renderer"
    const val KEY_GL_VERSION = "gl_version"

    const val MODE_LIVE = "live"
    const val MODE_MANUAL = "manual"

    fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
