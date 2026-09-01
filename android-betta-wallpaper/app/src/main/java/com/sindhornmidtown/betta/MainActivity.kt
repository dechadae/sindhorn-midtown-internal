package com.sindhornmidtown.betta

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import com.sindhornmidtown.betta.wallpaper.BettaPresets
import com.sindhornmidtown.betta.wallpaper.BettaWallpaperService

class MainActivity : Activity() {
    private val prefs by lazy { BettaSettings.prefs(this) }
    private lateinit var diagnosticText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(11, 9, 16)
        window.navigationBarColor = Color.rgb(11, 9, 16)

        val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(11, 9, 16)) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(30), dp(24), dp(36))
        }
        scroll.addView(root, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        root.addView(text("SINDHORN BETTA", 13f, Color.rgb(226, 214, 181)).apply { letterSpacing = .08f })
        root.addView(text("Live Wallpaper", 34f, Color.WHITE).apply { setPadding(0, dp(7), 0, 0) })
        root.addView(text("The final procedural Betta engine, running natively behind your Android launcher.", 17f, Color.rgb(194, 188, 202)).apply { setPadding(0, dp(9), 0, dp(28)) })

        root.addView(label("BETTA MODE"))
        val options = listOf("Live Bangkok · changes every 3 hours") + BettaPresets.all.map { "Fish #${it.referenceId} · ${it.name}" }
        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, options)
            background = panelDrawable()
            setPadding(dp(14), 0, dp(14), 0)
            val mode = prefs.getString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE)
            setSelection(if (mode == BettaSettings.MODE_MANUAL) prefs.getInt(BettaSettings.KEY_MANUAL_INDEX, 0).coerceIn(0, 7) + 1 else 0)
        }
        root.addView(spinner, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply { bottomMargin = dp(20) })
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                prefs.edit().apply {
                    if (position == 0) putString(BettaSettings.KEY_MODE, BettaSettings.MODE_LIVE)
                    else {
                        putString(BettaSettings.KEY_MODE, BettaSettings.MODE_MANUAL)
                        putInt(BettaSettings.KEY_MANUAL_INDEX, position - 1)
                    }
                }.apply()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }

        val tiltSwitch = Switch(this).apply {
            text = "Device tilt + launcher parallax"
            textSize = 17f
            setTextColor(Color.WHITE)
            isChecked = prefs.getBoolean(BettaSettings.KEY_TILT, true)
            setPadding(dp(2), dp(8), 0, dp(8))
            setOnCheckedChangeListener { _, checked -> prefs.edit().putBoolean(BettaSettings.KEY_TILT, checked).apply() }
        }
        root.addView(tiltSwitch, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(14) })

        root.addView(label("TILT STRENGTH"))
        root.addView(seek(BettaSettings.KEY_TILT_STRENGTH, 100, 160), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(14) })
        root.addView(label("MOTION INTENSITY"))
        root.addView(seek(BettaSettings.KEY_MOTION, 100, 160), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(20) })

        root.addView(label("RENDERER DIAGNOSTIC"))
        diagnosticText = text("Not tested yet", 13f, Color.rgb(183, 177, 193)).apply {
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = panelDrawable()
            setTextIsSelectable(true)
        }
        root.addView(diagnosticText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(22) })

        val preview = button("Preview / Set Live Wallpaper") { openWallpaperPreview() }
        root.addView(preview, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)).apply { bottomMargin = dp(12) })
        val chooser = button("Open Android Wallpaper Picker") {
            startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
        }
        root.addView(chooser, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(24) })

        root.addView(text(
            "When Android opens the wallpaper preview, choose Home screen or Home and lock screen if your phone offers both. Samsung devices normally expose this choice in the system wallpaper flow. The app cannot bypass Android's system confirmation.",
            14f,
            Color.rgb(151, 145, 160),
        ))
        root.addView(text(
            "Rendering pauses when the wallpaper is not visible. The native renderer uses OpenGL ES 3 and the same eight final camera compositions approved for the Sindhorn Midtown PWA.",
            14f,
            Color.rgb(151, 145, 160),
        ).apply { setPadding(0, dp(16), 0, 0) })

        setContentView(scroll)
        updateDiagnostic()
    }

    override fun onResume() {
        super.onResume()
        if (::diagnosticText.isInitialized) updateDiagnostic()
    }

    private fun updateDiagnostic() {
        val status = prefs.getString(BettaSettings.KEY_RENDERER_STATUS, null)
        val error = prefs.getString(BettaSettings.KEY_RENDERER_ERROR, null)
        diagnosticText.text = when {
            status == "running" -> "RUNNING · OpenGL ES 3 renderer produced a complete Betta frame."
            status == "ready" -> "READY · shaders and geometry initialized; waiting for the first visible frame."
            status == "failed" -> "FAILED\n${error ?: "Unknown native renderer error"}"
            !status.isNullOrBlank() -> "STARTING · $status"
            else -> "Not tested yet. Open Preview, then return here if the wallpaper does not render."
        }
        diagnosticText.setTextColor(if (status == "failed") Color.rgb(255, 146, 166) else Color.rgb(183, 177, 193))
    }

    private fun openWallpaperPreview() {
        prefs.edit().remove(BettaSettings.KEY_RENDERER_ERROR).putString(BettaSettings.KEY_RENDERER_STATUS, "launching").apply()
        val component = ComponentName(this, BettaWallpaperService::class.java)
        val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        try { startActivity(direct) } catch (_: Exception) { startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)) }
    }

    private fun seek(key: String, default: Int, maxValue: Int): SeekBar = SeekBar(this).apply {
        max = maxValue
        progress = prefs.getInt(key, default).coerceIn(0, maxValue)
        setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) { if (fromUser) prefs.edit().putInt(key, progress).apply() }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    private fun label(value: String): TextView = text(value, 12f, Color.rgb(226, 214, 181)).apply { setPadding(0, 0, 0, dp(7)) }

    private fun text(value: String, size: Float, color: Int): TextView = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = Gravity.START
        includeFontPadding = false
        setLineSpacing(0f, 1.18f)
    }

    private fun button(value: String, action: () -> Unit): Button = Button(this).apply {
        text = value
        textSize = 16f
        isAllCaps = false
        setTextColor(Color.WHITE)
        background = GradientDrawable().apply {
            cornerRadius = dp(18).toFloat()
            setColor(Color.rgb(46, 39, 59))
            setStroke(dp(1), Color.rgb(92, 83, 106))
        }
        setOnClickListener { action() }
    }

    private fun panelDrawable() = GradientDrawable().apply {
        cornerRadius = dp(16).toFloat()
        setColor(Color.rgb(35, 30, 44))
        setStroke(dp(1), Color.rgb(79, 71, 91))
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
