import Foundation
import simd

struct MappedComposition {
    var position: SIMD3<Float>
    var scaleMultiplier: Float
    var rotationXOffset: Float
    var rotationYOffset: Float
    var rotationZOffset: Float
}

enum BettaLandscapeMapper {
    static func map(position source: SIMD3<Float>, aspect: Float, referenceId: Int, camera: BettaCameraAdjustment) -> MappedComposition {
        let orientationMix = smoothstep(0.95, 1.25, aspect)
        let adjustment = BettaCompositionStore.shared.adjustment(for: referenceId)

        guard orientationMix > 0 else {
            return MappedComposition(position: source, scaleMultiplier: 1, rotationXOffset: 0, rotationYOffset: 0, rotationZOffset: 0)
        }

        let fov = camera.fov * .pi / 180
        let depthFromCamera = max(0.5, camera.z - source.z)
        let halfHeight = tan(fov * 0.5) * depthFromCamera
        let sourceHalfWidth = halfHeight * BettaSettings.portraitReferenceAspect
        let targetHalfWidth = halfHeight * max(aspect, 0.001)

        let normalized = source.x / max(sourceHalfWidth, 0.001)
        let magnitude = abs(normalized)
        let targetMagnitude: Float = magnitude <= 1 ? magnitude : 1 + (magnitude - 1) * 0.55
        let mappedX = (normalized < 0 ? -1 : 1) * targetMagnitude * targetHalfWidth
        let autoX = lerp(source.x, mappedX, orientationMix)

        let position = SIMD3<Float>(
            autoX + adjustment.x * orientationMix,
            source.y + adjustment.y * orientationMix,
            source.z + adjustment.z * orientationMix
        )
        let scale = lerp(1, adjustment.scale, orientationMix)
        let degreesToRadians: Float = .pi / 180

        return MappedComposition(
            position: position,
            scaleMultiplier: scale,
            rotationXOffset: adjustment.rotationX * degreesToRadians * orientationMix,
            rotationYOffset: adjustment.rotationY * degreesToRadians * orientationMix,
            rotationZOffset: adjustment.rotationZ * degreesToRadians * orientationMix
        )
    }

    private static func smoothstep(_ edge0: Float, _ edge1: Float, _ x: Float) -> Float {
        let t = clamp01((x - edge0) / (edge1 - edge0))
        return t * t * (3 - 2 * t)
    }
}
