import Foundation
import Metal

/// The production mesh, rebuilt to the same specification rather than
/// reimplemented: 160 rays x 144 radial segments, each vertex carrying (u, v,
/// rayJitter), with the same two-frequency jitter the engine uses.
///
/// This is deliberately identical to `BettaGeometry` in BettaMetalLab. It is
/// duplicated rather than imported only because SwiftPM cannot import an
/// executable target, and restructuring that package while it is being edited
/// elsewhere would be reckless. The values are not tuned here and must not
/// drift: if the engine's geometry changes, this follows it.
struct EngineGeometry {
    static let rays = 160
    static let radialSegments = 144

    let vertexBuffer: MTLBuffer
    let indexBuffer: MTLBuffer
    let indexCount: Int

    init(device: MTLDevice,
         rays: Int = EngineGeometry.rays,
         radialSegments: Int = EngineGeometry.radialSegments) throws {
        struct Vertex { var u: Float; var v: Float; var rayJitter: Float }

        var vertices: [Vertex] = []
        vertices.reserveCapacity((rays + 1) * (radialSegments + 1))

        var jitters = [Float](repeating: 0, count: rays + 1)
        for j in 0...rays {
            let jf = Double(j)
            let n = sin((jf + 1) * 12.9898 + 78.233) * 43758.5453
            let m = sin((jf + 7) * 4.123 + 21.731) * 15731.743
            jitters[j] = Float(((n - floor(n)) - 0.5) * 1.4 + ((m - floor(m)) - 0.5) * 0.6)
        }

        for j in 0...rays {
            let v = Float(j) / Float(rays)
            for i in 0...radialSegments {
                vertices.append(Vertex(
                    u: Float(i) / Float(radialSegments),
                    v: v,
                    rayJitter: jitters[j]
                ))
            }
        }

        var indices: [UInt32] = []
        indices.reserveCapacity(rays * radialSegments * 6)
        for j in 0..<rays {
            for i in 0..<radialSegments {
                let a = UInt32(j * (radialSegments + 1) + i)
                let b = a + UInt32(radialSegments + 1)
                indices.append(contentsOf: [a, b, a + 1, b, b + 1, a + 1])
            }
        }

        guard let vertexBuffer = device.makeBuffer(
            bytes: vertices,
            length: MemoryLayout<Vertex>.stride * vertices.count,
            options: .storageModeShared
        ), let indexBuffer = device.makeBuffer(
            bytes: indices,
            length: MemoryLayout<UInt32>.stride * indices.count,
            options: .storageModeShared
        ) else {
            throw RendererError.noDevice
        }

        self.vertexBuffer = vertexBuffer
        self.indexBuffer = indexBuffer
        self.indexCount = indices.count
    }

    /// Matches `FinVertexIn`: three separate float attributes, interleaved.
    static func vertexDescriptor() -> MTLVertexDescriptor {
        let descriptor = MTLVertexDescriptor()
        for index in 0..<3 {
            descriptor.attributes[index].format = .float
            descriptor.attributes[index].offset = index * MemoryLayout<Float>.stride
            descriptor.attributes[index].bufferIndex = 0
        }
        descriptor.layouts[0].stride = MemoryLayout<Float>.stride * 3
        return descriptor
    }
}
