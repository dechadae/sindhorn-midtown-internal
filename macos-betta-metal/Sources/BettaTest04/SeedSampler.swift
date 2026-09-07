import Foundation

/// The generator. Every draw picks a point inside a range the constitution
/// already declares legal - no literal bound, no probability-gated branch, no
/// discrete on/off decision. A seed selects; it never decides appearance.
///
/// This is the whole of what Test 04 replaces. The renderer, its shading and
/// its geometry are the engine's and stay the engine's.
enum SeedSampler {
    static func generate(seed: UInt64, constitution c: Constitution) -> GeneratedStyle {
        var rng = SplitMix64(seed: seed)
        let p = c.palette, g = c.ground, f = c.form
        let m = c.motion, mat = c.material, gr = c.grading
        let d = c.detail, l = c.layers

        let baseHue = p.baseHueDeg.sample(&rng)
        let accentHue = (baseHue + p.accentHueOffsetDeg.sample(&rng))
            .truncatingRemainder(dividingBy: 360.0)

        let minimumSpread = g.minimumSpread.sample(&rng)
        let lightnessA = g.lightnessEnd.sample(&rng)
        let lightnessB = secondEnd(from: lightnessA, minimumSpread: minimumSpread, rng: &rng)

        // A mode is selected from the set the engine implements, never invented.
        let modes = c.morphModes
        let modeIndex = modes.isEmpty ? 0 : Int(rng.unit() * Double(modes.count)) % modes.count

        return GeneratedStyle(
            seed: seed,

            baseHueDeg: baseHue,
            accentHueDeg: accentHue,
            saturation: p.saturation.sample(&rng),
            accentSaturationScale: p.accentSaturationScale.sample(&rng),
            lightness0: p.lightness0.sample(&rng),
            lightness1: p.lightness1.sample(&rng),
            lightness2: p.lightness2.sample(&rng),
            lightness3: p.lightness3.sample(&rng),

            groundHueDeg: (baseHue + g.hueOffsetDeg.sample(&rng))
                .truncatingRemainder(dividingBy: 360.0),
            groundHueSpreadDeg: g.hueSpreadDeg.sample(&rng),
            groundSaturation: g.saturation.sample(&rng),
            groundLightnessA: lightnessA,
            groundLightnessB: lightnessB,
            groundMidBias: g.midBias.sample(&rng),
            groundCenterX: g.centerX.sample(&rng),
            groundCenterY: g.centerY.sample(&rng),
            groundSweepAngleDeg: g.sweepAngleDeg.sample(&rng),
            groundVignette: g.vignette.sample(&rng),

            spread: f.spread.sample(&rng),
            foldDensity: f.foldDensity.sample(&rng),
            curl: f.curl.sample(&rng),
            twist: f.twist.sample(&rng),
            edgeFlutter: f.edgeFlutter.sample(&rng),
            depth: f.depth.sample(&rng),

            motionSpeed: m.speed.sample(&rng),
            motionAmplitude: m.amplitude.sample(&rng),
            turbulence: m.turbulence.sample(&rng),
            currentStrength: m.currentStrength.sample(&rng),

            opacity: mat.opacity.sample(&rng),
            transmission: mat.transmission.sample(&rng),
            rimStrength: mat.rimStrength.sample(&rng),
            foldHighlight: mat.foldHighlight.sample(&rng),
            iridescence: mat.iridescence.sample(&rng),
            bloom: mat.bloom.sample(&rng),

            gradingSaturation: gr.saturation.sample(&rng),
            brightness: gr.brightness.sample(&rng),
            gradientPosition: gr.gradientPosition.sample(&rng),

            rayCount: d.rayCount.sample(&rng),
            microFold: d.microFold.sample(&rng),
            rayDefinition: d.rayDefinition.sample(&rng),
            edgeRuffle: d.edgeRuffle.sample(&rng),
            veinStrength: d.veinStrength.sample(&rng),
            membraneGrain: d.membraneGrain.sample(&rng),
            fineFlutter: d.fineFlutter.sample(&rng),
            normalDetail: d.normalDetail.sample(&rng),

            backScale: l.backScale.sample(&rng),
            backAlpha: l.backAlpha.sample(&rng),
            frontAlpha: l.frontAlpha.sample(&rng),
            phaseOffset: l.phaseOffset.sample(&rng),
            seedOffset: l.seedOffset.sample(&rng),

            morphMode: modes.isEmpty ? 0 : modes[modeIndex]
        )
    }

    /// The second ground stop, sampled from the region at least
    /// `minimumSpread` away from the first, so the ground is always a gradient.
    ///
    /// A **conditional range**: the legal interval is narrowed from the rule
    /// *before* sampling, rather than a value being drawn and thrown away.
    /// Constructional validity holds by construction; nothing is ever rejected.
    private static func secondEnd(
        from first: Double,
        minimumSpread: Double,
        rng: inout SplitMix64
    ) -> Double {
        let lowLength = Swift.max(0, first - minimumSpread)
        let highLength = Swift.max(0, 1.0 - (first + minimumSpread))
        let total = lowLength + highLength
        guard total > 0 else { return first < 0.5 ? 1.0 : 0.0 }
        let t = rng.unit() * total
        return t < lowLength ? t : (first + minimumSpread) + (t - lowLength)
    }
}
