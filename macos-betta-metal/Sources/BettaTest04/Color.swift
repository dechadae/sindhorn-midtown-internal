import Foundation

/// Standard HSL -> RGB, hue in degrees, saturation/lightness in [0,1].
/// Deliberately the same conversion the Kotlin implementation uses, so a style
/// means the same colour on both platforms.
func hslToRgb(hueDeg: Double, saturation: Double, lightness: Double) -> (Double, Double, Double) {
    let h = (hueDeg.truncatingRemainder(dividingBy: 360.0) + 360.0)
        .truncatingRemainder(dividingBy: 360.0) / 360.0
    let s = Swift.min(Swift.max(saturation, 0.0), 1.0)
    let l = Swift.min(Swift.max(lightness, 0.0), 1.0)
    if s == 0.0 { return (l, l, l) }

    let q = l < 0.5 ? l * (1 + s) : l + s - l * s
    let p = 2 * l - q

    func hueToRgb(_ t0: Double) -> Double {
        var t = t0
        if t < 0 { t += 1.0 }
        if t > 1 { t -= 1.0 }
        if t < 1.0 / 6.0 { return p + (q - p) * 6 * t }
        if t < 1.0 / 2.0 { return q }
        if t < 2.0 / 3.0 { return p + (q - p) * (2.0 / 3.0 - t) * 6 }
        return p
    }

    return (hueToRgb(h + 1.0 / 3.0), hueToRgb(h), hueToRgb(h - 1.0 / 3.0))
}

/// sRGB -> linear, matching the engine's own conversion. Its shader works in
/// linear space and its presets are converted on the way in; a generator that
/// hands it display-space values produces a dull, washed result.
func srgbToLinear(_ value: Double) -> Double {
    if value <= 0.04045 { return value / 12.92 }
    return pow((value + 0.055) / 1.055, 2.4)
}

/// Relative luminance of an 8-bit RGB triple, in [0,1].
func luminance(r: UInt8, g: UInt8, b: UInt8) -> Double {
    0.2126 * Double(r) / 255.0 + 0.7152 * Double(g) / 255.0 + 0.0722 * Double(b) / 255.0
}
