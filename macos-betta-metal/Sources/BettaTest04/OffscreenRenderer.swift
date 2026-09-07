import Foundation

/// Shared render types. The renderer itself is `EngineRenderer`, which drives
/// the production shader; Test 04 no longer carries one of its own.
struct Frame {
    let width: Int
    let height: Int
    /// RGBA8, row-major, tightly packed.
    let pixels: [UInt8]

    func pixel(x: Int, y: Int) -> (r: UInt8, g: UInt8, b: UInt8, a: UInt8) {
        let i = (y * width + x) * 4
        return (pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    }
}

struct Surface {
    let name: String
    let width: Int
    let height: Int

    var aspect: Float { Float(width) / Float(height) }
}

enum RendererError: Error, CustomStringConvertible {
    case noDevice
    case libraryFailed(String)
    case pipelineFailed(String)
    case encodingFailed

    var description: String {
        switch self {
        case .noDevice: return "No Metal device available"
        case .libraryFailed(let m): return "Shader library failed: \(m)"
        case .pipelineFailed(let m): return "Pipeline failed: \(m)"
        case .encodingFailed: return "Could not encode the render pass"
        }
    }
}
