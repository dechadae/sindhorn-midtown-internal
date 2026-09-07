import Foundation
import simd

/// The Framing primitive: fixed, never touched by a seed (owner decision,
/// 2026-09-07), matching the existing engine's precedent of keeping camera
/// keys preset-owned.
///
/// Because it is fixed while `form.spread` varies the angular sweep, framing
/// robustness across surface shapes is this primitive's burden to carry - which
/// is what prediction P1 expects to fail.
enum Framing {
    static let cameraDistance: Float = 5.5
    static let verticalFieldOfViewDegrees: Float = 45

    static func mvp(aspect: Float) -> simd_float4x4 {
        perspective(
            fovyRadians: verticalFieldOfViewDegrees * .pi / 180,
            aspect: aspect,
            near: 0.5,
            far: 20
        ) * lookAt(
            eye: SIMD3<Float>(0, 0, cameraDistance),
            center: SIMD3<Float>(0, 0, 0),
            up: SIMD3<Float>(0, 1, 0)
        )
    }

    private static func perspective(fovyRadians: Float, aspect: Float, near: Float, far: Float) -> simd_float4x4 {
        let y = 1 / tan(fovyRadians * 0.5)
        let x = y / aspect
        let z = far / (near - far)
        return simd_float4x4(
            SIMD4<Float>(x, 0, 0, 0),
            SIMD4<Float>(0, y, 0, 0),
            SIMD4<Float>(0, 0, z, -1),
            SIMD4<Float>(0, 0, z * near, 0)
        )
    }

    private static func lookAt(eye: SIMD3<Float>, center: SIMD3<Float>, up: SIMD3<Float>) -> simd_float4x4 {
        let f = simd_normalize(center - eye)
        let s = simd_normalize(simd_cross(f, up))
        let u = simd_cross(s, f)
        return simd_float4x4(
            SIMD4<Float>(s.x, u.x, -f.x, 0),
            SIMD4<Float>(s.y, u.y, -f.y, 0),
            SIMD4<Float>(s.z, u.z, -f.z, 0),
            SIMD4<Float>(-simd_dot(s, eye), -simd_dot(u, eye), simd_dot(f, eye), 1)
        )
    }
}
