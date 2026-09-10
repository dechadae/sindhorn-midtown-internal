import AppKit
import Foundation
import QuartzCore

/// Studio - the third mode, prototyped.
///
/// The explorer draws seeds from a constitution: discovery. The studio starts
/// from words - "pastel metallic rainbow unicorn" - translated into a patch on
/// the engine's own numbers, applied over a seed's style, judged by the same
/// contracts, drawn by the same engine. Not a seed, not a constitution: intent.
///
/// A patch is a JSON object whose keys are `GeneratedStyle` field names and
/// whose values are numbers, plus an optional `parts` array. Keys beginning
/// with `_` are notes. Anything else unknown is reported, never guessed.
/// Nothing here touches the engine, the constitution or a locked composition.
enum Studio {
    /// Every number a patch may set, by the name the glossary uses.
    static let fields: [String: WritableKeyPath<GeneratedStyle, Double>] = [
        "baseHueDeg": \.baseHueDeg, "accentHueDeg": \.accentHueDeg,
        "saturation": \.saturation, "accentSaturationScale": \.accentSaturationScale,
        "lightness0": \.lightness0, "lightness1": \.lightness1,
        "lightness2": \.lightness2, "lightness3": \.lightness3,
        "groundHueDeg": \.groundHueDeg, "groundHueSpreadDeg": \.groundHueSpreadDeg,
        "groundSaturation": \.groundSaturation,
        "groundLightnessA": \.groundLightnessA, "groundLightnessB": \.groundLightnessB,
        "groundMidBias": \.groundMidBias,
        "groundCenterX": \.groundCenterX, "groundCenterY": \.groundCenterY,
        "groundSweepAngleDeg": \.groundSweepAngleDeg, "groundVignette": \.groundVignette,
        "spread": \.spread, "foldDensity": \.foldDensity, "curl": \.curl, "twist": \.twist,
        "edgeFlutter": \.edgeFlutter, "depth": \.depth,
        "motionSpeed": \.motionSpeed, "motionAmplitude": \.motionAmplitude,
        "turbulence": \.turbulence, "currentStrength": \.currentStrength,
        "opacity": \.opacity, "transmission": \.transmission,
        "rimStrength": \.rimStrength, "foldHighlight": \.foldHighlight,
        "iridescence": \.iridescence, "bloom": \.bloom,
        "gradingSaturation": \.gradingSaturation, "brightness": \.brightness,
        "gradientPosition": \.gradientPosition,
        "rayCount": \.rayCount, "microFold": \.microFold, "rayDefinition": \.rayDefinition,
        "edgeRuffle": \.edgeRuffle, "veinStrength": \.veinStrength,
        "membraneGrain": \.membraneGrain, "fineFlutter": \.fineFlutter,
        "normalDetail": \.normalDetail,
        "backScale": \.backScale, "backAlpha": \.backAlpha, "frontAlpha": \.frontAlpha,
        "phaseOffset": \.phaseOffset, "seedOffset": \.seedOffset,
        "morphMode": \.morphMode, "presenceScale": \.presenceScale,
        "exitDistance": \.exitDistance,
    ]

    struct Applied {
        let name: String
        /// The words the patch says it came from, when it says.
        let prompt: String?
        let style: GeneratedStyle
        let changed: [String]
        let unknown: [String]
        let contracts: ContractResult
    }

    /// Reads a patch and lays it over the seed's style.
    static func apply(patchAt url: URL, seed: UInt64, constitution: Constitution) throws -> Applied {
        let data = try Data(contentsOf: url)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "BettaTest04", code: 7, userInfo: [
                NSLocalizedDescriptionKey: "\(url.lastPathComponent) is not a JSON object"
            ])
        }
        var style = SeedSampler.generate(seed: seed, constitution: constitution)
        var changed: [String] = []
        var unknown: [String] = []
        for key in object.keys.sorted() where !key.hasPrefix("_") {
            if key == "parts" { continue }
            guard let path = fields[key] else { unknown.append(key); continue }
            guard let number = object[key] as? NSNumber else { unknown.append(key); continue }
            style[keyPath: path] = number.doubleValue
            changed.append(key)
        }
        if let parts = object["parts"] as? [[String: Any]] {
            var built: [ShapePart] = []
            for part in parts {
                guard let name = part["primitive"] as? String,
                      let primitive = FormPrimitive(rawValue: name) else {
                    unknown.append("parts.primitive \(part["primitive"] ?? "?")")
                    continue
                }
                func n(_ k: String, _ fallback: Double) -> Double {
                    (part[k] as? NSNumber)?.doubleValue ?? fallback
                }
                built.append(ShapePart(
                    primitive: primitive, scale: n("scale", 0.5),
                    orbitRadius: n("orbitRadius", 1), orbitAngleDeg: n("orbitAngleDeg", 0),
                    tiltDeg: n("tiltDeg", 0), phaseOffset: n("phaseOffset", 0)
                ))
            }
            style.parts = built
            changed.append("parts")
        }
        let name = url.deletingPathExtension().lastPathComponent
        return Applied(
            name: name, prompt: object["_prompt"] as? String,
            style: style, changed: changed, unknown: unknown,
            contracts: Contracts.evaluate(style: style, constitution: constitution)
        )
    }

    /// Every number in a style, by the name a patch would use. The same map
    /// that writes a patch reads one back, so what the studio reports is
    /// exactly what a patch can address - and this is the serialisation the
    /// translator will have to send.
    static func values(of style: GeneratedStyle) -> [(String, Double)] {
        fields.keys.sorted().map { ($0, style[keyPath: fields[$0]!]) }
    }

    /// Which numbers step outside a constitution, by name. T4 only says that
    /// one did; the studio says which, so leaving the explorer's taste is
    /// information the owner can weigh rather than a verdict.
    static func departures(of s: GeneratedStyle, from c: Constitution) -> [String] {
        let p = c.palette, g = c.ground, f = c.form, m = c.motion
        let mat = c.material, gr = c.grading, d = c.detail, l = c.layers
        let checks: [(String, Bounds, Double)] = [
            ("saturation", p.saturation, s.saturation),
            ("accentSaturationScale", p.accentSaturationScale, s.accentSaturationScale),
            ("lightness0", p.lightness0, s.lightness0), ("lightness1", p.lightness1, s.lightness1),
            ("lightness2", p.lightness2, s.lightness2), ("lightness3", p.lightness3, s.lightness3),
            ("groundHueSpreadDeg", g.hueSpreadDeg, s.groundHueSpreadDeg),
            ("groundSaturation", g.saturation, s.groundSaturation),
            ("groundMidBias", g.midBias, s.groundMidBias),
            ("groundCenterX", g.centerX, s.groundCenterX), ("groundCenterY", g.centerY, s.groundCenterY),
            ("groundVignette", g.vignette, s.groundVignette),
            ("spread", f.spread, s.spread), ("foldDensity", f.foldDensity, s.foldDensity),
            ("curl", f.curl, s.curl), ("twist", f.twist, s.twist),
            ("edgeFlutter", f.edgeFlutter, s.edgeFlutter), ("depth", f.depth, s.depth),
            ("motionSpeed", m.speed, s.motionSpeed), ("motionAmplitude", m.amplitude, s.motionAmplitude),
            ("turbulence", m.turbulence, s.turbulence), ("currentStrength", m.currentStrength, s.currentStrength),
            ("opacity", mat.opacity, s.opacity), ("transmission", mat.transmission, s.transmission),
            ("rimStrength", mat.rimStrength, s.rimStrength), ("foldHighlight", mat.foldHighlight, s.foldHighlight),
            ("iridescence", mat.iridescence, s.iridescence), ("bloom", mat.bloom, s.bloom),
            ("gradingSaturation", gr.saturation, s.gradingSaturation),
            ("brightness", gr.brightness, s.brightness),
            ("gradientPosition", gr.gradientPosition, s.gradientPosition),
            ("rayCount", d.rayCount, s.rayCount), ("microFold", d.microFold, s.microFold),
            ("rayDefinition", d.rayDefinition, s.rayDefinition), ("edgeRuffle", d.edgeRuffle, s.edgeRuffle),
            ("veinStrength", d.veinStrength, s.veinStrength),
            ("membraneGrain", d.membraneGrain, s.membraneGrain),
            ("fineFlutter", d.fineFlutter, s.fineFlutter), ("normalDetail", d.normalDetail, s.normalDetail),
            ("backScale", l.backScale, s.backScale), ("backAlpha", l.backAlpha, s.backAlpha),
            ("frontAlpha", l.frontAlpha, s.frontAlpha), ("phaseOffset", l.phaseOffset, s.phaseOffset),
            ("seedOffset", l.seedOffset, s.seedOffset),
        ]
        func short(_ v: Double) -> String {
            v == v.rounded() ? String(Int(v)) : String(format: "%.2f", v)
        }
        return checks.filter { !$0.1.contains($0.2) }.map {
            "\($0.0) \(short($0.2)) (\(short($0.1.min))–\(short($0.1.max)))"
        }
    }

    /// Lays a patch of numbers over a style, the way `apply(patchAt:)` does
    /// for a file. This is the path a turn takes: words to numbers to a style.
    static func apply(patch: [String: Double], to style: GeneratedStyle)
        -> (style: GeneratedStyle, changed: [String], unknown: [String]) {
        var next = style
        var changed: [String] = []
        var unknown: [String] = []
        for name in patch.keys.sorted() {
            guard let path = fields[name] else { unknown.append(name); continue }
            next[keyPath: path] = patch[name]!
            changed.append(name)
        }
        return (next, changed, unknown)
    }

    /// One still through the offscreen path, at the explorer's mesh density.
    static func still(_ applied: Applied, composition: Composition, to url: URL,
                      width: Int = 2560, height: Int = 1440) throws {
        let renderer = try EngineRenderer(rays: 320, segments: 288, sampleCount: 4)
        let surface = Surface(name: "studio", width: width, height: height)
        let frame = try renderer.render(
            style: applied.style, surface: surface, phase: 0, composition: composition
        )
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try writePNG(frame, to: url)
    }
}
