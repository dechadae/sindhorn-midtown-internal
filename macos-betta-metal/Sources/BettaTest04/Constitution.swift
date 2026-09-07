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

/// Four stops: 0-1 a dark-to-mid base family, 2-3 a bright-to-pale accent
/// family. That is the structure the locked palettes actually have - not a
/// monotonic ramp but two hue families - so the constitution declares it
/// rather than inventing a different one.
struct PaletteRanges: Codable {
    let baseHueDeg: Bounds
    let accentHueOffsetDeg: Bounds
    let saturation: Bounds
    let accentSaturationScale: Bounds
    let lightness0: Bounds
    let lightness1: Bounds
    let lightness2: Bounds
    let lightness3: Bounds
}

/// The ground is a place, not a fill: three stops composed by a radial falloff,
/// a sweep and a vignette. A frame whose organism is cropped almost entirely
/// away can still be a good wallpaper, but only if what remains is atmosphere.
struct GroundRanges: Codable {
    let hueOffsetDeg: Bounds
    let hueSpreadDeg: Bounds
    let saturation: Bounds
    let lightnessEnd: Bounds
    let minimumSpread: Bounds
    let midBias: Bounds
    let centerX: Bounds
    let centerY: Bounds
    let sweepAngleDeg: Bounds
    let vignette: Bounds
}

struct FormRanges: Codable {
    let spread: Bounds
    let foldDensity: Bounds
    let curl: Bounds
    let twist: Bounds
    let edgeFlutter: Bounds
    let depth: Bounds
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
    let foldHighlight: Bounds
    let iridescence: Bounds
    let bloom: Bounds
}

/// Grading multipliers. These sit well above 1 in the engine - brightness
/// around 1.75, saturation around 1.3 - and their absence from earlier versions
/// is a large part of why output rendered flat.
struct GradingRanges: Codable {
    let saturation: Bounds
    let brightness: Bounds
    let gradientPosition: Bounds
}

/// The fine-structure controls. These are what give the membrane its ray
/// definition, vein and grain; a constitution that omits them cannot produce
/// the engine's look however well it handles colour.
struct DetailRanges: Codable {
    let rayCount: Bounds
    let microFold: Bounds
    let rayDefinition: Bounds
    let edgeRuffle: Bounds
    let veinStrength: Bounds
    let membraneGrain: Bounds
    let fineFlutter: Bounds
    let normalDetail: Bounds
}

/// How much of the frame the organism occupies.
///
/// The owner's rule, and it is not monotonic: oversized with part off screen is
/// the best state; nearly absent works only when what remains is big and
/// dramatic; a timid fragment between the two is the failure. So there are two
/// legal bands and no middle - `absentScale` where the ground carries the
/// picture, `dominantScale` where the organism does.
///
/// Every metric tried against the owner's judgement before this failed because
/// each assumed more-is-better. A valley cannot be fitted with a threshold.
struct PresenceRanges: Codable {
    /// The organism is oversized in both modes. Only its position differs.
    let scale: Bounds
    /// How far out of frame a departed organism has travelled.
    let exitDistance: Bounds
}

/// How the rigid parts assemble into one body. Scale is held subordinate to
/// the membrane and orbit radius keeps parts near a shared axis: an organism
/// has a body and appendages, not four equal blobs scattered in a frame.
struct ShapeRanges: Codable {
    let count: Bounds
    let partScale: Bounds
    let orbitRadius: Bounds
    let orbitAngleDeg: Bounds
    let tiltDeg: Bounds
    let phaseOffset: Bounds
}

/// Two membranes, front and back. The overlap between them is where the
/// engine's depth comes from.
struct LayerRanges: Codable {
    let backScale: Bounds
    let backAlpha: Bounds
    let frontAlpha: Bounds
    let phaseOffset: Bounds
    let seedOffset: Bounds
}

/// The constitution: the whole space a seed may select within, and nothing
/// else. Framing is absent - it comes from the owner's locked compositions.
/// Live input is absent - there is none at this stage.
struct Constitution: Codable {
    let version: Int
    let palette: PaletteRanges
    let ground: GroundRanges
    let form: FormRanges
    let motion: MotionRanges
    let material: MaterialRanges
    let grading: GradingRanges
    let detail: DetailRanges
    let layers: LayerRanges
    let shapes: ShapeRanges
    let presence: PresenceRanges

    /// Which arm this constitution is, and whether its exclusions apply.
    /// A - raw random, no constitution. B - an enumerated allowlist.
    /// C - the same wide domains as A with only the exclusions that name a
    /// real failure. A against C isolates what the exclusions buy; B against C
    /// asks whether a curated list does the same job.
    let arm: String?
    let exclusions: Bool?

    var exclusionsApply: Bool { exclusions ?? true }
    var armName: String { arm ?? "C" }

    /// The shading modes the engine implements. A seed selects among declared
    /// modes; it never invents one.
    private let _morphModes: [Double]
    var morphModes: [Double] { _morphModes }

    /// Declared presence modes. A seed selects one; it never invents one.
    private let _presenceModes: [String]
    var presenceModes: [String] { _presenceModes }

    enum CodingKeys: String, CodingKey {
        case version, palette, ground, form, motion, material, grading, detail, layers, shapes, presence
        case arm, exclusions
        case _morphModes = "_morphModes"
        case _presenceModes = "_presenceModes"
    }

    static func load(from url: URL) throws -> Constitution {
        try JSONDecoder().decode(Constitution.self, from: Data(contentsOf: url))
    }

    /// Loads one arm by name, from beside the default constitution.
    static func loadArm(_ arm: String) throws -> Constitution {
        guard let url = Bundle.module.url(
            forResource: "constitution-\(arm.lowercased())", withExtension: "json"
        ) else {
            throw NSError(domain: "BettaTest04", code: 5, userInfo: [
                NSLocalizedDescriptionKey: "constitution-\(arm).json missing from the bundle"
            ])
        }
        return try load(from: url)
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
