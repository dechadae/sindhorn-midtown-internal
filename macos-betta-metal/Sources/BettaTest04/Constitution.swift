import Foundation

/// A legal interval, not a value. Every appearance decision the generator makes
/// is a sample from a Bounds declared here - never a literal in code.
/// (Named `Bounds` rather than `Range` so it does not shadow the stdlib type.)
struct Bounds: Codable, Equatable {
    let min: Double
    let max: Double

    func sample(_ rng: inout SplitMix64) -> Double {
        rng.range(min, max)
    }

    func contains(_ value: Double) -> Bool {
        value >= min && value <= max
    }
}

struct PaletteRanges: Codable {
    let baseHueDeg: Bounds
    let accentHueOffsetDeg: Bounds
    let baseSaturation: Bounds
    let baseLightness: Bounds
    let accentLightness: Bounds
    let backgroundLightness: Bounds
}

struct MotionRanges: Codable {
    let speed: Bounds
    let amplitude: Bounds
    let turbulence: Bounds
    let currentStrength: Bounds
}

struct MaterialRanges: Codable {
    let opacity: Bounds
    let transmission: Bounds
    let rimStrength: Bounds
    let bloom: Bounds
}

struct FormRanges: Codable {
    let spread: Bounds
    let foldDensity: Bounds
    let curl: Bounds
    let twist: Bounds
    let edgeFlutter: Bounds
    let depth: Bounds
}

/// The constitution: palette, motion envelope and material of light, as ranges.
/// Deliberately silent on framing (fixed, never sampled) and on live external
/// input (there is none at this stage).
///
/// This is byte-identical to the file the Android core reads. One shared JSON
/// file consumed by two independent implementations is what makes portability
/// measurable rather than asserted - the frozen protocol names cross-platform
/// determinism as a contract in its own right.
struct Constitution: Codable {
    let version: Int
    let palette: PaletteRanges
    let motion: MotionRanges
    let material: MaterialRanges
    let form: FormRanges

    static func load(from url: URL) throws -> Constitution {
        try JSONDecoder().decode(Constitution.self, from: Data(contentsOf: url))
    }

    static func loadBundled() throws -> Constitution {
        guard let url = Bundle.module.url(forResource: "constitution", withExtension: "json") else {
            throw NSError(
                domain: "BettaTest04",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "constitution.json missing from the bundle"]
            )
        }
        return try load(from: url)
    }
}
