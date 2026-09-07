import Foundation

/// The frozen failure taxonomy (idui-core/evidence/generative/PROTOCOL.md), as
/// far as it applies to a single generated style. T8 (temporal) belongs to
/// render-time testing, not this pure-arithmetic pass. T9 (framing) does not
/// apply: framing is fixed, never generated. A violation fitting none of these
/// is unclassified and the taxonomy must be amended, dated - never silently
/// widened here.
///
/// The thresholds below are deliberately identical to the Kotlin
/// implementation's. If they ever drift, the two platforms stop being
/// comparable and the determinism contract becomes unmeasurable.
enum Violation: String, CaseIterable {
    case t1NonFinite = "T1_NON_FINITE"
    case t2OutOfGamut = "T2_OUT_OF_GAMUT"
    case t3DegenerateMaterial = "T3_DEGENERATE_MATERIAL"
    case t4OutOfVocabulary = "T4_OUT_OF_VOCABULARY"
    case t5PaletteCollapse = "T5_PALETTE_COLLAPSE"
    case t6FigureGroundCollapse = "T6_FIGURE_GROUND_COLLAPSE"
}

struct ContractResult {
    let seed: UInt64
    let violations: [Violation]

    var isValid: Bool { violations.isEmpty }
}

enum Contracts {
    static let clampEpsilon = 1e-6
    static let minHueSeparationDeg = 20.0
    static let minLightnessSeparation = 0.10
    static let minGroundSeparation = 0.08

    static func evaluate(style: GeneratedStyle, constitution: Constitution) -> ContractResult {
        var violations: [Violation] = []

        let allValues = [
            style.baseHueDeg, style.accentHueDeg, style.baseSaturation, style.baseLightness,
            style.accentLightness, style.backgroundLightness, style.motionSpeed, style.motionAmplitude,
            style.turbulence, style.currentStrength, style.opacity, style.transmission,
            style.rimStrength, style.bloom, style.spread, style.foldDensity, style.curl,
            style.twist, style.edgeFlutter, style.depth,
        ]
        if allValues.contains(where: { !$0.isFinite }) {
            violations.append(.t1NonFinite)
        }

        let inUnit = { (value: Double) in value >= 0.0 && value <= 1.0 }
        if !(style.baseHueDeg >= 0 && style.baseHueDeg <= 360)
            || !(style.accentHueDeg >= 0 && style.accentHueDeg <= 360)
            || !inUnit(style.baseSaturation) || !inUnit(style.baseLightness)
            || !inUnit(style.accentLightness) || !inUnit(style.backgroundLightness) {
            violations.append(.t2OutOfGamut)
        }

        if style.opacity <= clampEpsilon || style.opacity >= 1.0 - clampEpsilon
            || style.transmission <= clampEpsilon || style.transmission >= 1.0 - clampEpsilon {
            violations.append(.t3DegenerateMaterial)
        }

        let p = constitution.palette
        let m = constitution.motion
        let mat = constitution.material
        let f = constitution.form
        let outOfVocabulary =
            !p.baseSaturation.contains(style.baseSaturation)
            || !p.baseLightness.contains(style.baseLightness)
            || !p.accentLightness.contains(style.accentLightness)
            || !p.backgroundLightness.contains(style.backgroundLightness)
            || !m.speed.contains(style.motionSpeed)
            || !m.amplitude.contains(style.motionAmplitude)
            || !m.turbulence.contains(style.turbulence)
            || !m.currentStrength.contains(style.currentStrength)
            || !mat.opacity.contains(style.opacity)
            || !mat.transmission.contains(style.transmission)
            || !mat.rimStrength.contains(style.rimStrength)
            || !mat.bloom.contains(style.bloom)
            || !f.spread.contains(style.spread)
            || !f.foldDensity.contains(style.foldDensity)
            || !f.curl.contains(style.curl)
            || !f.twist.contains(style.twist)
            || !f.edgeFlutter.contains(style.edgeFlutter)
            || !f.depth.contains(style.depth)
        if outOfVocabulary {
            violations.append(.t4OutOfVocabulary)
        }

        let hueSeparation = angularSeparationDeg(style.baseHueDeg, style.accentHueDeg)
        let lightnessSeparation = abs(style.baseLightness - style.accentLightness)
        if hueSeparation < minHueSeparationDeg && lightnessSeparation < minLightnessSeparation {
            violations.append(.t5PaletteCollapse)
        }

        let groundSeparation = Swift.min(
            abs(style.baseLightness - style.backgroundLightness),
            abs(style.accentLightness - style.backgroundLightness)
        )
        if groundSeparation < minGroundSeparation {
            violations.append(.t6FigureGroundCollapse)
        }

        return ContractResult(seed: style.seed, violations: violations)
    }

    /// T7: two seeds collide if every constitution-owned parameter matches
    /// within floating tolerance.
    static func findSeedCollisions(_ styles: [GeneratedStyle]) -> [(UInt64, UInt64)] {
        func key(_ s: GeneratedStyle) -> String {
            [
                s.baseHueDeg, s.accentHueDeg, s.baseSaturation, s.baseLightness, s.accentLightness,
                s.backgroundLightness, s.motionSpeed, s.motionAmplitude, s.turbulence, s.currentStrength,
                s.opacity, s.transmission, s.rimStrength, s.bloom, s.spread, s.foldDensity, s.curl,
                s.twist, s.edgeFlutter, s.depth,
            ].map { String(format: "%.9f", $0) }.joined(separator: ",")
        }

        var seen: [String: UInt64] = [:]
        var collisions: [(UInt64, UInt64)] = []
        for style in styles {
            let k = key(style)
            if let prior = seen[k] {
                collisions.append((prior, style.seed))
            } else {
                seen[k] = style.seed
            }
        }
        return collisions
    }

    private static func angularSeparationDeg(_ a: Double, _ b: Double) -> Double {
        let diff = abs(a - b).truncatingRemainder(dividingBy: 360.0)
        return Swift.min(diff, 360.0 - diff)
    }
}
