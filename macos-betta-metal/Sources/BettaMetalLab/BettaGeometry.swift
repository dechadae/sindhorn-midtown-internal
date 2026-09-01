import Metal
import Foundation

struct BettaVertex {
    var u: Float
    var v: Float
    var rayJitter: Float
}

struct BettaGeometry {
    static let rays = 80
    static let radialSegments = 72

    let vertexBuffer: MTLBuffer
    let indexBuffer: MTLBuffer
    let indexCount: Int

    init(device: MTLDevice) throws {
        var vertices: [BettaVertex] = []
        vertices.reserveCapacity((Self.rays + 1) * (Self.radialSegments + 1))

        var jitters = [Float](repeating: 0, count: Self.rays + 1)
        for j in 0...Self.rays {
            let jf = Double(j)
            let n = sin((jf + 1) * 12.9898 + 78.233) * 43758.5453
            let m = sin((jf + 7) * 4.123 + 21.731) * 15731.743
            let jitter = ((n - floor(n)) - 0.5) * 1.4 + ((m - floor(m)) - 0.5) * 0.6
            jitters[j] = Float(jitter)
            for i in 0...Self.radialSegments {
                vertices.append(BettaVertex(
                    u: Float(i) / Float(Self.radialSegments),
                    v: Float(j) / Float(Self.rays),
                    rayJitter: jitters[j]
                ))
            }
        }

        var indices: [UInt16] = []
        indices.reserveCapacity(Self.rays * Self.radialSegments * 6)
        let row = Self.radialSegments + 1
        for j in 0..<Self.rays {
            for i in 0..<Self.radialSegments {
                let a = j * row + i
                let b = a + row
                indices.append(UInt16(a))
                indices.append(UInt16(b))
                indices.append(UInt16(a + 1))
                indices.append(UInt16(b))
                indices.append(UInt16(b + 1))
                indices.append(UInt16(a + 1))
            }
        }

        guard let vb = device.makeBuffer(bytes: vertices, length: MemoryLayout<BettaVertex>.stride * vertices.count, options: .storageModeShared),
              let ib = device.makeBuffer(bytes: indices, length: MemoryLayout<UInt16>.stride * indices.count, options: .storageModeShared) else {
            throw BettaRendererError.bufferAllocationFailed
        }
        vb.label = "Betta radial membrane vertices 80x72"
        ib.label = "Betta membrane triangle indices"
        vertexBuffer = vb
        indexBuffer = ib
        indexCount = indices.count
    }
}
