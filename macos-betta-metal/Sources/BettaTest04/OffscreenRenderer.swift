import Foundation
import Metal
import simd

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

/// Uniforms shared with the Metal source. All members are Float on purpose:
/// a struct of scalars has the same 4-byte packing in Swift and MSL, so no
/// alignment mismatch can silently corrupt a parameter. A float3 here would
/// align to 16 and quietly shift everything after it.
struct MembraneUniforms {
    var spread: Float = 0
    var foldDensity: Float = 0
    var curl: Float = 0
    var twist: Float = 0
    var edgeFlutter: Float = 0
    var depth: Float = 0
    var phase: Float = 0
    var amplitude: Float = 0
    var turbulence: Float = 0
    var currentStrength: Float = 0
    var opacity: Float = 0
    var transmission: Float = 0
    var rimStrength: Float = 0
    var bloom: Float = 0
    var baseR: Float = 0
    var baseG: Float = 0
    var baseB: Float = 0
    var accentR: Float = 0
    var accentG: Float = 0
    var accentB: Float = 0
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

/// Offscreen renderer. No window, no display, no run loop - which is the point:
/// thousands of frames can be sampled headlessly, where the Android path capped
/// out at one manual screencap.
final class OffscreenRenderer {
    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let uvBuffer: MTLBuffer
    private let indexBuffer: MTLBuffer
    private let indexCount: Int

    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else { throw RendererError.noDevice }
        self.device = device
        guard let queue = device.makeCommandQueue() else { throw RendererError.noDevice }
        self.queue = queue

        // Runtime compilation: this machine has no offline Metal compiler.
        let library: MTLLibrary
        do {
            library = try device.makeLibrary(source: membraneShaderSource, options: nil)
        } catch {
            throw RendererError.libraryFailed("\(error)")
        }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "membraneVertex")
        descriptor.fragmentFunction = library.makeFunction(name: "membraneFragment")
        let attachment = descriptor.colorAttachments[0]!
        attachment.pixelFormat = .rgba8Unorm
        attachment.isBlendingEnabled = true
        attachment.rgbBlendOperation = .add
        attachment.alphaBlendOperation = .add
        attachment.sourceRGBBlendFactor = .sourceAlpha
        attachment.sourceAlphaBlendFactor = .sourceAlpha
        attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
        attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha

        do {
            pipeline = try device.makeRenderPipelineState(descriptor: descriptor)
        } catch {
            throw RendererError.pipelineFailed("\(error)")
        }

        let mesh = MembraneMesh()
        guard let uvBuffer = device.makeBuffer(
            bytes: mesh.uvs,
            length: MemoryLayout<SIMD2<Float>>.stride * mesh.uvs.count,
            options: .storageModeShared
        ), let indexBuffer = device.makeBuffer(
            bytes: mesh.indices,
            length: MemoryLayout<UInt16>.stride * mesh.indices.count,
            options: .storageModeShared
        ) else {
            throw RendererError.noDevice
        }
        self.uvBuffer = uvBuffer
        self.indexBuffer = indexBuffer
        self.indexCount = mesh.indices.count
    }

    /// The ground the form is drawn against. Neutral grey at the constitution's
    /// declared backgroundLightness - no tint coefficient, because any such
    /// coefficient would be an appearance decision invented here, and because
    /// the T6 contract compares lightness alone.
    static func backgroundColor(for style: GeneratedStyle) -> (Double, Double, Double) {
        (style.backgroundLightness, style.backgroundLightness, style.backgroundLightness)
    }

    func uniforms(for style: GeneratedStyle, phase: Double) -> MembraneUniforms {
        let base = hslToRgb(
            hueDeg: style.baseHueDeg,
            saturation: style.baseSaturation,
            lightness: style.baseLightness
        )
        let accent = hslToRgb(
            hueDeg: style.accentHueDeg,
            saturation: style.baseSaturation,
            lightness: style.accentLightness
        )
        var u = MembraneUniforms()
        u.spread = Float(style.spread)
        u.foldDensity = Float(style.foldDensity)
        u.curl = Float(style.curl)
        u.twist = Float(style.twist)
        u.edgeFlutter = Float(style.edgeFlutter)
        u.depth = Float(style.depth)
        u.phase = Float(phase)
        u.amplitude = Float(style.motionAmplitude)
        u.turbulence = Float(style.turbulence)
        u.currentStrength = Float(style.currentStrength)
        u.opacity = Float(style.opacity)
        u.transmission = Float(style.transmission)
        u.rimStrength = Float(style.rimStrength)
        u.bloom = Float(style.bloom)
        u.baseR = Float(base.0); u.baseG = Float(base.1); u.baseB = Float(base.2)
        u.accentR = Float(accent.0); u.accentG = Float(accent.1); u.accentB = Float(accent.2)
        return u
    }

    /// Phase for a seed at a fixed elapsed time on a pinned clock. Computed and
    /// set directly - the clock is never waited on.
    static func phase(for style: GeneratedStyle, atSeconds t: Double) -> Double {
        let twoPi = Double.pi * 2
        let raw = (t * style.motionSpeed).truncatingRemainder(dividingBy: twoPi)
        return (raw + twoPi).truncatingRemainder(dividingBy: twoPi)
    }

    func render(style: GeneratedStyle, surface: Surface, phase: Double) throws -> Frame {
        let textureDescriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: surface.width,
            height: surface.height,
            mipmapped: false
        )
        textureDescriptor.usage = [.renderTarget, .shaderRead]
        textureDescriptor.storageMode = .shared
        guard let texture = device.makeTexture(descriptor: textureDescriptor) else {
            throw RendererError.encodingFailed
        }

        let ground = Self.backgroundColor(for: style)
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = texture
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor = MTLClearColor(
            red: ground.0, green: ground.1, blue: ground.2, alpha: 1
        )

        guard let commandBuffer = queue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else {
            throw RendererError.encodingFailed
        }

        var u = uniforms(for: style, phase: phase)
        var mvp = Framing.mvp(aspect: surface.aspect)
        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(uvBuffer, offset: 0, index: 0)
        encoder.setVertexBytes(&u, length: MemoryLayout<MembraneUniforms>.stride, index: 1)
        encoder.setVertexBytes(&mvp, length: MemoryLayout<simd_float4x4>.stride, index: 2)
        encoder.setFragmentBytes(&u, length: MemoryLayout<MembraneUniforms>.stride, index: 1)
        encoder.drawIndexedPrimitives(
            type: .triangle,
            indexCount: indexCount,
            indexType: .uint16,
            indexBuffer: indexBuffer,
            indexBufferOffset: 0
        )
        encoder.endEncoding()
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()

        var pixels = [UInt8](repeating: 0, count: surface.width * surface.height * 4)
        pixels.withUnsafeMutableBytes { raw in
            texture.getBytes(
                raw.baseAddress!,
                bytesPerRow: surface.width * 4,
                from: MTLRegionMake2D(0, 0, surface.width, surface.height),
                mipmapLevel: 0
            )
        }
        return Frame(width: surface.width, height: surface.height, pixels: pixels)
    }
}
