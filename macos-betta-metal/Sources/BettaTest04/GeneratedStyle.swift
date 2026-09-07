import Foundation

/// The complete output of one seed: a point in the constitution's space.
/// Framing is deliberately absent - it is fixed, never generated.
struct GeneratedStyle: Equatable {
    let seed: UInt64
    let baseHueDeg: Double
    let accentHueDeg: Double
    let baseSaturation: Double
    let baseLightness: Double
    let accentLightness: Double
    let backgroundLightness: Double
    let motionSpeed: Double
    let motionAmplitude: Double
    let turbulence: Double
    let currentStrength: Double
    let opacity: Double
    let transmission: Double
    let rimStrength: Double
    let bloom: Double
    let spread: Double
    let foldDensity: Double
    let curl: Double
    let twist: Double
    let edgeFlutter: Double
    let depth: Double
}
