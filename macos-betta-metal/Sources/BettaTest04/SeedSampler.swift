import Foundation

/// The generator. Every draw is consumed only to pick a point inside a range the
/// constitution already declares legal - no literal bound, no probability-gated
/// branch, no discrete on/off decision lives here. A seed selects; it never
/// decides appearance.
///
/// The draw order is identical to the Kotlin implementation. That is what makes
/// the two comparable at all: same seed, same order, same ranges, same style.
enum SeedSampler {
    static func generate(seed: UInt64, constitution: Constitution) -> GeneratedStyle {
        var rng = SplitMix64(seed: seed)
        let p = constitution.palette
        let m = constitution.motion
        let mat = constitution.material
        let f = constitution.form

        let baseHue = p.baseHueDeg.sample(&rng)
        let accentHue = (baseHue + p.accentHueOffsetDeg.sample(&rng)).truncatingRemainder(dividingBy: 360.0)

        return GeneratedStyle(
            seed: seed,
            baseHueDeg: baseHue,
            accentHueDeg: accentHue,
            baseSaturation: p.baseSaturation.sample(&rng),
            baseLightness: p.baseLightness.sample(&rng),
            accentLightness: p.accentLightness.sample(&rng),
            backgroundLightness: p.backgroundLightness.sample(&rng),
            motionSpeed: m.speed.sample(&rng),
            motionAmplitude: m.amplitude.sample(&rng),
            turbulence: m.turbulence.sample(&rng),
            currentStrength: m.currentStrength.sample(&rng),
            opacity: mat.opacity.sample(&rng),
            transmission: mat.transmission.sample(&rng),
            rimStrength: mat.rimStrength.sample(&rng),
            bloom: mat.bloom.sample(&rng),
            spread: f.spread.sample(&rng),
            foldDensity: f.foldDensity.sample(&rng),
            curl: f.curl.sample(&rng),
            twist: f.twist.sample(&rng),
            edgeFlutter: f.edgeFlutter.sample(&rng),
            depth: f.depth.sample(&rng)
        )
    }
}
