import Foundation
import simd

/// Maps a generated style onto the engine's uniform layout.
///
/// This is the whole seam of Test 04: the constitution's generator on one side,
/// the production shader on the other, and nothing in between that decides
/// appearance. Field placement follows `BettaRenderer.makeFinUniforms`
/// exactly - if that mapping changes, this follows it.
enum UniformBuilder {
    static func fin(
        for style: GeneratedStyle,
        phase: Double,
        composition: Composition,
        surface: Surface,
        layer: Int
    ) -> FinUniforms {
        let isBack = layer == 1
        var u = FinUniforms()

        // The back layer sits slightly smaller and offset in depth; the overlap
        // between the two is where the engine's depth comes from.
        var model = composition.modelMatrix()
        if isBack {
            model = model * uniformScale(Float(style.backScale))
        }
        u.modelMatrix = model
        u.viewProjectionMatrix = Framing.mvp(aspect: surface.aspect)
        u.cameraPosition = SIMD4<Float>(0, 0, Framing.cameraDistance, 1)

        let layerPhase = isBack ? phase + style.phaseOffset : phase
        let layerSeed = isBack ? Double(style.seed % 977) + style.seedOffset
                               : Double(style.seed % 977)
        // morph is 1: a single style, not a transition between two.
        u.timeSeedPhaseMorph = SIMD4<Float>(
            Float(phase), Float(layerSeed), Float(layerPhase), 1
        )

        u.shape0 = SIMD4<Float>(
            Float(style.spread), Float(style.foldDensity),
            Float(style.curl), Float(style.twist)
        )
        u.shape1 = SIMD4<Float>(
            Float(style.edgeFlutter), Float(style.depth),
            Float(style.currentStrength), Float(style.motionSpeed)
        )
        u.shape2 = SIMD4<Float>(
            Float(style.turbulence), Float(style.motionAmplitude),
            Float(style.opacity), Float(style.transmission)
        )
        u.lighting = SIMD4<Float>(
            Float(style.rimStrength), Float(style.foldHighlight),
            Float(style.iridescence), Float(style.bloom)
        )
        u.grading = SIMD4<Float>(
            Float(style.gradingSaturation), Float(style.brightness),
            Float(style.gradientPosition),
            Float(isBack ? style.backAlpha : style.frontAlpha)
        )
        u.modes = SIMD4<Float>(
            Float(style.morphMode), Float(style.morphMode),
            NeutralDrivers.energy, NeutralDrivers.cloud
        )

        // No live input and no water interaction: held at the neutral values
        // BETTA-METAL-PARITY.md records, rather than invented here.
        u.satelliteA = SIMD4<Float>(
            NeutralDrivers.cold, NeutralDrivers.cooling,
            NeutralDrivers.texture, NeutralDrivers.vapor
        )
        u.satelliteB = SIMD4<Float>(NeutralDrivers.visible, 0, 0, surface.aspect)
        u.satelliteC = SIMD4<Float>(
            NeutralDrivers.motion.y,
            NeutralDrivers.color.x, NeutralDrivers.color.y, NeutralDrivers.color.z
        )
        u.fingerprint = .zero

        u.detail0 = SIMD4<Float>(
            Float(style.rayCount), Float(style.microFold),
            Float(style.rayDefinition), Float(style.edgeRuffle)
        )
        u.detail1 = SIMD4<Float>(
            Float(style.veinStrength), Float(style.membraneGrain),
            Float(style.fineFlutter), Float(style.normalDetail)
        )

        let palette = style.paletteLinear
        let stops = palette.map { SIMD4<Float>($0.x, $0.y, $0.z, 1) }
        u.color0From = stops[0]; u.color1From = stops[1]
        u.color2From = stops[2]; u.color3From = stops[3]
        u.color0To = stops[0]; u.color1To = stops[1]
        u.color2To = stops[2]; u.color3To = stops[3]

        return u
    }

    static func background(for style: GeneratedStyle) -> BackgroundUniforms {
        let stops = style.groundLinear.map { SIMD4<Float>($0.x, $0.y, $0.z, 1) }
        let satelliteMix = 0.025 + 0.025 * NeutralDrivers.cloud + 0.018 * NeutralDrivers.visible
        var b = BackgroundUniforms()
        b.bg0From = stops[0]; b.bg1From = stops[1]; b.bg2From = stops[2]
        b.bg0To = stops[0]; b.bg1To = stops[1]; b.bg2To = stops[2]
        b.satelliteColorMix = SIMD4<Float>(
            NeutralDrivers.color.x, NeutralDrivers.color.y, NeutralDrivers.color.z,
            satelliteMix
        )
        b.transition = SIMD4<Float>(1, 0, 0, 0)
        return b
    }

    private static func uniformScale(_ s: Float) -> simd_float4x4 {
        var m = matrix_identity_float4x4
        m.columns.0.x = s
        m.columns.1.y = s
        m.columns.2.z = s
        return m
    }
}
