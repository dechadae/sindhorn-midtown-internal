import Foundation
import simd

struct BettaImagineColor: Codable, Equatable {
    var r: Double
    var g: Double
    var b: Double

    init(r: Double, g: Double, b: Double) {
        self.r = r; self.g = g; self.b = b
    }

    init(_ value: SIMD3<Float>) {
        r = Double(value.x); g = Double(value.y); b = Double(value.z)
    }

    /// Defensive bridge for model-produced RGB. Foundation Models is now guided
    /// to emit normalized 0...1 channels, but if a model ever returns familiar
    /// 0...255 RGB values we preserve their ratios instead of clamping every
    /// channel above 1 to white.
    static func fromModelRGB(r: Double, g: Double, b: Double) -> BettaImagineColor {
        let values = [r, g, b]
        let peak = values.max() ?? 0
        let floor = values.min() ?? 0
        if peak > 1.000_001, peak <= 255.0, floor >= 0 {
            return BettaImagineColor(r: r / 255.0, g: g / 255.0, b: b / 255.0)
        }
        return BettaImagineColor(r: r, g: g, b: b)
    }

    var paletteSIMD: SIMD3<Float> {
        SIMD3<Float>(Float(clamp(r, 0, 1)), Float(clamp(g, 0, 1)), Float(clamp(b, 0, 1)))
    }

    /// Imagine backgrounds use the same full display-referred RGB range as the
    /// tail palette. Earlier builds artificially capped every channel at 0.16,
    /// which forced dark backgrounds even when the art direction called for
    /// pearl, ivory, pastel or clean white atmosphere.
    var backgroundSIMD: SIMD3<Float> {
        SIMD3<Float>(Float(clamp(r, 0, 1)), Float(clamp(g, 0, 1)), Float(clamp(b, 0, 1)))
    }

    private func clamp(_ value: Double, _ lower: Double, _ upper: Double) -> Double {
        min(upper, max(lower, value))
    }
}

/// Complete creative state the language model is allowed to direct. Camera,
/// landscape composition and canonical Original definitions are deliberately
/// absent, so Imagine cannot modify them even if the prompt asks it to.
struct BettaImagineDesign: Codable, Equatable {
    var spread: Double
    var rayCount: Double
    var foldDensity: Double
    var curl: Double
    var twist: Double
    var edgeFlutter: Double
    var depth: Double
    var currentStrength: Double
    var motionSpeed: Double
    var turbulence: Double
    var motionAmplitude: Double
    var opacity: Double
    var transmission: Double
    var rimStrength: Double
    var foldHighlight: Double
    var iridescence: Double
    var bloom: Double
    var saturation: Double
    var brightness: Double
    var gradientPosition: Double
    var microFold: Double
    var rayDefinition: Double
    var edgeRuffle: Double
    var veinStrength: Double
    var membraneGrain: Double
    var fineFlutter: Double
    var normalDetail: Double
    var membraneCount: Int
    var palette: [BettaImagineColor]
    var background: [BettaImagineColor]

    static func current(referenceId: Int) -> BettaImagineDesign? {
        guard let preset = BettaPreset.all.first(where: { $0.referenceId == referenceId }) else { return nil }
        let advanced = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        let style = BettaRandomStyleStore.shared.style(for: referenceId)
        let palette = style?.resolvedPalette ?? preset.palette
        let background = style?.resolvedBackground ?? preset.background
        let t = advanced.tail
        return BettaImagineDesign(
            spread: Double(t.spread), rayCount: Double(t.rayCount), foldDensity: Double(t.foldDensity),
            curl: Double(t.curl), twist: Double(t.twist), edgeFlutter: Double(t.edgeFlutter), depth: Double(t.depth),
            currentStrength: Double(t.currentStrength), motionSpeed: Double(t.motionSpeed), turbulence: Double(t.turbulence),
            motionAmplitude: Double(t.motionAmplitude), opacity: Double(t.opacity), transmission: Double(t.transmission),
            rimStrength: Double(t.rimStrength), foldHighlight: Double(t.foldHighlight), iridescence: Double(t.iridescence),
            bloom: Double(t.bloom), saturation: Double(t.saturation), brightness: Double(t.brightness),
            gradientPosition: Double(t.gradientPosition), microFold: Double(t.microFold), rayDefinition: Double(t.rayDefinition),
            edgeRuffle: Double(t.edgeRuffle), veinStrength: Double(t.veinStrength), membraneGrain: Double(t.membraneGrain),
            fineFlutter: Double(t.fineFlutter), normalDetail: Double(t.normalDetail), membraneCount: advanced.membraneCount,
            palette: palette.prefix(4).map(BettaImagineColor.init),
            background: background.prefix(3).map(BettaImagineColor.init)
        )
    }

    /// Apply only the creative fields exposed above. The current camera and
    /// membrane endpoint placement are retained exactly; landscape composition
    /// lives in a separate store and is never touched here.
    @discardableResult
    func apply(referenceId: Int) -> Bool {
        guard (1...8).contains(referenceId), palette.count >= 4, background.count >= 3 else { return false }
        var advanced = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        advanced.tail = BettaTailTuning(
            spread: Float(spread), rayCount: Float(rayCount), foldDensity: Float(foldDensity),
            curl: Float(curl), twist: Float(twist), edgeFlutter: Float(edgeFlutter), depth: Float(depth),
            currentStrength: Float(currentStrength), motionSpeed: Float(motionSpeed), turbulence: Float(turbulence),
            motionAmplitude: Float(motionAmplitude), opacity: Float(opacity), transmission: Float(transmission),
            rimStrength: Float(rimStrength), foldHighlight: Float(foldHighlight), iridescence: Float(iridescence),
            bloom: Float(bloom), saturation: Float(saturation), brightness: Float(brightness),
            gradientPosition: Float(gradientPosition), microFold: Float(microFold), rayDefinition: Float(rayDefinition),
            edgeRuffle: Float(edgeRuffle), veinStrength: Float(veinStrength), membraneGrain: Float(membraneGrain),
            fineFlutter: Float(fineFlutter), normalDetail: Float(normalDetail)
        ).normalized
        advanced.membraneCount = min(6, max(1, membraneCount))
        BettaAdvancedTuningStore.shared.update(referenceId: referenceId, adjustment: advanced)

        let style = BettaRandomStyle(
            seed: 0,
            palette: palette.prefix(4).map { BettaStoredColor($0.paletteSIMD) },
            background: background.prefix(3).map { BettaStoredColor($0.backgroundSIMD) }
        )
        BettaRandomStyleStore.shared.update(referenceId: referenceId, style: style)
        return true
    }

    var promptJSON: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self), let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }
}

struct BettaImagineResult: Equatable {
    var design: BettaImagineDesign
    var note: String
}

struct BettaImagineSnapshot: Equatable {
    var referenceId: Int
    var advanced: BettaAdvancedAdjustment
    var style: BettaRandomStyle?

    static func capture(referenceId: Int) -> BettaImagineSnapshot? {
        guard (1...8).contains(referenceId) else { return nil }
        return BettaImagineSnapshot(
            referenceId: referenceId,
            advanced: BettaAdvancedTuningStore.shared.adjustment(for: referenceId),
            style: BettaRandomStyleStore.shared.style(for: referenceId)
        )
    }

    func restore() {
        BettaAdvancedTuningStore.shared.update(referenceId: referenceId, adjustment: advanced)
        if let style { BettaRandomStyleStore.shared.update(referenceId: referenceId, style: style) }
        else { BettaRandomStyleStore.shared.clear(referenceId: referenceId) }
    }
}

enum BettaImagineAvailability: Equatable {
    case available
    case unavailable(String)

    var label: String {
        switch self {
        case .available: return "Apple Intelligence · On Device"
        case .unavailable(let reason): return reason
        }
    }
}
