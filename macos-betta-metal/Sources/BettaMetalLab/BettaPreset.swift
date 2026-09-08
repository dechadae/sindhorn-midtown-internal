import Foundation
import simd

struct BettaLayer {
    let seed: Float
    let scale: Float
    let rotation: Float
    let offset: SIMD3<Float>
    let alpha: Float
    let phase: Float
}

struct BettaParams {
    let spread: Float
    let rayCount: Int
    let foldDensity: Float
    let curl: Float
    let twist: Float
    let edgeFlutter: Float
    let depth: Float
    let currentStrength: Float
    let motionSpeed: Float
    let turbulence: Float
    let motionAmplitude: Float
    let opacity: Float
    let transmission: Float
    let rimStrength: Float
    let foldHighlight: Float
    let iridescence: Float
    let bloom: Float
    let saturation: Float
    let brightness: Float
    let gradientPosition: Float
    let scale: Float
    let rotation: Float
    let rotationX: Float
    let rotationY: Float
    let tiltStrength: Float
    let cameraDepth: Float
    let offsetX: Float
    let offsetY: Float
}

struct BettaPreset {
    let referenceId: Int
    let number: String
    let name: String
    let morphMode: Float
    let background: [SIMD3<Float>]
    let palette: [SIMD3<Float>]
    let params: BettaParams
    let layers: [BettaLayer]
}

private func srgbToLinear(_ value: Float) -> Float {
    if value <= 0.04045 { return value / 12.92 }
    return pow((value + 0.055) / 1.055, 2.4)
}

private func rgb(_ hex: String) -> SIMD3<Float> {
    let cleaned = hex.replacingOccurrences(of: "#", with: "")
    let value = UInt32(cleaned, radix: 16) ?? 0
    return SIMD3<Float>(
        srgbToLinear(Float((value >> 16) & 0xff) / 255),
        srgbToLinear(Float((value >> 8) & 0xff) / 255),
        srgbToLinear(Float(value & 0xff) / 255)
    )
}

extension BettaPreset {
    static let all: [BettaPreset] = [
        BettaPreset(referenceId: 1, number: "01", name: "Cobalt + Orange Halfmoon", morphMode: 2, background: [rgb("#070b18"), rgb("#102746"), rgb("#351713")], palette: [rgb("#0a2454"), rgb("#237fd2"), rgb("#ef421f"), rgb("#ff8a48")], params: BettaParams(spread: 3.15, rayCount: 80, foldDensity: 9.6, curl: 0.42, twist: 0.08, edgeFlutter: 0.070, depth: 0.58, currentStrength: 0.20, motionSpeed: 0.34, turbulence: 0.16, motionAmplitude: 0.37, opacity: 0.62, transmission: 0.71, rimStrength: 1.10, foldHighlight: 1.16, iridescence: 0.27, bloom: 0.36, saturation: 1.34, brightness: 1.72, gradientPosition: 0.015, scale: 1.11, rotation: 3.14, rotationX: 0.09, rotationY: -0.61, tiltStrength: 0.18, cameraDepth: 0.10, offsetX: 1.88, offsetY: -0.80), layers: [BettaLayer(seed: 71.1, scale: 1.00, rotation: 0, offset: SIMD3<Float>(0, 0, 0.06), alpha: 0.96, phase: 1.2), BettaLayer(seed: 74.8, scale: 0.94, rotation: 0.055, offset: SIMD3<Float>(0.06, 0.01, -0.10), alpha: 0.28, phase: 17.6)]),
        BettaPreset(referenceId: 2, number: "02", name: "Super Red Halfmoon", morphMode: 0, background: [rgb("#120508"), rgb("#36090d"), rgb("#521611")], palette: [rgb("#090103"), rgb("#5e0506"), rgb("#e6180e"), rgb("#ff5a20")], params: BettaParams(spread: 3.22, rayCount: 80, foldDensity: 10.4, curl: 0.25, twist: 0.035, edgeFlutter: 0.050, depth: 0.56, currentStrength: 0.18, motionSpeed: 0.32, turbulence: 0.13, motionAmplitude: 0.34, opacity: 0.66, transmission: 0.66, rimStrength: 1.10, foldHighlight: 1.22, iridescence: 0.08, bloom: 0.35, saturation: 1.42, brightness: 1.76, gradientPosition: -0.08, scale: 0.92, rotation: -0.22, rotationX: 0.24, rotationY: -0.53, tiltStrength: 0.16, cameraDepth: 0.80, offsetX: -1.90, offsetY: -0.48), layers: [BettaLayer(seed: 82.4, scale: 1.00, rotation: 0, offset: SIMD3<Float>(0, 0, 0.07), alpha: 0.98, phase: 4.9), BettaLayer(seed: 87.1, scale: 0.955, rotation: -0.035, offset: SIMD3<Float>(-0.02, 0.025, -0.10), alpha: 0.23, phase: 21.2)]),
        BettaPreset(referenceId: 3, number: "03", name: "Coral Magenta Flow", morphMode: 0, background: [rgb("#100712"), rgb("#3a1026"), rgb("#511c20")], palette: [rgb("#652047"), rgb("#d33d86"), rgb("#ff755f"), rgb("#e8b1d6")], params: BettaParams(spread: 3.00, rayCount: 76, foldDensity: 9.4, curl: 0.70, twist: 0.26, edgeFlutter: 0.085, depth: 0.64, currentStrength: 0.20, motionSpeed: 0.35, turbulence: 0.19, motionAmplitude: 0.40, opacity: 0.61, transmission: 0.74, rimStrength: 1.08, foldHighlight: 1.16, iridescence: 0.24, bloom: 0.37, saturation: 1.40, brightness: 1.78, gradientPosition: 0.025, scale: 0.97, rotation: 2.29, rotationX: -0.42, rotationY: 0.71, tiltStrength: 0.20, cameraDepth: 0.04, offsetX: 1.98, offsetY: -0.64), layers: [BettaLayer(seed: 93.6, scale: 1.00, rotation: -0.025, offset: SIMD3<Float>(-0.02, -0.03, 0.09), alpha: 0.95, phase: 8.7), BettaLayer(seed: 98.2, scale: 0.90, rotation: 0.14, offset: SIMD3<Float>(0.08, 0.08, -0.13), alpha: 0.34, phase: 26.4)]),
        BettaPreset(referenceId: 4, number: "04", name: "Pearl Blush Veiltail", morphMode: 2, background: [rgb("#08111b"), rgb("#183647"), rgb("#45221f")], palette: [rgb("#fbfdff"), rgb("#9fdaf0"), rgb("#ff4d3f"), rgb("#ff9a82")], params: BettaParams(spread: 2.68, rayCount: 72, foldDensity: 8.7, curl: 0.94, twist: -0.46, edgeFlutter: 0.105, depth: 0.52, currentStrength: 0.17, motionSpeed: 0.30, turbulence: 0.16, motionAmplitude: 0.34, opacity: 0.50, transmission: 0.91, rimStrength: 1.08, foldHighlight: 1.08, iridescence: 0.16, bloom: 0.34, saturation: 1.24, brightness: 1.84, gradientPosition: 0.035, scale: 1.26, rotation: -0.03, rotationX: -0.51, rotationY: 0.54, tiltStrength: 0.17, cameraDepth: 0.12, offsetX: -1.76, offsetY: -0.36), layers: [BettaLayer(seed: 104.4, scale: 1.00, rotation: -0.03, offset: SIMD3<Float>(-0.02, -0.04, 0.11), alpha: 0.89, phase: 12.1), BettaLayer(seed: 109.7, scale: 0.84, rotation: 0.24, offset: SIMD3<Float>(0.12, 0.13, -0.15), alpha: 0.38, phase: 31.5)]),
        BettaPreset(referenceId: 5, number: "05", name: "Mustard Galaxy Koi", morphMode: 1, background: [rgb("#071017"), rgb("#163847"), rgb("#46310e")], palette: [rgb("#67d7e9"), rgb("#071820"), rgb("#e5b13b"), rgb("#fff8ea")], params: BettaParams(spread: 2.78, rayCount: 72, foldDensity: 9.8, curl: 0.82, twist: 0.34, edgeFlutter: 0.120, depth: 0.66, currentStrength: 0.20, motionSpeed: 0.35, turbulence: 0.23, motionAmplitude: 0.41, opacity: 0.64, transmission: 0.72, rimStrength: 1.14, foldHighlight: 1.22, iridescence: 0.34, bloom: 0.40, saturation: 1.40, brightness: 1.76, gradientPosition: -0.05, scale: 1.06, rotation: -3.14, rotationX: -0.52, rotationY: 0.17, tiltStrength: 0.21, cameraDepth: 0.08, offsetX: 2.16, offsetY: 0.16), layers: [BettaLayer(seed: 116.2, scale: 1.00, rotation: -0.05, offset: SIMD3<Float>(-0.03, -0.02, 0.10), alpha: 0.94, phase: 15.8), BettaLayer(seed: 121.6, scale: 0.82, rotation: 0.22, offset: SIMD3<Float>(0.12, 0.10, -0.15), alpha: 0.48, phase: 36.7)]),
        BettaPreset(referenceId: 6, number: "06", name: "Wine Orchid Halfmoon", morphMode: 4, background: [rgb("#100713"), rgb("#3d132b"), rgb("#553715")], palette: [rgb("#21152f"), rgb("#5c1748"), rgb("#c42f79"), rgb("#e7ae61")], params: BettaParams(spread: 3.24, rayCount: 80, foldDensity: 10.8, curl: 0.34, twist: -0.035, edgeFlutter: 0.055, depth: 0.56, currentStrength: 0.18, motionSpeed: 0.32, turbulence: 0.13, motionAmplitude: 0.34, opacity: 0.64, transmission: 0.71, rimStrength: 1.16, foldHighlight: 1.30, iridescence: 0.29, bloom: 0.39, saturation: 1.31, brightness: 1.72, gradientPosition: -0.01, scale: 1.02, rotation: 0.30, rotationX: 0.38, rotationY: -0.18, tiltStrength: 0.18, cameraDepth: 0.09, offsetX: -1.62, offsetY: -0.58), layers: [BettaLayer(seed: 128.4, scale: 1.00, rotation: 0, offset: SIMD3<Float>(0, 0, 0.07), alpha: 0.97, phase: 19.4), BettaLayer(seed: 133.8, scale: 0.95, rotation: 0.035, offset: SIMD3<Float>(0.025, -0.02, -0.10), alpha: 0.25, phase: 40.2)]),
        BettaPreset(referenceId: 7, number: "07", name: "Steel Blue Rosetail", morphMode: 4, background: [rgb("#071116"), rgb("#193946"), rgb("#3c242c")], palette: [rgb("#061820"), rgb("#17495b"), rgb("#4e91a5"), rgb("#d7a49a")], params: BettaParams(spread: 3.42, rayCount: 80, foldDensity: 11.6, curl: 1.02, twist: 0.43, edgeFlutter: 0.165, depth: 0.78, currentStrength: 0.19, motionSpeed: 0.29, turbulence: 0.27, motionAmplitude: 0.41, opacity: 0.58, transmission: 0.79, rimStrength: 1.22, foldHighlight: 1.30, iridescence: 0.30, bloom: 0.40, saturation: 1.22, brightness: 1.68, gradientPosition: 0.02, scale: 1.00, rotation: -0.89, rotationX: 0.41, rotationY: -0.32, tiltStrength: 0.22, cameraDepth: 0.11, offsetX: -1.86, offsetY: 0.26), layers: [BettaLayer(seed: 141.5, scale: 1.00, rotation: -0.02, offset: SIMD3<Float>(-0.03, 0, 0.11), alpha: 0.93, phase: 23.6), BettaLayer(seed: 147.9, scale: 0.80, rotation: 0.22, offset: SIMD3<Float>(0.13, 0.09, -0.18), alpha: 0.52, phase: 45.1)]),
        BettaPreset(referenceId: 8, number: "08", name: "Electric Blue Halfmoon", morphMode: 4, background: [rgb("#050b1c"), rgb("#0c285a"), rgb("#143472")], palette: [rgb("#020a20"), rgb("#0a2f71"), rgb("#1677d2"), rgb("#79b9f4")], params: BettaParams(spread: 3.28, rayCount: 80, foldDensity: 11.2, curl: 0.27, twist: 0.018, edgeFlutter: 0.048, depth: 0.56, currentStrength: 0.17, motionSpeed: 0.30, turbulence: 0.12, motionAmplitude: 0.33, opacity: 0.66, transmission: 0.68, rimStrength: 1.18, foldHighlight: 1.26, iridescence: 0.36, bloom: 0.42, saturation: 1.34, brightness: 1.72, gradientPosition: -0.035, scale: 1.06, rotation: -3.14, rotationX: 0.30, rotationY: -0.56, tiltStrength: 0.19, cameraDepth: 0.10, offsetX: 1.84, offsetY: 0.18), layers: [BettaLayer(seed: 155.2, scale: 1.00, rotation: 0, offset: SIMD3<Float>(0, 0, 0.07), alpha: 0.98, phase: 27.8), BettaLayer(seed: 161.4, scale: 0.955, rotation: -0.025, offset: SIMD3<Float>(-0.02, 0.02, -0.11), alpha: 0.24, phase: 49.3)])
    ]
}
