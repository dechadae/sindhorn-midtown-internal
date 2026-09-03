import Foundation
import simd

@inline(__always) func clamp01(_ value: Float) -> Float {
    min(1, max(0, value))
}

@inline(__always) func lerp(_ a: Float, _ b: Float, _ t: Float) -> Float {
    a + (b - a) * t
}

@inline(__always) func lerp(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ t: Float) -> SIMD3<Float> {
    a + (b - a) * t
}

@inline(__always) func lerpAngle(_ a: Float, _ b: Float, _ t: Float) -> Float {
    let tau = Float.pi * 2
    var delta = (b - a).truncatingRemainder(dividingBy: tau)
    if delta > .pi { delta -= tau }
    if delta < -.pi { delta += tau }
    return a + delta * t
}

@inline(__always) func cubicOut(_ t: Float) -> Float {
    let x = 1 - clamp01(t)
    return 1 - x * x * x
}

/// Symmetric fifth-order smoothstep. Zero velocity and zero acceleration at
/// both ends make long Betta-to-Betta morphs feel continuous rather than like
/// an animation that launches quickly and merely coasts to a stop.
@inline(__always) func smootherstep(_ t: Float) -> Float {
    let x = clamp01(t)
    return x * x * x * (x * (x * 6 - 15) + 10)
}

func translationMatrix(_ v: SIMD3<Float>) -> simd_float4x4 {
    simd_float4x4(columns: (
        SIMD4<Float>(1, 0, 0, 0),
        SIMD4<Float>(0, 1, 0, 0),
        SIMD4<Float>(0, 0, 1, 0),
        SIMD4<Float>(v.x, v.y, v.z, 1)
    ))
}

func uniformScaleMatrix(_ s: Float) -> simd_float4x4 {
    simd_float4x4(columns: (
        SIMD4<Float>(s, 0, 0, 0),
        SIMD4<Float>(0, s, 0, 0),
        SIMD4<Float>(0, 0, s, 0),
        SIMD4<Float>(0, 0, 0, 1)
    ))
}

func rotationXMatrix(_ angle: Float) -> simd_float4x4 {
    let c = cos(angle), s = sin(angle)
    return simd_float4x4(columns: (
        SIMD4<Float>(1, 0, 0, 0),
        SIMD4<Float>(0, c, s, 0),
        SIMD4<Float>(0, -s, c, 0),
        SIMD4<Float>(0, 0, 0, 1)
    ))
}

func rotationYMatrix(_ angle: Float) -> simd_float4x4 {
    let c = cos(angle), s = sin(angle)
    return simd_float4x4(columns: (
        SIMD4<Float>(c, 0, -s, 0),
        SIMD4<Float>(0, 1, 0, 0),
        SIMD4<Float>(s, 0, c, 0),
        SIMD4<Float>(0, 0, 0, 1)
    ))
}

func rotationZMatrix(_ angle: Float) -> simd_float4x4 {
    let c = cos(angle), s = sin(angle)
    return simd_float4x4(columns: (
        SIMD4<Float>(c, s, 0, 0),
        SIMD4<Float>(-s, c, 0, 0),
        SIMD4<Float>(0, 0, 1, 0),
        SIMD4<Float>(0, 0, 0, 1)
    ))
}

func perspectiveRHMetal(fovYRadians: Float, aspect: Float, near: Float, far: Float) -> simd_float4x4 {
    let y = 1 / tan(fovYRadians * 0.5)
    let x = y / max(aspect, 0.001)
    let z = far / (near - far)
    let wz = (near * far) / (near - far)
    return simd_float4x4(columns: (
        SIMD4<Float>(x, 0, 0, 0),
        SIMD4<Float>(0, y, 0, 0),
        SIMD4<Float>(0, 0, z, -1),
        SIMD4<Float>(0, 0, wz, 0)
    ))
}
