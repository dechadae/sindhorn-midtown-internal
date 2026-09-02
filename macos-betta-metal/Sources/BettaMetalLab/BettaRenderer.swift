import Foundation
import Metal
import MetalKit
import simd

struct FinUniforms {
    var modelMatrix: simd_float4x4
    var viewProjectionMatrix: simd_float4x4
    var cameraPosition: SIMD4<Float>
    var timeSeedPhaseMorph: SIMD4<Float>
    var shape0: SIMD4<Float>
    var shape1: SIMD4<Float>
    var shape2: SIMD4<Float>
    var lighting: SIMD4<Float>
    var grading: SIMD4<Float>
    var modes: SIMD4<Float>
    var satelliteA: SIMD4<Float>
    var satelliteB: SIMD4<Float>
    var satelliteC: SIMD4<Float>
    var fingerprint: SIMD4<Float>
    var detail0: SIMD4<Float>
    var detail1: SIMD4<Float>
    var color0From: SIMD4<Float>
    var color1From: SIMD4<Float>
    var color2From: SIMD4<Float>
    var color3From: SIMD4<Float>
    var color0To: SIMD4<Float>
    var color1To: SIMD4<Float>
    var color2To: SIMD4<Float>
    var color3To: SIMD4<Float>
}

struct BackgroundUniforms {
    var bg0From: SIMD4<Float>; var bg1From: SIMD4<Float>; var bg2From: SIMD4<Float>
    var bg0To: SIMD4<Float>; var bg1To: SIMD4<Float>; var bg2To: SIMD4<Float>
    var satelliteColorMix: SIMD4<Float>; var transition: SIMD4<Float>
}

enum BettaRendererError: LocalizedError {
    case metalUnavailable
    case shaderSourceMissing
    case shaderLibraryFailed(String)
    case pipelineCreationFailed(String, String)
    case bufferAllocationFailed
    case commandQueueFailed
    case shaderFunctionMissing(String)

    var errorDescription: String? {
        switch self {
        case .metalUnavailable:
            return "Metal is unavailable on this Mac."
        case .shaderSourceMissing:
            return "Neither the precompiled BettaShaders.metallib nor Shaders.metal fallback could be loaded."
        case .shaderLibraryFailed(let detail):
            return "Metal shader library failed to initialize. \(detail)"
        case .pipelineCreationFailed(let stage, let detail):
            return "Metal \(stage) pipeline failed to initialize. \(detail)"
        case .shaderFunctionMissing(let name):
            return "Metal shader function missing: \(name)."
        case .bufferAllocationFailed:
            return "Metal buffer allocation failed."
        case .commandQueueFailed:
            return "Metal command queue creation failed."
        }
    }
}

final class BettaRenderer: NSObject, MTKViewDelegate {
    private static let inFlightCount = 3
    private static let uniformAlignment = 256

    let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let finPipeline: MTLRenderPipelineState
    private let backgroundPipeline: MTLRenderPipelineState
    private let depthState: MTLDepthStencilState
    private let geometry: BettaGeometry
    private let finUniformBuffer: MTLBuffer
    private let backgroundUniformBuffer: MTLBuffer
    private let finUniformStride: Int
    private let backgroundUniformStride: Int
    private let inFlightSemaphore = DispatchSemaphore(value: BettaRenderer.inFlightCount)
    private let morph = BettaMorphState()
    private let advancedStore = BettaAdvancedTuningStore.shared
    private let randomStyleStore = BettaRandomStyleStore.shared

    private var frameNumber = 0
    private var lastTime: TimeInterval = 0
    private var activeTime: Float = 0
    private var measuredFPS: Double = 0
    private var perfWindowStart: TimeInterval = 0
    private var perfFrames = 0

    init(view: MTKView) throws {
        guard let metalDevice = view.device ?? MTLCreateSystemDefaultDevice() else { throw BettaRendererError.metalUnavailable }
        device = metalDevice
        view.device = metalDevice

        guard let queue = metalDevice.makeCommandQueue() else { throw BettaRendererError.commandQueueFailed }
        commandQueue = queue
        commandQueue.label = "Sindhorn Betta Metal command queue"

        let library = try Self.loadMetalLibrary(device: metalDevice)
        guard let finVertex = library.makeFunction(name: "finVertex") else { throw BettaRendererError.shaderFunctionMissing("finVertex") }
        guard let finFragment = library.makeFunction(name: "finFragment") else { throw BettaRendererError.shaderFunctionMissing("finFragment") }
        guard let backgroundVertex = library.makeFunction(name: "backgroundVertex") else { throw BettaRendererError.shaderFunctionMissing("backgroundVertex") }
        guard let backgroundFragment = library.makeFunction(name: "backgroundFragment") else { throw BettaRendererError.shaderFunctionMissing("backgroundFragment") }

        let vd = MTLVertexDescriptor()
        vd.attributes[0].format = .float; vd.attributes[0].offset = 0; vd.attributes[0].bufferIndex = 0
        vd.attributes[1].format = .float; vd.attributes[1].offset = 4; vd.attributes[1].bufferIndex = 0
        vd.attributes[2].format = .float; vd.attributes[2].offset = 8; vd.attributes[2].bufferIndex = 0
        vd.layouts[0].stride = MemoryLayout<BettaVertex>.stride
        vd.layouts[0].stepFunction = .perVertex

        let fd = MTLRenderPipelineDescriptor()
        fd.label = "Sindhorn Betta high-detail membrane pipeline"
        fd.vertexFunction = finVertex
        fd.fragmentFunction = finFragment
        fd.vertexDescriptor = vd
        fd.colorAttachments[0].pixelFormat = .bgra8Unorm
        fd.depthAttachmentPixelFormat = .depth32Float
        let blend = fd.colorAttachments[0]!
        blend.isBlendingEnabled = true
        blend.rgbBlendOperation = .add
        blend.alphaBlendOperation = .add
        blend.sourceRGBBlendFactor = .sourceAlpha
        blend.destinationRGBBlendFactor = .oneMinusSourceAlpha
        blend.sourceAlphaBlendFactor = .sourceAlpha
        blend.destinationAlphaBlendFactor = .oneMinusSourceAlpha
        do {
            finPipeline = try metalDevice.makeRenderPipelineState(descriptor: fd)
        } catch {
            throw BettaRendererError.pipelineCreationFailed("membrane", error.localizedDescription)
        }

        let bd = MTLRenderPipelineDescriptor()
        bd.label = "Sindhorn Betta background pipeline"
        bd.vertexFunction = backgroundVertex
        bd.fragmentFunction = backgroundFragment
        bd.colorAttachments[0].pixelFormat = .bgra8Unorm
        bd.depthAttachmentPixelFormat = .depth32Float
        do {
            backgroundPipeline = try metalDevice.makeRenderPipelineState(descriptor: bd)
        } catch {
            throw BettaRendererError.pipelineCreationFailed("background", error.localizedDescription)
        }

        let dd = MTLDepthStencilDescriptor()
        dd.depthCompareFunction = .lessEqual
        dd.isDepthWriteEnabled = false
        guard let ds = metalDevice.makeDepthStencilState(descriptor: dd) else { throw BettaRendererError.metalUnavailable }
        depthState = ds

        geometry = try BettaGeometry(device: metalDevice)
        finUniformStride = Self.aligned(MemoryLayout<FinUniforms>.stride)
        backgroundUniformStride = Self.aligned(MemoryLayout<BackgroundUniforms>.stride)
        guard let fb = metalDevice.makeBuffer(length: finUniformStride * 2 * Self.inFlightCount, options: .storageModeShared),
              let bb = metalDevice.makeBuffer(length: backgroundUniformStride * Self.inFlightCount, options: .storageModeShared) else {
            throw BettaRendererError.bufferAllocationFailed
        }
        fb.label = "Triple-buffered Betta high-detail fin uniforms"
        bb.label = "Triple-buffered Betta background uniforms"
        finUniformBuffer = fb
        backgroundUniformBuffer = bb

        super.init()
        view.colorPixelFormat = .bgra8Unorm
        view.depthStencilPixelFormat = .depth32Float
        view.sampleCount = 1
        view.preferredFramesPerSecond = BettaSettings.preferredFPS
        view.enableSetNeedsDisplay = false
        view.isPaused = false
        view.framebufferOnly = true
        view.clearColor = MTLClearColorMake(0.003, 0.005, 0.012, 1)
        view.delegate = self
    }

    func setManualPreset(_ index: Int) { morph.setManual(index, now: ProcessInfo.processInfo.systemUptime) }
    func useLiveMode() { morph.useLive(now: ProcessInfo.processInfo.systemUptime) }
    func usePreviewMode() { morph.usePreview(now: ProcessInfo.processInfo.systemUptime) }
    func cycle(_ direction: Int) { morph.cycle(direction: direction, now: ProcessInfo.processInfo.systemUptime) }

    var statusText: String {
        let p = BettaPreset.all[morph.toIndex]
        let fps = measuredFPS > 0 ? String(format: "%.0f fps", measuredFPS) : "warming up"
        let randomSuffix = randomStyleStore.style(for: p.referenceId).map { " · Random #\($0.shortSeed)" } ?? ""
        return "\(morph.modeLabel) · Fish #\(p.referenceId) · \(p.name)\(randomSuffix) · High Detail \(BettaGeometry.rays)×\(BettaGeometry.radialSegments) · \(fps) · \(device.name)"
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let pass = view.currentRenderPassDescriptor, let drawable = view.currentDrawable else { return }
        inFlightSemaphore.wait()
        guard let cb = commandQueue.makeCommandBuffer() else { inFlightSemaphore.signal(); return }
        let sem = inFlightSemaphore
        cb.addCompletedHandler { _ in sem.signal() }

        let now = ProcessInfo.processInfo.systemUptime
        if lastTime == 0 { lastTime = now }
        activeTime += Float(min(0.05, max(0, now - lastTime)))
        lastTime = now
        updatePerformance(now: now)

        let mf = morph.frame(now: now)
        let from = BettaPreset.all[mf.fromIndex]
        let to = BettaPreset.all[mf.toIndex]
        let e = mf.mix
        let fromAdvanced = advancedStore.adjustment(for: from.referenceId)
        let toAdvanced = advancedStore.adjustment(for: to.referenceId)
        let fromStyle = randomStyleStore.style(for: from.referenceId)
        let toStyle = randomStyleStore.style(for: to.referenceId)
        let fromPalette = fromStyle?.resolvedPalette ?? from.palette
        let toPalette = toStyle?.resolvedPalette ?? to.palette
        let fromBackground = fromStyle?.resolvedBackground ?? from.background
        let toBackground = toStyle?.resolvedBackground ?? to.background
        let camera = interpolatedCamera(fromAdvanced.camera, toAdvanced.camera, e)

        let aspect = Float(max(1, view.drawableSize.width) / max(1, view.drawableSize.height))
        let fov = camera.fov * .pi / 180
        let cameraPosition = SIMD3<Float>(camera.x, camera.y, camera.z)
        let pitch = camera.pitch * .pi / 180
        let yaw = camera.yaw * .pi / 180
        let roll = camera.roll * .pi / 180
        let viewMatrix = rotationZMatrix(-roll) * rotationXMatrix(-pitch) * rotationYMatrix(-yaw) * translationMatrix(-cameraPosition)
        let projection = perspectiveRHMetal(fovYRadians: fov, aspect: aspect, near: BettaSettings.nearPlane, far: BettaSettings.farPlane)
        let viewProjection = projection * viewMatrix

        let slot = frameNumber % Self.inFlightCount
        frameNumber += 1
        let backgroundOffset = slot * backgroundUniformStride
        write(
            makeBackgroundUniforms(fromBackground: fromBackground, toBackground: toBackground, mix: e),
            to: backgroundUniformBuffer,
            offset: backgroundOffset
        )

        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.depthAttachment.loadAction = .clear
        pass.depthAttachment.storeAction = .dontCare
        pass.depthAttachment.clearDepth = 1

        guard let enc = cb.makeRenderCommandEncoder(descriptor: pass) else { cb.commit(); return }
        enc.label = "Sindhorn Betta high-detail frame encoder"
        enc.setCullMode(.none)
        enc.setRenderPipelineState(backgroundPipeline)
        enc.setFragmentBuffer(backgroundUniformBuffer, offset: backgroundOffset, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)

        enc.setRenderPipelineState(finPipeline)
        enc.setDepthStencilState(depthState)
        enc.setVertexBuffer(geometry.vertexBuffer, offset: 0, index: 0)
        for layer in 0..<2 {
            let offset = (slot * 2 + layer) * finUniformStride
            let uniforms = makeFinUniforms(
                from: from,
                to: to,
                fromAdvanced: fromAdvanced,
                toAdvanced: toAdvanced,
                fromPalette: fromPalette,
                toPalette: toPalette,
                mix: e,
                layerIndex: layer,
                aspect: aspect,
                viewProjection: viewProjection,
                cameraPosition: cameraPosition
            )
            write(uniforms, to: finUniformBuffer, offset: offset)
            enc.setVertexBuffer(finUniformBuffer, offset: offset, index: 1)
            enc.setFragmentBuffer(finUniformBuffer, offset: offset, index: 1)
            enc.drawIndexedPrimitives(type: .triangle, indexCount: geometry.indexCount, indexType: .uint16, indexBuffer: geometry.indexBuffer, indexBufferOffset: 0)
        }
        enc.endEncoding()
        cb.present(drawable)
        cb.commit()
    }

    private func makeFinUniforms(
        from: BettaPreset,
        to: BettaPreset,
        fromAdvanced: BettaAdvancedAdjustment,
        toAdvanced: BettaAdvancedAdjustment,
        fromPalette: [SIMD3<Float>],
        toPalette: [SIMD3<Float>],
        mix e: Float,
        layerIndex: Int,
        aspect: Float,
        viewProjection: simd_float4x4,
        cameraPosition: SIMD3<Float>
    ) -> FinUniforms {
        let ta = fromAdvanced.tail
        let tb = toAdvanced.tail
        let canonicalLayerA = from.layers[layerIndex]
        let canonicalLayerB = to.layers[layerIndex]
        let la = layerIndex == 0 ? fromAdvanced.frontLayer : fromAdvanced.backLayer
        let lb = layerIndex == 0 ? toAdvanced.frontLayer : toAdvanced.backLayer
        let p: (Float, Float) -> Float = { lerp($0, $1, e) }

        let sourceA = SIMD3<Float>(from.params.offsetX + la.x, from.params.offsetY + la.y, from.params.cameraDepth + la.z)
        let sourceB = SIMD3<Float>(to.params.offsetX + lb.x, to.params.offsetY + lb.y, to.params.cameraDepth + lb.z)
        let ma = BettaLandscapeMapper.map(position: sourceA, aspect: aspect, referenceId: from.referenceId, camera: fromAdvanced.camera)
        let mb = BettaLandscapeMapper.map(position: sourceB, aspect: aspect, referenceId: to.referenceId, camera: toAdvanced.camera)
        let pos = lerp(ma.position, mb.position, e)
        let scale = p(from.params.scale * la.scale * ma.scaleMultiplier, to.params.scale * lb.scale * mb.scaleMultiplier)
        let rx = lerpAngle(from.params.rotationX, to.params.rotationX, e)
        let ry = lerpAngle(from.params.rotationY, to.params.rotationY, e)
        let rz = lerpAngle(from.params.rotation + la.rotation + ma.rotationZOffset, to.params.rotation + lb.rotation + mb.rotationZOffset, e)
        let model = translationMatrix(pos) * rotationYMatrix(ry) * rotationXMatrix(rx) * rotationZMatrix(rz) * uniformScaleMatrix(scale)
        let n = BettaSettings.neutralSatellite

        return FinUniforms(
            modelMatrix: model,
            viewProjectionMatrix: viewProjection,
            cameraPosition: SIMD4<Float>(cameraPosition.x, cameraPosition.y, cameraPosition.z, 1),
            timeSeedPhaseMorph: SIMD4<Float>(activeTime, p(canonicalLayerA.seed, canonicalLayerB.seed), p(la.phase, lb.phase), e),
            shape0: SIMD4<Float>(p(ta.spread, tb.spread), p(ta.foldDensity, tb.foldDensity), p(ta.curl, tb.curl), p(ta.twist, tb.twist)),
            shape1: SIMD4<Float>(p(ta.edgeFlutter, tb.edgeFlutter), p(ta.depth, tb.depth), p(ta.currentStrength, tb.currentStrength), p(ta.motionSpeed, tb.motionSpeed)),
            shape2: SIMD4<Float>(p(ta.turbulence, tb.turbulence), p(ta.motionAmplitude, tb.motionAmplitude), p(ta.opacity, tb.opacity), p(ta.transmission, tb.transmission)),
            lighting: SIMD4<Float>(p(ta.rimStrength, tb.rimStrength), p(ta.foldHighlight, tb.foldHighlight), p(ta.iridescence, tb.iridescence), p(ta.bloom, tb.bloom)),
            grading: SIMD4<Float>(p(ta.saturation, tb.saturation), p(ta.brightness, tb.brightness), p(ta.gradientPosition, tb.gradientPosition), p(la.alpha, lb.alpha)),
            modes: SIMD4<Float>(from.morphMode, to.morphMode, n.energy, n.cloud),
            satelliteA: SIMD4<Float>(n.cold, n.cooling, n.texture, n.vapor),
            satelliteB: SIMD4<Float>(n.visible, n.motion.x, n.motion.y, n.motion.x),
            satelliteC: SIMD4<Float>(n.motion.y, n.color.x, n.color.y, n.color.z),
            fingerprint: SIMD4<Float>(n.fingerprint.x, n.fingerprint.y, n.fingerprint.z, 0),
            detail0: SIMD4<Float>(p(ta.rayCount, tb.rayCount), p(ta.microFold, tb.microFold), p(ta.rayDefinition, tb.rayDefinition), p(ta.edgeRuffle, tb.edgeRuffle)),
            detail1: SIMD4<Float>(p(ta.veinStrength, tb.veinStrength), p(ta.membraneGrain, tb.membraneGrain), p(ta.fineFlutter, tb.fineFlutter), p(ta.normalDetail, tb.normalDetail)),
            color0From: rgba(fromPalette[0]),
            color1From: rgba(fromPalette[1]),
            color2From: rgba(fromPalette[2]),
            color3From: rgba(fromPalette[3]),
            color0To: rgba(toPalette[0]),
            color1To: rgba(toPalette[1]),
            color2To: rgba(toPalette[2]),
            color3To: rgba(toPalette[3])
        )
    }

    private func interpolatedCamera(_ a: BettaCameraAdjustment, _ b: BettaCameraAdjustment, _ t: Float) -> BettaCameraAdjustment {
        func angleDegrees(_ x: Float, _ y: Float) -> Float {
            lerpAngle(x * .pi / 180, y * .pi / 180, t) * 180 / .pi
        }
        return BettaCameraAdjustment(
            fov: lerp(a.fov, b.fov, t),
            x: lerp(a.x, b.x, t),
            y: lerp(a.y, b.y, t),
            z: lerp(a.z, b.z, t),
            pitch: angleDegrees(a.pitch, b.pitch),
            yaw: angleDegrees(a.yaw, b.yaw),
            roll: angleDegrees(a.roll, b.roll)
        )
    }

    private func makeBackgroundUniforms(
        fromBackground: [SIMD3<Float>],
        toBackground: [SIMD3<Float>],
        mix: Float
    ) -> BackgroundUniforms {
        let n = BettaSettings.neutralSatellite
        let satelliteMix = 0.025 + 0.025 * n.cloud + 0.018 * n.visible
        return BackgroundUniforms(
            bg0From: rgba(fromBackground[0]), bg1From: rgba(fromBackground[1]), bg2From: rgba(fromBackground[2]),
            bg0To: rgba(toBackground[0]), bg1To: rgba(toBackground[1]), bg2To: rgba(toBackground[2]),
            satelliteColorMix: SIMD4<Float>(n.color.x, n.color.y, n.color.z, satelliteMix),
            transition: SIMD4<Float>(mix, 0, 0, 0)
        )
    }

    private func updatePerformance(now: TimeInterval) {
        if perfWindowStart == 0 { perfWindowStart = now }
        perfFrames += 1
        let elapsed = now - perfWindowStart
        if elapsed >= 1 {
            measuredFPS = Double(perfFrames) / elapsed
            perfFrames = 0
            perfWindowStart = now
        }
    }

    private func rgba(_ c: SIMD3<Float>) -> SIMD4<Float> { SIMD4<Float>(c.x, c.y, c.z, 1) }

    private func write<T>(_ value: T, to buffer: MTLBuffer, offset: Int) {
        var copy = value
        withUnsafeBytes(of: &copy) {
            buffer.contents().advanced(by: offset).copyMemory(from: $0.baseAddress!, byteCount: $0.count)
        }
    }

    private static func aligned(_ value: Int) -> Int { (value + uniformAlignment - 1) & ~(uniformAlignment - 1) }

    private static func loadMetalLibrary(device: MTLDevice) throws -> MTLLibrary {
        var binaryFailure: String?

        if let url = Bundle.main.url(forResource: "BettaShaders", withExtension: "metallib") {
            do {
                return try device.makeLibrary(URL: url)
            } catch {
                binaryFailure = error.localizedDescription
            }
        } else {
            binaryFailure = "BettaShaders.metallib is missing from the app bundle"
        }

        do {
            let source = try loadShaderSource()
            return try device.makeLibrary(source: source, options: nil)
        } catch {
            let binary = binaryFailure ?? "unknown precompiled-library error"
            throw BettaRendererError.shaderLibraryFailed("Precompiled library: \(binary). Source fallback: \(error.localizedDescription)")
        }
    }

    private static func loadShaderSource() throws -> String {
        if let url = Bundle.main.url(forResource: "Shaders", withExtension: "metal"), let source = try? String(contentsOf: url, encoding: .utf8) { return source }
        if let url = Bundle.module.url(forResource: "Shaders", withExtension: "metal"), let source = try? String(contentsOf: url, encoding: .utf8) { return source }
        throw BettaRendererError.shaderSourceMissing
    }
}