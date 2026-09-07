import Foundation

/// The frozen failure taxonomy, as far as it applies to a single generated
/// style. T8 (temporal) belongs to render-time sampling. T9 (framing) does not
/// apply: framing comes from the owner's locked compositions, and those are
/// editorial crops - a form running past the frame edge is the intent, not a
/// fault.
enum Violation: String, CaseIterable {
    case t1NonFinite = "T1_NON_FINITE"
    case t2OutOfGamut = "T2_OUT_OF_GAMUT"
    case t3DegenerateMaterial = "T3_DEGENERATE_MATERIAL"
    case t4OutOfVocabulary = "T4_OUT_OF_VOCABULARY"
    case t5PaletteCollapse = "T5_PALETTE_COLLAPSE"
    case t6GroundFlat = "T6_GROUND_FLAT"
}

struct ContractResult {
    let seed: UInt64
    let violations: [Violation]
    var isValid: Bool { violations.isEmpty }
}

enum Contracts {
    static let clampEpsilon = 1e-6
    /// The palette's four stops must not collapse into one value. This is about
    /// the palette having range, not about the organism standing out from its
    /// ground - white on white is legal by the owner's decision.
    static let minimumPaletteSpread = 0.08
    /// The ground must be a gradient, never a flat fill.
    static let minimumGroundSpread = 0.05

    static func evaluate(style s: GeneratedStyle, constitution c: Constitution) -> ContractResult {
        var violations: [Violation] = []

        let all: [Double] = [
            s.baseHueDeg, s.accentHueDeg, s.saturation, s.accentSaturationScale,
            s.lightness0, s.lightness1, s.lightness2, s.lightness3,
            s.groundHueDeg, s.groundHueSpreadDeg, s.groundSaturation,
            s.groundLightnessA, s.groundLightnessB, s.groundMidBias,
            s.groundCenterX, s.groundCenterY, s.groundSweepAngleDeg, s.groundVignette,
            s.spread, s.foldDensity, s.curl, s.twist, s.edgeFlutter, s.depth,
            s.motionSpeed, s.motionAmplitude, s.turbulence, s.currentStrength,
            s.opacity, s.transmission, s.rimStrength, s.foldHighlight,
            s.iridescence, s.bloom,
            s.gradingSaturation, s.brightness, s.gradientPosition,
            s.rayCount, s.microFold, s.rayDefinition, s.edgeRuffle,
            s.veinStrength, s.membraneGrain, s.fineFlutter, s.normalDetail,
            s.backScale, s.backAlpha, s.frontAlpha, s.phaseOffset, s.seedOffset,
        ]
        if all.contains(where: { !$0.isFinite }) { violations.append(.t1NonFinite) }

        let unit: (Double) -> Bool = { $0 >= 0 && $0 <= 1 }
        if !(s.baseHueDeg >= 0 && s.baseHueDeg <= 360)
            || !(s.accentHueDeg >= 0 && s.accentHueDeg <= 360)
            || !unit(s.saturation) || !unit(s.lightness0) || !unit(s.lightness1)
            || !unit(s.lightness2) || !unit(s.lightness3)
            || !unit(s.groundLightnessA) || !unit(s.groundLightnessB) {
            violations.append(.t2OutOfGamut)
        }

        if s.opacity <= clampEpsilon || s.opacity >= 1 - clampEpsilon
            || s.transmission <= clampEpsilon || s.transmission >= 1 - clampEpsilon {
            violations.append(.t3DegenerateMaterial)
        }

        let p = c.palette, g = c.ground, f = c.form, m = c.motion
        let mat = c.material, gr = c.grading, d = c.detail, l = c.layers
        let inRange: [(Bounds, Double)] = [
            (p.saturation, s.saturation), (p.accentSaturationScale, s.accentSaturationScale),
            (p.lightness0, s.lightness0), (p.lightness1, s.lightness1),
            (p.lightness2, s.lightness2), (p.lightness3, s.lightness3),
            (g.hueSpreadDeg, s.groundHueSpreadDeg), (g.saturation, s.groundSaturation),
            (g.midBias, s.groundMidBias), (g.centerX, s.groundCenterX),
            (g.centerY, s.groundCenterY), (g.vignette, s.groundVignette),
            (f.spread, s.spread), (f.foldDensity, s.foldDensity), (f.curl, s.curl),
            (f.twist, s.twist), (f.edgeFlutter, s.edgeFlutter), (f.depth, s.depth),
            (m.speed, s.motionSpeed), (m.amplitude, s.motionAmplitude),
            (m.turbulence, s.turbulence), (m.currentStrength, s.currentStrength),
            (mat.opacity, s.opacity), (mat.transmission, s.transmission),
            (mat.rimStrength, s.rimStrength), (mat.foldHighlight, s.foldHighlight),
            (mat.iridescence, s.iridescence), (mat.bloom, s.bloom),
            (gr.saturation, s.gradingSaturation), (gr.brightness, s.brightness),
            (gr.gradientPosition, s.gradientPosition),
            (d.rayCount, s.rayCount), (d.microFold, s.microFold),
            (d.rayDefinition, s.rayDefinition), (d.edgeRuffle, s.edgeRuffle),
            (d.veinStrength, s.veinStrength), (d.membraneGrain, s.membraneGrain),
            (d.fineFlutter, s.fineFlutter), (d.normalDetail, s.normalDetail),
            (l.backScale, s.backScale), (l.backAlpha, s.backAlpha),
            (l.frontAlpha, s.frontAlpha), (l.phaseOffset, s.phaseOffset),
            (l.seedOffset, s.seedOffset),
        ]
        if inRange.contains(where: { !$0.0.contains($0.1) }) {
            violations.append(.t4OutOfVocabulary)
        }

        let lightnesses = [s.lightness0, s.lightness1, s.lightness2, s.lightness3]
        if (lightnesses.max()! - lightnesses.min()!) < minimumPaletteSpread {
            violations.append(.t5PaletteCollapse)
        }

        if abs(s.groundLightnessA - s.groundLightnessB) < minimumGroundSpread {
            violations.append(.t6GroundFlat)
        }

        return ContractResult(seed: s.seed, violations: violations)
    }

    /// T7: two seeds collide if every constitution-owned parameter matches.
    static func findSeedCollisions(_ styles: [GeneratedStyle]) -> [(UInt64, UInt64)] {
        var seen: [String: UInt64] = [:]
        var collisions: [(UInt64, UInt64)] = []
        for s in styles {
            let key = [
                s.baseHueDeg, s.accentHueDeg, s.saturation, s.lightness0, s.lightness1,
                s.lightness2, s.lightness3, s.groundLightnessA, s.groundLightnessB,
                s.spread, s.foldDensity, s.curl, s.twist, s.depth, s.opacity,
                s.transmission, s.brightness, s.rayCount, s.veinStrength, s.morphMode,
            ].map { String(format: "%.9f", $0) }.joined(separator: ",")
            if let prior = seen[key] { collisions.append((prior, s.seed)) } else { seen[key] = s.seed }
        }
        return collisions
    }
}
