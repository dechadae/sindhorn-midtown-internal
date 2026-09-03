import Foundation

enum BettaRunMode: Equatable {
    case live
    case manual(Int)
    case preview
}

struct BettaSettings {
    static let bangkokTimeZone = TimeZone(identifier: "Asia/Bangkok")!
    static let fovYDegrees: Float = 32
    static let nearPlane: Float = 0.1
    static let farPlane: Float = 50
    static let cameraZ: Float = 9
    static let portraitReferenceAspect: Float = 9.0 / 16.0

    // Premium pacing. Fish-to-fish changes should feel like one living organism
    // slowly becoming another. Randomization and direct studio adjustments remain
    // immediate because they mutate the current organism in place rather than
    // entering this preset-to-preset morph path.
    static let manualMorphSeconds: TimeInterval = 18
    static let liveRolloverSeconds: TimeInterval = 90
    static let previewCycleSeconds: TimeInterval = 180
    static let previewMorphSeconds: TimeInterval = 12
    static let preferredFPS = 60

    // Exact deterministic neutral satellite state from production betta-environment.js.
    static let neutralSatellite = NeutralSatelliteState(
        energy: 0.58,
        cloud: 0.35,
        cold: 0.35,
        cooling: 0,
        texture: 0.32,
        vapor: 0.42,
        visible: 0,
        motion: .zero,
        color: SIMD3<Float>(0.18, 0.23, 0.52),
        fingerprint: SIMD3<Float>(repeating: 0.5)
    )
}

struct NeutralSatelliteState {
    var energy: Float
    var cloud: Float
    var cold: Float
    var cooling: Float
    var texture: Float
    var vapor: Float
    var visible: Float
    var motion: SIMD2<Float>
    var color: SIMD3<Float>
    var fingerprint: SIMD3<Float>
}
