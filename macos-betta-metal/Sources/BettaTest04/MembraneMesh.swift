import Foundation
import simd

/// The Form Generator primitive: a radial membrane. Geometry carries only
/// (u, v) - u runs root (0) to tip (1) along a ray, v sweeps the angular
/// spread. Every visible deformation happens in the vertex function from
/// constitution-derived uniforms; nothing about the shape is baked in here.
struct MembraneMesh {
    let uvs: [SIMD2<Float>]
    let indices: [UInt16]

    init(rays: Int = 48, radialSegments: Int = 32) {
        var uvs: [SIMD2<Float>] = []
        uvs.reserveCapacity((rays + 1) * (radialSegments + 1))
        for j in 0...rays {
            let v = Float(j) / Float(rays)
            for i in 0...radialSegments {
                let u = Float(i) / Float(radialSegments)
                uvs.append(SIMD2<Float>(u, v))
            }
        }

        var indices: [UInt16] = []
        indices.reserveCapacity(rays * radialSegments * 6)
        for j in 0..<rays {
            for i in 0..<radialSegments {
                let a = UInt16(j * (radialSegments + 1) + i)
                let b = UInt16(Int(a) + radialSegments + 1)
                indices.append(contentsOf: [a, b, a + 1])
                indices.append(contentsOf: [b, b + 1, a + 1])
            }
        }

        self.uvs = uvs
        self.indices = indices
    }
}
