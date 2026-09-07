import Foundation
import simd

/// One of the owner's eight locked compositions.
///
/// These were hand-tuned through the composition editor in BettaMetalLab and
/// live in that app's UserDefaults. The copy this target reads is exactly that
/// data, exported read-only; nothing here ever writes back. **Do not change a
/// locked composition.**
///
/// They are editorial crops, not containers. Every one is scaled up (1.25-1.90)
/// and pushed off-centre - fish 7 sits at the clamp ceiling, x = 8.0 - because
/// the artwork is cropped the way a designer crops artwork. The organism is
/// meant to run past the frame edge. A contract that demands the form be wholly
/// visible would reject all eight, which is how the first version of R1 came to
/// be measuring its own assumption rather than the output.
struct Composition: Codable, Equatable {
    let scale: Float
    let x: Float
    let y: Float
    let z: Float
    let rotationX: Float
    let rotationY: Float
    let rotationZ: Float

    /// The model transform this composition applies to the organism.
    func modelMatrix() -> simd_float4x4 {
        let rx = rotation(radians: rotationX * .pi / 180, axis: SIMD3<Float>(1, 0, 0))
        let ry = rotation(radians: rotationY * .pi / 180, axis: SIMD3<Float>(0, 1, 0))
        let rz = rotation(radians: rotationZ * .pi / 180, axis: SIMD3<Float>(0, 0, 1))
        var m = translation(SIMD3<Float>(x, y, z)) * rz * ry * rx
        m = m * scaling(scale)
        return m
    }

    private func translation(_ t: SIMD3<Float>) -> simd_float4x4 {
        var m = matrix_identity_float4x4
        m.columns.3 = SIMD4<Float>(t.x, t.y, t.z, 1)
        return m
    }

    private func scaling(_ s: Float) -> simd_float4x4 {
        var m = matrix_identity_float4x4
        m.columns.0.x = s
        m.columns.1.y = s
        m.columns.2.z = s
        return m
    }

    private func rotation(radians: Float, axis: SIMD3<Float>) -> simd_float4x4 {
        let a = simd_normalize(axis)
        let c = cos(radians), s = sin(radians), t = 1 - c
        return simd_float4x4(
            SIMD4<Float>(t * a.x * a.x + c, t * a.x * a.y + s * a.z, t * a.x * a.z - s * a.y, 0),
            SIMD4<Float>(t * a.x * a.y - s * a.z, t * a.y * a.y + c, t * a.y * a.z + s * a.x, 0),
            SIMD4<Float>(t * a.x * a.z + s * a.y, t * a.y * a.z - s * a.x, t * a.z * a.z + c, 0),
            SIMD4<Float>(0, 0, 0, 1)
        )
    }
}

enum LockedCompositions {
    /// Keyed 1...8, matching the reference ids in BettaMetalLab.
    static func load() throws -> [Int: Composition] {
        guard let url = Bundle.module.url(forResource: "locked-compositions", withExtension: "json") else {
            throw NSError(domain: "BettaTest04", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "locked-compositions.json missing from the bundle"
            ])
        }
        let raw = try JSONDecoder().decode([String: Composition].self, from: Data(contentsOf: url))
        var byId: [Int: Composition] = [:]
        for (key, value) in raw {
            if let id = Int(key), (1...8).contains(id) { byId[id] = value }
        }
        return byId
    }
}

extension Composition {
    /// A plain landscape framing for cases that are not testing composition -
    /// negative controls, contract sampling. The quarter turn matches the
    /// engine's landscape default.
    static let neutralLandscape = Composition(
        scale: 1.6, x: 0, y: 0, z: 0,
        rotationX: 0, rotationY: 0, rotationZ: 90
    )
}
