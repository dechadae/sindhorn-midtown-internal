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
    @Guide(description: "One short sentence truthfully describing the artistic change actually present in the returned design")
    var note: String
}
#endif

enum BettaImagineInstructionMode: String, Equatable {
    case globalRestyle = "GLOBAL_RESTYLE"
    case refinement = "CONSTRAINED_REFINEMENT"

    static func classify(_ direction: String) -> BettaImagineInstructionMode {
        let text = " " + direction.lowercased() + " "
        let refinementMarkers = [
            " keep ", " preserve ", " only ", " just ", " same ",
            " don't change", " do not change", " without changing",
            " more ", " less ", " slightly", " a little", " a bit",
            " increase ", " decrease ", " slower", " faster", " warmer", " cooler"
        ]
        return refinementMarkers.contains(where: { text.contains($0) }) ? .refinement : .globalRestyle
    }
}

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
        let mode = BettaImagineInstructionMode.classify(direction)
        let session = LanguageModelSession(model: SystemLanguageModel.default) {
            """
            You are BETTA Tail Director. Translate the person's art direction into the complete next state of a procedural Siamese fighting-fish tail. Camera and landscape composition are intentionally outside your schema and must never be discussed as editable outputs.

            There are two instruction modes:
            - GLOBAL_RESTYLE: the person gave a broad theme, mood, character, aesthetic, cultural reference, fantasy direction or overall visual identity without explicitly asking to preserve specific attributes. Make a decisive, unmistakable reinterpretation that is clearly different at a glance. Apply the idea across palette, background atmosphere, optical response, form and motion wherever semantically appropriate. Do not timidly preserve the current colors simply because they already exist.
            - CONSTRAINED_REFINEMENT: the person explicitly says keep, preserve, only, just, same, more/less, slightly, or otherwise asks for a localized adjustment. Preserve everything they did not ask to change as closely as possible.

            Interpret silky as broad, translucent and gently moving; rosetail as dense rays, folds and ruffle; veiltail as soft asymmetric flow; glasslike as high transmission and clean rim light; feathery as strong ray definition and fine flutter; dreamy as slow motion and broad folds; dramatic as deeper folds, stronger rim light and stronger gradient separation.

            Treat style and cultural prompts visually rather than merely naming them in the note. For example, candy / unicorn / playful pop-culture direction can justify a bold high-chroma or candy-pastel mix such as bubblegum pink, electric cyan, lavender, lemon, peach or opalescent accents, with a complementary lively environment. Ethereal / goddess-like / heavenly direction can justify pearl, ivory, opal, pale lavender, champagne, luminous white and gentle iridescent separation. These are vocabulary examples, not fixed palettes.

            RGB values are 0...1. The three background colors are an equal part of the artwork, not a dark safety backdrop. The background may be black, dark, mid-tone, saturated, pastel, pearl, ivory or clean white. Keep the Betta silhouette readable: when both tail and environment are light, create subtle hue/value separation and stronger rim/fold definition rather than simply washing everything to the same white.

            The note must describe what the returned numeric design actually does. Never claim "vibrant colors", "rainbow", "strong contrast" or similar if the palette/background values do not visibly contain that quality.
            """
        }

        let prompt = """
        Instruction mode: \(mode.rawValue)
        Current BETTA state: \(current.promptJSON)
        Person's direction: \(direction)

        Return the complete next state and one concise truthful note.
        If mode is GLOBAL_RESTYLE, make the transformation visually obvious and coherent rather than merely tweaking the current state.
        If mode is CONSTRAINED_REFINEMENT, keep unspecified attributes close to their current values.
        """

        var response = try await session.respond(to: prompt, generating: AppleImagineResponse.self)
        var result = makeResult(response.content)

        // Broad art-direction prompts should not silently collapse into a tiny
        // numerical tweak. If the first global restyle is still too close to the
        // current organism, ask the same on-device session for one decisive pass.
        if mode == .globalRestyle && isVisuallyTooSimilar(current: current, candidate: result.design) {
            let strongerPrompt = """
            The first proposal is still too visually close to the current BETTA for a GLOBAL_RESTYLE.
            Reinterpret the same direction more decisively. Make the result unmistakably different at a glance while remaining tasteful and coherent. If the direction implies a colorful or cultural theme, materially redesign the four tail colors and three background colors rather than only describing the theme in the note. Also use form, optics and motion where they support the direction. Return the complete revised state.
            """
            response = try await session.respond(to: strongerPrompt, generating: AppleImagineResponse.self)
            result = makeResult(response.content)
        }

        return result
    }

    @available(macOS 26.0, *)
    private func makeResult(_ content: AppleImagineResponse) -> BettaImagineResult {
        let d = content.design
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
        return BettaImagineResult(design: design, note: content.note)
    }
    #endif

    private func isVisuallyTooSimilar(current: BettaImagineDesign, candidate: BettaImagineDesign) -> Bool {
        let paletteDelta = averageColorDistance(current.palette, candidate.palette) / sqrt(3.0)
        let backgroundDelta = averageColorDistance(current.background, candidate.background) / sqrt(3.0)

        let scalarTerms: [Double] = [
            abs(candidate.spread - current.spread) / 4.5,
            abs(candidate.foldDensity - current.foldDensity) / 16.0,
            abs(candidate.curl - current.curl) / 3.0,
            abs(candidate.twist - current.twist) / 3.0,
            abs(candidate.edgeFlutter - current.edgeFlutter) / 0.35,
            abs(candidate.motionSpeed - current.motionSpeed) / 2.0,
            abs(candidate.turbulence - current.turbulence) / 2.0,
            abs(candidate.transmission - current.transmission),
            abs(candidate.rimStrength - current.rimStrength) / 2.0,
            abs(candidate.iridescence - current.iridescence) / 2.0,
            abs(candidate.saturation - current.saturation) / 1.5,
            abs(candidate.brightness - current.brightness) / 1.5,
            abs(Double(candidate.membraneCount - current.membraneCount)) / 5.0
        ]
        let scalarDelta = scalarTerms.reduce(0, +) / Double(max(1, scalarTerms.count))
        let score = paletteDelta * 0.40 + backgroundDelta * 0.30 + min(1, scalarDelta * 2.5) * 0.30
        return score < 0.115
    }

    private func averageColorDistance(_ a: [BettaImagineColor], _ b: [BettaImagineColor]) -> Double {
        let count = min(a.count, b.count)
        guard count > 0 else { return 0 }
        var total = 0.0
        for index in 0..<count {
            let dr = a[index].r - b[index].r
            let dg = a[index].g - b[index].g
            let db = a[index].b - b[index].b
            total += sqrt(dr * dr + dg * dg + db * db)
        }
        return total / Double(count)
    }
}
