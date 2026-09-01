package com.sindhornmidtown.betta.wallpaper

import kotlin.math.pow

data class BettaLayer(
    val seed: Float,
    val scale: Float,
    val rotation: Float,
    val offsetX: Float,
    val offsetY: Float,
    val offsetZ: Float,
    val alpha: Float,
    val phase: Float,
)

data class BettaParams(
    val spread: Float,
    val foldDensity: Float,
    val curl: Float,
    val twist: Float,
    val edgeFlutter: Float,
    val depth: Float,
    val currentStrength: Float,
    val motionSpeed: Float,
    val turbulence: Float,
    val motionAmplitude: Float,
    val opacity: Float,
    val transmission: Float,
    val rimStrength: Float,
    val foldHighlight: Float,
    val iridescence: Float,
    val bloom: Float,
    val saturation: Float,
    val brightness: Float,
    val gradientPosition: Float,
    val scale: Float,
    val rotation: Float,
    val rotationX: Float,
    val rotationY: Float,
    val tiltStrength: Float,
    val cameraDepth: Float,
    val offsetX: Float,
    val offsetY: Float,
)

data class BettaPreset(
    val referenceId: Int,
    val name: String,
    val morphMode: Float,
    val background: Array<FloatArray>,
    val palette: Array<FloatArray>,
    val params: BettaParams,
    val layers: Array<BettaLayer>,
)

private fun srgbToLinear(value: Float): Float = if (value <= .04045f) value / 12.92f else (((value + .055f) / 1.055f).toDouble().pow(2.4)).toFloat()
private fun rgb(hex: String): FloatArray {
    val value = hex.removePrefix("#").toLong(16)
    return floatArrayOf(
        srgbToLinear(((value shr 16) and 0xff).toFloat() / 255f),
        srgbToLinear(((value shr 8) and 0xff).toFloat() / 255f),
        srgbToLinear((value and 0xff).toFloat() / 255f),
    )
}

object BettaPresets {
    val all = arrayOf(
        BettaPreset(
            1, "Cobalt + Orange Halfmoon", 2f,
            arrayOf(rgb("#070b18"), rgb("#102746"), rgb("#351713")),
            arrayOf(rgb("#0a2454"), rgb("#237fd2"), rgb("#ef421f"), rgb("#ff8a48")),
            BettaParams(3.15f, 9.6f, .42f, .08f, .070f, .58f, .20f, .34f, .16f, .37f, .62f, .71f, 1.10f, 1.16f, .27f, .36f, 1.34f, 1.72f, .015f, 1.11f, 3.14f, .09f, -.61f, .18f, .10f, 1.88f, -.80f),
            arrayOf(
                BettaLayer(71.1f, 1f, 0f, 0f, 0f, .06f, .96f, 1.2f),
                BettaLayer(74.8f, .94f, .055f, .06f, .01f, -.10f, .28f, 17.6f),
            ),
        ),
        BettaPreset(
            2, "Super Red Halfmoon", 0f,
            arrayOf(rgb("#120508"), rgb("#36090d"), rgb("#521611")),
            arrayOf(rgb("#090103"), rgb("#5e0506"), rgb("#e6180e"), rgb("#ff5a20")),
            BettaParams(3.22f, 10.4f, .25f, .035f, .050f, .56f, .18f, .32f, .13f, .34f, .66f, .66f, 1.10f, 1.22f, .08f, .35f, 1.42f, 1.76f, -.08f, .92f, -.22f, .24f, -.53f, .16f, .80f, -1.90f, -.48f),
            arrayOf(
                BettaLayer(82.4f, 1f, 0f, 0f, 0f, .07f, .98f, 4.9f),
                BettaLayer(87.1f, .955f, -.035f, -.02f, .025f, -.10f, .23f, 21.2f),
            ),
        ),
        BettaPreset(
            3, "Coral Magenta Flow", 0f,
            arrayOf(rgb("#100712"), rgb("#3a1026"), rgb("#511c20")),
            arrayOf(rgb("#652047"), rgb("#d33d86"), rgb("#ff755f"), rgb("#e8b1d6")),
            BettaParams(3.00f, 9.4f, .70f, .26f, .085f, .64f, .20f, .35f, .19f, .40f, .61f, .74f, 1.08f, 1.16f, .24f, .37f, 1.40f, 1.78f, .025f, .97f, 2.29f, -.42f, .71f, .20f, .04f, 1.98f, -.64f),
            arrayOf(
                BettaLayer(93.6f, 1f, -.025f, -.02f, -.03f, .09f, .95f, 8.7f),
                BettaLayer(98.2f, .90f, .14f, .08f, .08f, -.13f, .34f, 26.4f),
            ),
        ),
        BettaPreset(
            4, "Pearl Blush Veiltail", 2f,
            arrayOf(rgb("#08111b"), rgb("#183647"), rgb("#45221f")),
            arrayOf(rgb("#fbfdff"), rgb("#9fdaf0"), rgb("#ff4d3f"), rgb("#ff9a82")),
            BettaParams(2.68f, 8.7f, .94f, -.46f, .105f, .52f, .17f, .30f, .16f, .34f, .50f, .91f, 1.08f, 1.08f, .16f, .34f, 1.24f, 1.84f, .035f, 1.26f, -.03f, -.51f, .54f, .17f, .12f, -1.76f, -.36f),
            arrayOf(
                BettaLayer(104.4f, 1f, -.03f, -.02f, -.04f, .11f, .89f, 12.1f),
                BettaLayer(109.7f, .84f, .24f, .12f, .13f, -.15f, .38f, 31.5f),
            ),
        ),
        BettaPreset(
            5, "Mustard Galaxy Koi", 1f,
            arrayOf(rgb("#071017"), rgb("#163847"), rgb("#46310e")),
            arrayOf(rgb("#67d7e9"), rgb("#071820"), rgb("#e5b13b"), rgb("#fff8ea")),
            BettaParams(2.78f, 9.8f, .82f, .34f, .120f, .66f, .20f, .35f, .23f, .41f, .64f, .72f, 1.14f, 1.22f, .34f, .40f, 1.40f, 1.76f, -.05f, 1.06f, -3.14f, -.52f, .17f, .21f, .08f, 2.16f, .16f),
            arrayOf(
                BettaLayer(116.2f, 1f, -.05f, -.03f, -.02f, .10f, .94f, 15.8f),
                BettaLayer(121.6f, .82f, .22f, .12f, .10f, -.15f, .48f, 36.7f),
            ),
        ),
        BettaPreset(
            6, "Wine Orchid Halfmoon", 4f,
            arrayOf(rgb("#100713"), rgb("#3d132b"), rgb("#553715")),
            arrayOf(rgb("#21152f"), rgb("#5c1748"), rgb("#c42f79"), rgb("#e7ae61")),
            BettaParams(3.24f, 10.8f, .34f, -.035f, .055f, .56f, .18f, .32f, .13f, .34f, .64f, .71f, 1.16f, 1.30f, .29f, .39f, 1.31f, 1.72f, -.01f, 1.02f, .30f, .38f, -.18f, .18f, .09f, -1.62f, -.58f),
            arrayOf(
                BettaLayer(128.4f, 1f, 0f, 0f, 0f, .07f, .97f, 19.4f),
                BettaLayer(133.8f, .95f, .035f, .025f, -.02f, -.10f, .25f, 40.2f),
            ),
        ),
        BettaPreset(
            7, "Steel Blue Rosetail", 4f,
            arrayOf(rgb("#071116"), rgb("#193946"), rgb("#3c242c")),
            arrayOf(rgb("#061820"), rgb("#17495b"), rgb("#4e91a5"), rgb("#d7a49a")),
            BettaParams(3.42f, 11.6f, 1.02f, .43f, .165f, .78f, .19f, .29f, .27f, .41f, .58f, .79f, 1.22f, 1.30f, .30f, .40f, 1.22f, 1.68f, .02f, 1.00f, -.89f, .41f, -.32f, .22f, .11f, -1.86f, .26f),
            arrayOf(
                BettaLayer(141.5f, 1f, -.02f, -.03f, 0f, .11f, .93f, 23.6f),
                BettaLayer(147.9f, .80f, .22f, .13f, .09f, -.18f, .52f, 45.1f),
            ),
        ),
        BettaPreset(
            8, "Electric Blue Halfmoon", 4f,
            arrayOf(rgb("#050b1c"), rgb("#0c285a"), rgb("#143472")),
            arrayOf(rgb("#020a20"), rgb("#0a2f71"), rgb("#1677d2"), rgb("#79b9f4")),
            BettaParams(3.28f, 11.2f, .27f, .018f, .048f, .56f, .17f, .30f, .12f, .33f, .66f, .68f, 1.18f, 1.26f, .36f, .42f, 1.34f, 1.72f, -.035f, 1.06f, -3.14f, .30f, -.56f, .19f, .10f, 1.84f, .18f),
            arrayOf(
                BettaLayer(155.2f, 1f, 0f, 0f, 0f, .07f, .98f, 27.8f),
                BettaLayer(161.4f, .955f, -.025f, -.02f, .02f, -.11f, .24f, 49.3f),
            ),
        ),
    )
}
