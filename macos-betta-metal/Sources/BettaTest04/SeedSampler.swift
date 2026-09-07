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
        let d = c.detail, l = c.layers, sh = c.shapes, pr = c.presence

        let baseHue = p.baseHueDeg.sample(&rng)
        let accentHue = (baseHue + p.accentHueOffsetDeg.sample(&rng))
            .truncatingRemainder(dividingBy: 360.0)

        // The ground's second stop. With exclusions on, it is drawn from the
        // region at least minimumSpread away from the first, so the ground is
        // always a gradient. With them off it is drawn freely and may land
        // anywhere, including flat.
        let minimumSpread = g.minimumSpread.sample(&rng)
        let lightnessA = g.lightnessEnd.sample(&rng)
        let lightnessB = c.exclusionsApply
            ? secondEnd(from: lightnessA, minimumSpread: minimumSpread, rng: &rng)
            : g.lightnessEnd.sample(&rng)

        // The rigid family. A seed chooses how many parts and which, from the
        // declared set - it never invents a topology. Parts are drawn in a
        // fixed order so the composition stays reproducible.
        let partCount = Swift.max(1, Swift.min(
            FormPrimitive.rigid.count,
            Int(sh.count.sample(&rng).rounded())
        ))
        var available = FormPrimitive.rigid
        var parts: [ShapePart] = []
        for _ in 0..<partCount {
            let pick = Int(rng.unit() * Double(available.count)) % available.count
            let primitive = available.remove(at: pick)
            parts.append(ShapePart(
                primitive: primitive,
                scale: sh.partScale.sample(&rng),
                orbitRadius: sh.orbitRadius.sample(&rng),
                orbitAngleDeg: sh.orbitAngleDeg.sample(&rng),
                tiltDeg: sh.tiltDeg.sample(&rng),
                phaseOffset: sh.phaseOffset.sample(&rng)
            ))
        }

        // Presence: oversized either way, present or departed. Selected from
        // the declared modes, never invented.
        let presenceScale = pr.scale.sample(&rng)
        let pModes = c.presenceModes
        let departed = !pModes.isEmpty
            && pModes[Int(rng.unit() * Double(pModes.count)) % pModes.count] == "departed"
        // Without exclusions there is no departure rule: the organism sits
        // wherever its scale leaves it, timid middle included.
        let exitDistance = (c.exclusionsApply && departed) ? pr.exitDistance.sample(&rng) : 0

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

            morphMode: modes.isEmpty ? 0 : modes[modeIndex],
            presenceScale: presenceScale,
            exitDistance: exitDistance,
            parts: parts
        )
    }

    /// Samples from two disjoint bands as if they were one range, in
    /// proportion to their widths. The gap between them is not legal and is
    /// never drawn, so nothing has to be rejected afterwards.
    ///
    /// This is how a non-monotonic rule becomes constitutional rather than a
    /// contract that throws work away: the valley is removed from the space
    /// before the seed ever reaches it.
    private static func sampleUnion(
        _ low: Bounds, _ high: Bounds, rng: inout SplitMix64
    ) -> Double {
        let lowWidth = low.max - low.min
        let highWidth = high.max - high.min
        let total = lowWidth + highWidth
        guard total > 0 else { return low.min }
        let t = rng.unit() * total
        return t < lowWidth ? low.min + t : high.min + (t - lowWidth)
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
