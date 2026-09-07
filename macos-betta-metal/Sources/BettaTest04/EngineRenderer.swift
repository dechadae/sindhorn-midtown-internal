import Foundation
import Metal
import simd

/// Renders offscreen using the production shader, unmodified.
///
/// `BettaRenderer` in BettaMetalLab is an `MTKViewDelegate` - it takes its pass
/// and drawable from a view, so it cannot be driven headlessly without either a
/// window or a refactor of somebody else's file. But the MTKView coupling is in
/// that class, not in the shader: `finVertex`, `finFragment`, `backgroundVertex`
/// and `backgroundFragment` take uniforms in and give colour out.
///
/// So this reads `Shaders.metal` from the engine's own source file and compiles
/// it at runtime. The craft is theirs and stays theirs; only the generator that
/// fills the uniforms is replaced. Nothing in BettaMetalLab is edited or moved.
final class EngineRenderer {
    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private var pipelines: [FormPrimitive: MTLRenderPipelineState] = [:]
    private let backgroundPipeline: MTLRenderPipelineState
    private let depthState: MTLDepthStencilState
    private let geometry: EngineGeometry

    /// The engine's shader source, beside this target rather than inside it.
    static var shaderURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()      // BettaTest04
            .deletingLastPathComponent()      // Sources
            .appendingPathComponent("BettaMetalLab/Shaders.metal")
    }

    let sampleCount: Int

    /// `rays`/`segments` control mesh density; `sampleCount` is MSAA. The
    /// defaults match the engine. Maximum fidelity raises both.
    init(rays: Int = EngineGeometry.rays,
         segments: Int = EngineGeometry.radialSegments,
         sampleCount: Int = 1) throws {
        self.sampleCount = sampleCount
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else {
            throw RendererError.noDevice
        }
        self.device = device
        self.queue = queue

        let source: String
        do {
            source = try String(contentsOf: Self.shaderURL, encoding: .utf8)
        } catch {
            throw RendererError.libraryFailed(
                "could not read the engine shader at \(Self.shaderURL.path): \(error)"
            )
        }

        let library: MTLLibrary
        do {
            // The engine's source, plus Test 04's rigid primitives appended.
            // The engine's file on disk is never modified.
            library = try device.makeLibrary(source: source + shapeShaderAppendix, options: nil)
        } catch {
            throw RendererError.libraryFailed("\(error)")
        }

        geometry = try EngineGeometry(device: device, rays: rays, radialSegments: segments)

        // Every primitive shares finFragment: different topology, one material.
        // That shared skin is what makes the parts read as one organism.
        for primitive in FormPrimitive.allCases {
            let fin = MTLRenderPipelineDescriptor()
            fin.vertexFunction = library.makeFunction(name: primitive.vertexFunction)
            fin.fragmentFunction = library.makeFunction(name: "finFragment")
            fin.vertexDescriptor = EngineGeometry.vertexDescriptor()
            fin.depthAttachmentPixelFormat = .depth32Float
            fin.rasterSampleCount = sampleCount
            let attachment = fin.colorAttachments[0]!
            attachment.pixelFormat = .rgba8Unorm
            attachment.isBlendingEnabled = true
            attachment.rgbBlendOperation = .add
            attachment.alphaBlendOperation = .add
            attachment.sourceRGBBlendFactor = .sourceAlpha
            attachment.sourceAlphaBlendFactor = .sourceAlpha
            attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
            attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            do {
                pipelines[primitive] = try device.makeRenderPipelineState(descriptor: fin)
            } catch {
                throw RendererError.pipelineFailed("\(primitive.rawValue): \(error)")
            }
        }

        let background = MTLRenderPipelineDescriptor()
        background.vertexFunction = library.makeFunction(name: "backgroundVertex")
        background.fragmentFunction = library.makeFunction(name: "backgroundFragment")
        background.colorAttachments[0].pixelFormat = .rgba8Unorm
        background.depthAttachmentPixelFormat = .depth32Float
        background.rasterSampleCount = sampleCount

        do {
            backgroundPipeline = try device.makeRenderPipelineState(descriptor: background)
        } catch {
            throw RendererError.pipelineFailed("background: \(error)")
        }

        let depth = MTLDepthStencilDescriptor()
        depth.depthCompareFunction = .lessEqual
        depth.isDepthWriteEnabled = false
        guard let depthState = device.makeDepthStencilState(descriptor: depth) else {
            throw RendererError.pipelineFailed("depth state")
        }
        self.depthState = depthState
    }

    /// Phase for a seed at a fixed elapsed time on a pinned clock. Computed
    /// and set directly - the clock is never waited on.
    static func phase(for style: GeneratedStyle, atSeconds t: Double) -> Double {
        let twoPi = Double.pi * 2
        let raw = (t * style.motionSpeed).truncatingRemainder(dividingBy: twoPi)
        return (raw + twoPi).truncatingRemainder(dividingBy: twoPi)
    }

    /// Mean display-space luminance of the ground's three stops. The ground is
    /// a gradient, so this is an approximation used only to separate form
    /// pixels from ground pixels.
    static func groundLuminance(for style: GeneratedStyle) -> Double {
        let stops = style.groundLinear
        let mean = stops.reduce(0.0) { total, c in
            total + 0.2126 * Double(c.x) + 0.7152 * Double(c.y) + 0.0722 * Double(c.z)
        } / Double(stops.count)
        // back to display space for comparison against 8-bit pixels
        return mean <= 0.0031308 ? mean * 12.92 : 1.055 * pow(mean, 1 / 2.4) - 0.055
    }

    func render(
        style: GeneratedStyle,
        surface: Surface,
        phase: Double,
        composition: Composition = .neutralLandscape
    ) throws -> Frame {
        let colorDescriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .rgba8Unorm,
            width: surface.width,
            height: surface.height,
            mipmapped: false
        )
        colorDescriptor.usage = [.renderTarget, .shaderRead]
        colorDescriptor.storageMode = .shared

        let depthDescriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .depth32Float,
            width: surface.width,
            height: surface.height,
            mipmapped: false
        )
        depthDescriptor.usage = [.renderTarget]
        depthDescriptor.storageMode = .private
        if sampleCount > 1 {
            depthDescriptor.textureType = .type2DMultisample
            depthDescriptor.sampleCount = sampleCount
        }

        guard let color = device.makeTexture(descriptor: colorDescriptor),
              let depth = device.makeTexture(descriptor: depthDescriptor) else {
            throw RendererError.encodingFailed
        }

        // With MSAA the fins are drawn into a multisample target and resolved
        // into `color`. The ray tips are the sharpest edges in the image and
        // are where aliasing shows first.
        var msaaColor: MTLTexture?
        if sampleCount > 1 {
            let d = MTLTextureDescriptor.texture2DDescriptor(
                pixelFormat: .rgba8Unorm,
                width: surface.width, height: surface.height, mipmapped: false
            )
            d.textureType = .type2DMultisample
            d.sampleCount = sampleCount
            d.usage = [.renderTarget]
            d.storageMode = .private
            msaaColor = device.makeTexture(descriptor: d)
        }

        let pass = MTLRenderPassDescriptor()
        if let msaaColor {
            pass.colorAttachments[0].texture = msaaColor
            pass.colorAttachments[0].resolveTexture = color
            pass.colorAttachments[0].storeAction = .multisampleResolve
        } else {
            pass.colorAttachments[0].texture = color
            pass.colorAttachments[0].storeAction = .store
        }
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        pass.depthAttachment.texture = depth
        pass.depthAttachment.loadAction = .clear
        pass.depthAttachment.storeAction = .dontCare
        pass.depthAttachment.clearDepth = 1

        guard let commandBuffer = queue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else {
            throw RendererError.encodingFailed
        }

        var background = UniformBuilder.background(for: style)
        encoder.setRenderPipelineState(backgroundPipeline)
        encoder.setDepthStencilState(depthState)
        encoder.setFragmentBytes(
            &background,
            length: MemoryLayout<BackgroundUniforms>.stride,
            index: 0
        )
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)

        // Two membrane layers, as the engine draws: the second sits behind at a
        // different phase and alpha, and the overlap is where the depth comes
        // from.
        encoder.setVertexBuffer(geometry.vertexBuffer, offset: 0, index: 0)

        func draw(_ primitive: FormPrimitive, _ uniforms: inout FinUniforms) {
            guard let pipeline = pipelines[primitive] else { return }
            encoder.setRenderPipelineState(pipeline)
            encoder.setVertexBytes(&uniforms, length: MemoryLayout<FinUniforms>.stride, index: 1)
            encoder.setFragmentBytes(&uniforms, length: MemoryLayout<FinUniforms>.stride, index: 1)
            encoder.drawIndexedPrimitives(
                type: .triangle,
                indexCount: geometry.indexCount,
                indexType: .uint32,
                indexBuffer: geometry.indexBuffer,
                indexBufferOffset: 0
            )
        }

        // The rigid parts sit behind the membrane so the fin reads as the body
        // and they read as appendages - the scale hierarchy an organism has.
        for part in style.parts {
            var u = UniformBuilder.part(
                for: style, part: part, phase: phase,
                composition: composition, surface: surface
            )
            draw(part.primitive, &u)
        }

        // Two membrane layers, as the engine draws.
        for layer in 0..<2 {
            var fin = UniformBuilder.fin(
                for: style, phase: phase,
                composition: composition, surface: surface, layer: layer
            )
            draw(.membrane, &fin)
        }

        encoder.endEncoding()
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()

        var pixels = [UInt8](repeating: 0, count: surface.width * surface.height * 4)
        pixels.withUnsafeMutableBytes { raw in
            color.getBytes(
                raw.baseAddress!,
                bytesPerRow: surface.width * 4,
                from: MTLRegionMake2D(0, 0, surface.width, surface.height),
                mipmapLevel: 0
            )
        }
        return Frame(width: surface.width, height: surface.height, pixels: pixels)
    }
}
