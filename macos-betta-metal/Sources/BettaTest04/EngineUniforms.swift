import Foundation
import simd

/// Swift mirrors of the uniform structs in `../BettaMetalLab/Shaders.metal`.
///
/// Test 04 does not reimplement the renderer. That was the mistake this file
/// exists to undo: the frozen claim is about the *generator* holding zero
/// appearance decisions, and says nothing about writing a new renderer. Test 01
/// settled the principle already - "the engines are preserved, never
/// IDUI-ified: IDUI governs the interface's relationship with an engine, it
/// does not absorb one."
///
/// So the production shader is used verbatim, compiled from its own source
/// file at runtime. Only the *generator* feeding it is replaced. Nothing in
/// BettaMetalLab is edited, moved, or imported - which also keeps this target
/// clear of a codebase being actively worked on elsewhere.
///
/// Layout must match Shaders.metal exactly. Every member is float4 or float4x4,
/// so both languages align on 16 bytes and no padding can silently diverge.
struct FinUniforms {
    var modelMatrix: simd_float4x4 = matrix_identity_float4x4
    var viewProjectionMatrix: simd_float4x4 = matrix_identity_float4x4
    var cameraPosition: SIMD4<Float> = .zero
    /// time, seed, phase, morph
    var timeSeedPhaseMorph: SIMD4<Float> = .zero
    /// spread, foldDensity, curl, twist
    var shape0: SIMD4<Float> = .zero
    /// edgeFlutter, depth, currentStrength, motionSpeed
    var shape1: SIMD4<Float> = .zero
    /// turbulence, motionAmplitude, opacity, transmission
    var shape2: SIMD4<Float> = .zero
    /// rimStrength, foldHighlight, iridescence, bloom
    var lighting: SIMD4<Float> = .zero
    /// saturation, brightness, gradientPosition, layerAlpha
    var grading: SIMD4<Float> = .zero
    /// morphModeFrom, morphModeTo, energy, cloud
    var modes: SIMD4<Float> = .zero
    var satelliteA: SIMD4<Float> = .zero
    var satelliteB: SIMD4<Float> = .zero
    var satelliteC: SIMD4<Float> = .zero
    var fingerprint: SIMD4<Float> = .zero
    /// rayCount, microFold, rayDefinition, edgeRuffle
    var detail0: SIMD4<Float> = .zero
    /// veinStrength, membraneGrain, fineFlutter, normalDetail
    var detail1: SIMD4<Float> = .zero
    var color0From: SIMD4<Float> = .zero
    var color1From: SIMD4<Float> = .zero
    var color2From: SIMD4<Float> = .zero
    var color3From: SIMD4<Float> = .zero
    var color0To: SIMD4<Float> = .zero
    var color1To: SIMD4<Float> = .zero
    var color2To: SIMD4<Float> = .zero
    var color3To: SIMD4<Float> = .zero
}

struct BackgroundUniforms {
    var bg0From: SIMD4<Float> = .zero
    var bg1From: SIMD4<Float> = .zero
    var bg2From: SIMD4<Float> = .zero
    var bg0To: SIMD4<Float> = .zero
    var bg1To: SIMD4<Float> = .zero
    var bg2To: SIMD4<Float> = .zero
    /// r, g, b, mix
    var satelliteColorMix: SIMD4<Float> = .zero
    /// mix, unused, unused, unused
    var transition: SIMD4<Float> = .zero
}

/// The neutral environmental drivers recorded in BETTA-METAL-PARITY.md. Test 04
/// takes no live input, so these are held at the documented neutral values
/// rather than invented here.
enum NeutralDrivers {
    static let energy: Float = 0.58
    static let cloud: Float = 0.35
    static let cold: Float = 0.35
    static let cooling: Float = 0
    static let texture: Float = 0.32
    static let vapor: Float = 0.42
    static let motion = SIMD2<Float>(0, 0)
    static let color = SIMD3<Float>(0.18, 0.23, 0.52)
    static let visible: Float = 0
    static let fingerprint = SIMD3<Float>(0.5, 0.5, 0.5)
}
