import Foundation

/// Builds a set of renders for a person to rate by eye.
///
/// The contracts can only say a frame is not structurally broken. Whether the
/// result is any good is taste, and taste is the owner's. This produces the
/// images that judgement runs on.
///
/// Files are named neutrally and the mapping is written to a manifest the rater
/// is not meant to open first: a rating made while looking at a seed's
/// parameters is a rating rationalised from numbers, not made by looking.
enum TasteSet {
    struct Entry: Encodable {
        let file: String
        let kind: String          // "sample" or the name of a taste control
        let seed: UInt64?
        let compositionId: Int?
        let note: String?
    }

    /// Deliberately broken frames, mixed in unlabelled. If a rater scores these
    /// well, that rater's judgement is not measuring what we think it is - the
    /// same logic as a negative control on a contract.
    private static func tasteControls(constitution: Constitution) -> [(String, GeneratedStyle, Composition, String)] {
        let base = SeedSampler.generate(seed: 0, constitution: constitution)

        func variant(
            opacity: Double? = nil, transmission: Double? = nil, depth: Double? = nil,
            foldDensity: Double? = nil, baseL: Double? = nil, accentL: Double? = nil,
            saturation: Double? = nil, rim: Double? = nil, bloom: Double? = nil,
            flatGroundAt: Double? = nil
        ) -> GeneratedStyle {
            var s = base
            if let opacity { s.opacity = opacity }
            if let transmission { s.transmission = transmission }
            if let depth { s.depth = depth }
            if let foldDensity { s.foldDensity = foldDensity }
            if let baseL { s.lightness1 = baseL; s.lightness0 = baseL }
            if let accentL { s.lightness2 = accentL; s.lightness3 = accentL }
            if let saturation { s.saturation = saturation }
            if let rim { s.rimStrength = rim }
            if let bloom { s.bloom = bloom }
            // A taste control has to defeat the ground as well as the organism:
            // with a real gradient behind it, an absent organism is no longer
            // an empty picture.
            if let flatGroundAt {
                s.groundSaturation = 0
                s.groundLightnessA = flatGroundAt
                s.groundLightnessB = flatGroundAt
                s.groundVignette = 0
            }
            return s
        }

        let hugeCrop = Composition(scale: 2.2, x: 0, y: 0, z: 3.6, rotationX: 0, rotationY: 0, rotationZ: 90)
        let offFrame = Composition(scale: 0.4, x: 7.9, y: 4.8, z: -3.5, rotationX: 0, rotationY: 0, rotationZ: 90)
        let neutral = Composition(scale: 1.6, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 90)

        return [
            (
                "control-flat-wash",
                variant(transmission: 1.0, depth: 0.002, foldDensity: 7.5, saturation: 0.05, rim: 0.0, bloom: 0.0, flatGroundAt: 0.06),
                hugeCrop,
                "cropped into a featureless region with no fold structure"
            ),
            (
                "control-near-empty",
                variant(flatGroundAt: 0.03),
                offFrame,
                "organism pushed almost entirely out of frame"
            ),
            (
                "control-no-internal-contrast",
                variant(opacity: 1.0, transmission: 1.0, depth: 0.002, baseL: 0.5, accentL: 0.5, saturation: 0.0, rim: 0.0, bloom: 0.0, flatGroundAt: 0.5),
                neutral,
                "form and ground identical, no rim, no fold - a flat grey field"
            ),
            (
                "control-blown-white",
                variant(opacity: 1.0, transmission: 1.0, depth: 0.002, baseL: 1.0, accentL: 1.0, saturation: 0.0, rim: 0.0, bloom: 0.0, flatGroundAt: 1.0),
                neutral,
                "pure white on pure white with no structure - legal by the constitution, but nothing to look at"
            ),
        ]
    }

    static func build(
        seeds: [UInt64],
        constitution: Constitution,
        compositions: [Int: Composition],
        renderer: EngineRenderer,
        surface: Surface,
        perComposition: Int,
        outputDirectory: URL
    ) throws -> [Entry] {
        try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

        var pending: [(kind: String, seed: UInt64?, compositionId: Int?, style: GeneratedStyle, composition: Composition, note: String?)] = []

        var seedIndex = 0
        for compositionId in compositions.keys.sorted() {
            guard let composition = compositions[compositionId] else { continue }
            for _ in 0..<perComposition {
                guard seedIndex < seeds.count else { break }
                let seed = seeds[seedIndex]
                seedIndex += 1
                pending.append((
                    kind: "sample",
                    seed: seed,
                    compositionId: compositionId,
                    style: SeedSampler.generate(seed: seed, constitution: constitution),
                    composition: composition,
                    note: nil
                ))
            }
        }

        for (name, style, composition, note) in tasteControls(constitution: constitution) {
            pending.append((kind: name, seed: nil, compositionId: nil, style: style, composition: composition, note: note))
        }

        // Deterministic shuffle so the controls are not clustered at the end and
        // the ordering can be reproduced.
        var rng = SplitMix64(seed: 0x7A57E)
        for i in stride(from: pending.count - 1, to: 0, by: -1) {
            let j = Int(rng.unit() * Double(i + 1)) % (i + 1)
            pending.swapAt(i, j)
        }

        var manifest: [Entry] = []
        for (index, item) in pending.enumerated() {
            let name = String(format: "frame-%02d.png", index + 1)
            let frame = try renderer.render(
                style: item.style,
                surface: surface,
                phase: 0,
                composition: item.composition
            )
            try writePNG(frame, to: outputDirectory.appendingPathComponent(name))
            manifest.append(Entry(
                file: name,
                kind: item.kind,
                seed: item.seed,
                compositionId: item.compositionId,
                note: item.note
            ))
        }
        return manifest
    }
}
