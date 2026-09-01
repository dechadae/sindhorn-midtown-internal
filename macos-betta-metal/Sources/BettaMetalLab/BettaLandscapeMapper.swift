import Foundation
import simd

struct LandscapeOverride {
    var deltaX: Float = 0
    var deltaY: Float = 0
    var scaleMultiplier: Float = 1
}

struct MappedComposition {
    var position: SIMD3<Float>
    var scaleMultiplier: Float
}

enum BettaLandscapeMapper {
    // Intentionally empty for the first parity milestone. The mechanism exists so that
    // any later fish-specific correction remains a tiny delta on top of the shared map.
    private static let overrides: [Int: LandscapeOverride] = [:]

    static func map(position source: SIMD3<Float>, aspect: Float, referenceId: Int) -> MappedComposition {
        let override = overrides[referenceId] ?? LandscapeOverride()
        let orientationMix = smoothstep(0.95, 1.25, aspect)
        guard orientationMix > 0 else {
            return MappedComposition(
                position: source + SIMD3<Float>(override.deltaX, override.deltaY, 0),
                scaleMultiplier: override.scaleMultiplier
            )
        }

        let fov = BettaSettings.fovYDegrees * .pi / 180
        let depthFromCamera = max(0.5, BettaSettings.cameraZ - source.z)
        let halfHeight = tan(fov * 0.5) * depthFromCamera
        let sourceHalfWidth = halfHeight * BettaSettings.portraitReferenceAspect
        let targetHalfWidth = halfHeight * max(aspect, 0.001)

        // Preserve the portrait root's screen-edge intent rather than preserving its raw
        // world-space X. Roots already beyond the portrait frame remain beyond the edge,
        // but their overhang is compressed so landscape does not throw the organism away.
        let normalized = source.x / max(sourceHalfWidth, 0.001)
        let magnitude = abs(normalized)
        let targetMagnitude: Float
        if magnitude <= 1 {
            targetMagnitude = magnitude
        } else {
            targetMagnitude = 1 + (magnitude - 1) * 0.55
        }
        let mappedX = (normalized < 0 ? -1 : 1) * targetMagnitude * targetHalfWidth
        let x = lerp(source.x, mappedX, orientationMix) + override.deltaX
        let y = source.y + override.deltaY

        return MappedComposition(
            position: SIMD3<Float>(x, y, source.z),
            scaleMultiplier: override.scaleMultiplier
        )
    }

    private static func smoothstep(_ edge0: Float, _ edge1: Float, _ x: Float) -> Float {
        let t = clamp01((x - edge0) / (edge1 - edge0))
        return t * t * (3 - 2 * t)
    }
}
