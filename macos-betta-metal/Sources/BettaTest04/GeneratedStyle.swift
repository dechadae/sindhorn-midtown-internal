import Foundation
import simd

/// One rigid part of the organism: which topology, and where it sits on the
/// shared body axis. Scale is subordinate to the membrane by construction -
/// the constitution's partScale never reaches 1.
struct ShapePart: Equatable, Codable {
    var primitive: FormPrimitive
    var scale: Double
    var orbitRadius: Double
    var orbitAngleDeg: Double
    var tiltDeg: Double
    var phaseOffset: Double
}

/// The complete output of one seed: a point in the constitution's space.
///
/// Framing is deliberately absent - it comes from the owner's eight locked
/// compositions, and a seed may never move the frame.
/// A style is `Codable` because a studio style cannot be rebuilt from its
/// seed: the seed gives the starting point, the patch gives the intent, and
/// only the resolved numbers are the picture. Written to disk, they are what
/// lets a patched style be kept, set live and reopened months later - see
/// `StyleStore`.
struct GeneratedStyle: Equatable, Codable {
    var seed: UInt64

    // Palette: two hue families, four stops.
    var baseHueDeg: Double
    var accentHueDeg: Double
    var saturation: Double
    var accentSaturationScale: Double
    var lightness0: Double
    var lightness1: Double
    var lightness2: Double
    var lightness3: Double

    // Ground.
    var groundHueDeg: Double
    var groundHueSpreadDeg: Double
    var groundSaturation: Double
    var groundLightnessA: Double
    var groundLightnessB: Double
    var groundMidBias: Double
    var groundCenterX: Double
    var groundCenterY: Double
    var groundSweepAngleDeg: Double
    var groundVignette: Double

    // Form.
    var spread: Double
    var foldDensity: Double
    var curl: Double
    var twist: Double
    var edgeFlutter: Double
    var depth: Double

    // Motion.
    var motionSpeed: Double
    var motionAmplitude: Double
    var turbulence: Double
    var currentStrength: Double

    // Material.
    var opacity: Double
    var transmission: Double
    var rimStrength: Double
    var foldHighlight: Double
    var iridescence: Double
    var bloom: Double

    // Grading.
    var gradingSaturation: Double
    var brightness: Double
    var gradientPosition: Double

    // Fine structure.
    var rayCount: Double
    var microFold: Double
    var rayDefinition: Double
    var edgeRuffle: Double
    var veinStrength: Double
    var membraneGrain: Double
    var fineFlutter: Double
    var normalDetail: Double

    // Layers.
    var backScale: Double
    var backAlpha: Double
    var frontAlpha: Double
    var phaseOffset: Double
    var seedOffset: Double

    var morphMode: Double

    /// The organism is oversized in every case; this is how much.
    var presenceScale: Double

    /// How far out of frame the organism has travelled. Zero when it is
    /// present. A departed organism is large and gone, never small and near -
    /// shrinking produces the timid fragment the rule exists to forbid.
    var exitDistance: Double

    /// The rigid parts accompanying the membrane. Never empty.
    var parts: [ShapePart]

    /// The four palette stops, in the linear space the engine's shader expects.
    /// The engine converts its hex presets with `srgbToLinear` before upload;
    /// feeding display-space values into a linear pipeline is why earlier
    /// versions read dull.
    var paletteLinear: [SIMD3<Float>] {
        func stop(_ hue: Double, _ sat: Double, _ lightness: Double) -> SIMD3<Float> {
            let rgb = hslToRgb(hueDeg: hue, saturation: sat, lightness: lightness)
            return SIMD3<Float>(
                Float(srgbToLinear(rgb.0)),
                Float(srgbToLinear(rgb.1)),
                Float(srgbToLinear(rgb.2))
            )
        }
        let accentSat = saturation * accentSaturationScale
        return [
            stop(baseHueDeg, saturation, lightness0),
            stop(baseHueDeg, saturation, lightness1),
            stop(accentHueDeg, accentSat, lightness2),
            stop(accentHueDeg, accentSat, lightness3),
        ]
    }

    /// The three ground stops, likewise linear.
    var groundLinear: [SIMD3<Float>] {
        let mid = groundLightnessA + (groundLightnessB - groundLightnessA) * groundMidBias
        let half = groundHueSpreadDeg / 2
        func stop(_ hue: Double, _ lightness: Double) -> SIMD3<Float> {
            let rgb = hslToRgb(hueDeg: hue, saturation: groundSaturation, lightness: lightness)
            return SIMD3<Float>(
                Float(srgbToLinear(rgb.0)),
                Float(srgbToLinear(rgb.1)),
                Float(srgbToLinear(rgb.2))
            )
        }
        return [
            stop(groundHueDeg - half, groundLightnessA),
            stop(groundHueDeg, mid),
            stop(groundHueDeg + half, groundLightnessB),
        ]
    }
}
