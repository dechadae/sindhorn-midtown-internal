import Foundation
import Metal
import QuartzCore
import simd

/// Renders using the production shader, unmodified.
///
/// `BettaRenderer` in BettaMetalLab is an `MTKViewDelegate` - it takes its pass
/// and drawable from a view, so it cannot be driven headlessly without either a
/// window or a refactor of somebody else's file. But the view coupling is in
/// that class, not in the shader: `finVertex`, `finFragment`, `backgroundVertex`
/// and `backgroundFragment` take uniforms in and give colour out.
///
/// So this reads `Shaders.metal` from the engine's own source file and compiles
/// it at runtime, with Test 04's rigid primitives appended. The craft is theirs
/// and stays theirs; only the generator filling the uniforms is replaced.
/// Nothing in BettaMetalLab is edited or moved.
final class EngineRenderer {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    private var pipelines: [FormPrimitive: MTLRenderPipelineState] = [:]
    private let backgroundPipeline: MTLRenderPipelineState
    private let depthState: MTLDepthStencilState
    private let geometry: EngineGeometry
    let sampleCount: Int
    let pixelFormat: MTLPixelFormat

    /// The engine's shader source, beside this target rather than inside it.
    static var shaderURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()      // BettaTest04
            .deletingLastPathComponent()      // Sources
            .appendingPathComponent("BettaMetalLab/Shaders.metal")
    }

    /// `rays`/`segments` set mesh density, `sampleCount` is MSAA. The offscreen
    /// path reads back `rgba8Unorm`; the live path uses `bgra8Unorm`, which is
    /// what BETTA-METAL-PARITY.md records the engine itself presenting.
    init(rays: Int = EngineGeometry.rays,
         segments: Int = EngineGeometry.radialSegments,
         sampleCount: Int = 1,
         pixelFormat: MTLPixelFormat = .rgba8Unorm) throws {
        self.sampleCount = sampleCount
        self.pixelFormat = pixelFormat

        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else { throw RendererError.noDevice }
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
            let a = fin.colorAttachments[0]!
            a.pixelFormat = pixelFormat
            a.isBlendingEnabled = true
            a.rgbBlendOperation = .add
            a.alphaBlendOperation = .add
            a.sourceRGBBlendFactor = .sourceAlpha
            a.sourceAlphaBlendFactor = .sourceAlpha
            a.destinationRGBBlendFactor = .oneMinusSourceAlpha
            a.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            do {
                pipelines[primitive] = try device.makeRenderPipelineState(descriptor: fin)
            } catch {
                throw RendererError.pipelineFailed("\(primitive.rawValue): \(error)")
            }
        }

        let background = MTLRenderPipelineDescriptor()
        background.vertexFunction = library.makeFunction(name: "backgroundVertex")
        background.fragmentFunction = library.makeFunction(name: "backgroundFragment")
        background.colorAttachments[0].pixelFormat = pixelFormat
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

    /// Phase for a seed at a fixed elapsed time on a pinned clock. Computed and
    /// set directly - the clock is never waited on.
    static func phase(for style: GeneratedStyle, atSeconds t: Double) -> Double {
        let twoPi = Double.pi * 2
        let raw = (t * style.motionSpeed).truncatingRemainder(dividingBy: twoPi)
        return (raw + twoPi).truncatingRemainder(dividingBy: twoPi)
    }

    /// Mean display-space luminance of the ground's three stops. The ground is a
    /// gradient, so this is only used to separate form pixels from ground.
    static func groundLuminance(for style: GeneratedStyle) -> Double {
        let stops = style.groundLinear
        let mean = stops.reduce(0.0) { total, c in
            total + 0.2126 * Double(c.x) + 0.7152 * Double(c.y) + 0.0722 * Double(c.z)
        } / Double(stops.count)
        return mean <= 0.0031308 ? mean * 12.92 : 1.055 * pow(mean, 1 / 2.4) - 0.055
    }

    // MARK: - Encoding, shared by the offscreen and live paths

    private func makeDepth(width: Int, height: Int) -> MTLTexture? {
        let d = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .depth32Float, width: width, height: height, mipmapped: false
        )
        d.usage = [.renderTarget]
        d.storageMode = .private
        if sampleCount > 1 {
            d.textureType = .type2DMultisample
            d.sampleCount = sampleCount
        }
        return device.makeTexture(descriptor: d)
    }

    private func makeMultisampleColor(width: Int, height: Int) -> MTLTexture? {
        guard sampleCount > 1 else { return nil }
        let d = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: pixelFormat, width: width, height: height, mipmapped: false
        )
        d.textureType = .type2DMultisample
        d.sampleCount = sampleCount
        d.usage = [.renderTarget]
        d.storageMode = .private
        return device.makeTexture(descriptor: d)
    }

    private func encode(
        into target: MTLTexture,
        commandBuffer: MTLCommandBuffer,
        style: GeneratedStyle,
        surface: Surface,
        phase: Double,
        composition: Composition
    ) {
        guard let depth = makeDepth(width: target.width, height: target.height) else { return }
        let msaa = makeMultisampleColor(width: target.width, height: target.height)

        let pass = MTLRenderPassDescriptor()
        if let msaa {
            pass.colorAttachments[0].texture = msaa
            pass.colorAttachments[0].resolveTexture = target
            pass.colorAttachments[0].storeAction = .multisampleResolve
        } else {
            pass.colorAttachments[0].texture = target
            pass.colorAttachments[0].storeAction = .store
        }
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        pass.depthAttachment.texture = depth
        pass.depthAttachment.loadAction = .clear
        pass.depthAttachment.storeAction = .dontCare
        pass.depthAttachment.clearDepth = 1

        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else { return }

        // The ground first. When the organism is cropped away it is the picture.
        var background = UniformBuilder.background(for: style)
        encoder.setRenderPipelineState(backgroundPipeline)
        encoder.setDepthStencilState(depthState)
        encoder.setFragmentBytes(&background, length: MemoryLayout<BackgroundUniforms>.stride, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)

        encoder.setVertexBuffer(geometry.vertexBuffer, offset: 0, index: 0)

        func draw(_ primitive: FormPrimitive, _ uniforms: inout FinUniforms) {
            guard let pipeline = pipelines[primitive] else { return }
            encoder.setRenderPipelineState(pipeline)
            encoder.setVertexBytes(&uniforms, length: MemoryLayout<FinUniforms>.stride, index: 1)
            encoder.setFragmentBytes(&uniforms, length: MemoryLayout<FinUniforms>.stride, index: 1)
            encoder.drawIndexedPrimitives(
                type: .triangle, indexCount: geometry.indexCount, indexType: .uint32,
                indexBuffer: geometry.indexBuffer, indexBufferOffset: 0
            )
        }

        // Rigid parts behind, membrane in front: body then appendages.
        for part in style.parts {
            var u = UniformBuilder.part(
                for: style, part: part, phase: phase,
                composition: composition, surface: surface
            )
            draw(part.primitive, &u)
        }
        for layer in 0..<2 {
            var fin = UniformBuilder.fin(
                for: style, phase: phase, composition: composition,
                surface: surface, layer: layer
            )
            draw(.membrane, &fin)
        }

        encoder.endEncoding()
    }

    // MARK: - Offscreen

    func render(
        style: GeneratedStyle,
        surface: Surface,
        phase: Double,
        composition: Composition = .neutralLandscape
    ) throws -> Frame {
        let d = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: pixelFormat, width: surface.width, height: surface.height, mipmapped: false
        )
        d.usage = [.renderTarget, .shaderRead]
        d.storageMode = .shared
        guard let color = device.makeTexture(descriptor: d),
              let commandBuffer = queue.makeCommandBuffer() else {
            throw RendererError.encodingFailed
        }

        encode(into: color, commandBuffer: commandBuffer, style: style,
               surface: surface, phase: phase, composition: composition)
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

    // MARK: - Live

    func present(
        style: GeneratedStyle,
        surface: Surface,
        phase: Double,
        composition: Composition,
        drawable: CAMetalDrawable
    ) {
        guard let commandBuffer = queue.makeCommandBuffer() else { return }
        encode(into: drawable.texture, commandBuffer: commandBuffer, style: style,
               surface: surface, phase: phase, composition: composition)
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
