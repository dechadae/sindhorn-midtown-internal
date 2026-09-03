import Foundation

#if canImport(FoundationModels)
import FoundationModels

@available(macOS 26.0, *)
@Generable(description: "One normalized RGB color for BETTA procedural art")
private struct AppleImagineColor {
    var r: Double
    var g: Double
    var b: Double
}

@available(macOS 26.0, *)
@Generable(description: "A complete BETTA tail design after applying the user's art direction to the current organism")
private struct AppleImagineDesign {
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
    @Guide(description: "Number of translucent membrane layers", .range(1...6))
    var membraneCount: Int
    @Guide(description: "Four tail color stops from base to edge", .count(4))
    var palette: [AppleImagineColor]
    @Guide(description: "Three ambient background gradient stops from black through luminous color to clean white; express the same emotional art direction as the tail", .count(3))
    var background: [AppleImagineColor]
}

@available(macOS 26.0, *)
@Generable(description: "BETTA Tail Director result")
private struct AppleImagineResponse {
    var design: AppleImagineDesign
    @Guide(description: "One short sentence describing the artistic change")
    var note: String
}
#endif

@MainActor
final class BettaImagineEngine {
    static let shared = BettaImagineEngine()
    private init() {}

    var availability: BettaImagineAvailability {
        #if canImport(FoundationModels)
        if #available(macOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available:
                return .available
            case .unavailable(.appleIntelligenceNotEnabled):
                return .unavailable("Apple Intelligence is turned off")
            case .unavailable(.deviceNotEligible):
                return .unavailable("Apple Intelligence isn't supported on this Mac")
            case .unavailable(.modelNotReady):
                return .unavailable("Apple Intelligence model isn't ready yet")
            @unknown default:
                return .unavailable("Apple Intelligence is currently unavailable")
            }
        }
        #endif
        return .unavailable("Imagine requires Apple Intelligence on macOS 26 or later")
    }

    func generate(direction: String, current: BettaImagineDesign) async throws -> BettaImagineResult {
        let trimmed = direction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "BETTA.Imagine", code: 1, userInfo: [NSLocalizedDescriptionKey: "Describe the Betta you want first."])
        }

        #if canImport(FoundationModels)
        if #available(macOS 26.0, *) {
            guard SystemLanguageModel.default.isAvailable else {
                throw NSError(domain: "BETTA.Imagine", code: 2, userInfo: [NSLocalizedDescriptionKey: availability.label])
            }
            return try await generateWithAppleIntelligence(direction: trimmed, current: current)
        }
        #endif

        throw NSError(domain: "BETTA.Imagine", code: 3, userInfo: [NSLocalizedDescriptionKey: availability.label])
    }

    #if canImport(FoundationModels)
    @available(macOS 26.0, *)
    private func generateWithAppleIntelligence(direction: String, current: BettaImagineDesign) async throws -> BettaImagineResult {
        let session = LanguageModelSession(model: SystemLanguageModel.default) {
            """
            You are BETTA Tail Director. Translate art direction into the complete next state of a procedural Siamese fighting-fish tail. Preserve current attributes the person did not ask to change. Never redesign the camera or composition; they are intentionally outside your schema.

            Interpret silky as broad, translucent and gently moving; rosetail as dense rays, folds and ruffle; veiltail as soft asymmetric flow; glasslike as high transmission and clean rim light; feathery as strong ray definition and fine flutter; dreamy as slow motion and broad folds; dramatic as deeper folds, stronger rim light and stronger gradient separation.

            RGB values are 0...1. The three background colors are an equal part of the artwork, not a dark safety backdrop. Make the background express the same emotional direction as the tail. It may be black, dark, mid-tone, saturated, pastel, pearl, ivory or clean white. Ethereal, goddess-like, pure, heavenly, airy, clean, luminous and angelic directions should often move the background toward luminous white, warm ivory, pearl, pale champagne, misty pastel or other high-key atmosphere. Nocturnal, stormy, mysterious or cinematic-dark directions can remain dark. Do not artificially darken a background just to create contrast; use subtle hue or value separation when both tail and environment are light.
            """
        }

        let prompt = """
        Current BETTA state: \(current.promptJSON)
        Person's direction: \(direction)
        Return the complete next state and one concise note. Keep anything not requested as close to the current state as possible. Treat the background gradient as part of the same art direction rather than as a fixed dark stage.
        """

        let response = try await session.respond(to: prompt, generating: AppleImagineResponse.self)
        let d = response.content.design
        let design = BettaImagineDesign(
            spread: d.spread, rayCount: d.rayCount, foldDensity: d.foldDensity,
            curl: d.curl, twist: d.twist, edgeFlutter: d.edgeFlutter, depth: d.depth,
            currentStrength: d.currentStrength, motionSpeed: d.motionSpeed, turbulence: d.turbulence,
            motionAmplitude: d.motionAmplitude, opacity: d.opacity, transmission: d.transmission,
            rimStrength: d.rimStrength, foldHighlight: d.foldHighlight, iridescence: d.iridescence,
            bloom: d.bloom, saturation: d.saturation, brightness: d.brightness,
            gradientPosition: d.gradientPosition, microFold: d.microFold, rayDefinition: d.rayDefinition,
            edgeRuffle: d.edgeRuffle, veinStrength: d.veinStrength, membraneGrain: d.membraneGrain,
            fineFlutter: d.fineFlutter, normalDetail: d.normalDetail, membraneCount: d.membraneCount,
            palette: d.palette.map { BettaImagineColor(r: $0.r, g: $0.g, b: $0.b) },
            background: d.background.map { BettaImagineColor(r: $0.r, g: $0.g, b: $0.b) }
        )
        return BettaImagineResult(design: design, note: response.content.note)
    }
    #endif
}
