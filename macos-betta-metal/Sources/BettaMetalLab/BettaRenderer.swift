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
    case metalUnavailable, shaderSourceMissing, bufferAllocationFailed, commandQueueFailed
    case shaderFunctionMissing(String)
    var errorDescription: String? {
        switch self {
        case .metalUnavailable: return "Metal is unavailable on this Mac."
        case .shaderSourceMissing: return "Shaders.metal could not be loaded."
        case .shaderFunctionMissing(let name): return "Metal shader function missing: \(name)."
        case .bufferAllocationFailed: return "Metal buffer allocation failed."
        case .commandQueueFailed: return "Metal command queue creation failed."
        }
    }
}

final class BettaRenderer: NSObject, MTKViewDelegate {
    private static let inFlightCount = 3, uniformAlignment = 256
    let device: MTLDevice
    private let commandQueue: MTLCommandQueue, finPipeline: MTLRenderPipelineState, backgroundPipeline: MTLRenderPipelineState, depthState: MTLDepthStencilState
    private let geometry: BettaGeometry, finUniformBuffer: MTLBuffer, backgroundUniformBuffer: MTLBuffer
    private let finUniformStride: Int, backgroundUniformStride: Int
    private let inFlightSemaphore = DispatchSemaphore(value: BettaRenderer.inFlightCount)
    private let morph = BettaMorphState()
    private var frameNumber = 0, lastTime: TimeInterval = 0, activeTime: Float = 0, measuredFPS: Double = 0, perfWindowStart: TimeInterval = 0
    private var perfFrames = 0

    init(view: MTKView) throws {
        guard let metalDevice = view.device ?? MTLCreateSystemDefaultDevice() else { throw BettaRendererError.metalUnavailable }
        device = metalDevice; view.device = metalDevice
        guard let queue = metalDevice.makeCommandQueue() else { throw BettaRendererError.commandQueueFailed }
        commandQueue = queue; commandQueue.label = "Sindhorn Betta Metal command queue"
        let library = try metalDevice.makeLibrary(source: Self.loadShaderSource(), options: nil)
        guard let finVertex = library.makeFunction(name: "finVertex") else { throw BettaRendererError.shaderFunctionMissing("finVertex") }
        guard let finFragment = library.makeFunction(name: "finFragment") else { throw BettaRendererError.shaderFunctionMissing("finFragment") }
        guard let backgroundVertex = library.makeFunction(name: "backgroundVertex") else { throw BettaRendererError.shaderFunctionMissing("backgroundVertex") }
        guard let backgroundFragment = library.makeFunction(name: "backgroundFragment") else { throw BettaRendererError.shaderFunctionMissing("backgroundFragment") }
        let vd = MTLVertexDescriptor(); vd.attributes[0].format = .float; vd.attributes[0].offset = 0; vd.attributes[0].bufferIndex = 0; vd.attributes[1].format = .float; vd.attributes[1].offset = 4; vd.attributes[1].bufferIndex = 0; vd.attributes[2].format = .float; vd.attributes[2].offset = 8; vd.attributes[2].bufferIndex = 0; vd.layouts[0].stride = MemoryLayout<BettaVertex>.stride; vd.layouts[0].stepFunction = .perVertex
        let fd = MTLRenderPipelineDescriptor(); fd.label = "Sindhorn Betta membrane pipeline"; fd.vertexFunction = finVertex; fd.fragmentFunction = finFragment; fd.vertexDescriptor = vd; fd.colorAttachments[0].pixelFormat = .bgra8Unorm; fd.depthAttachmentPixelFormat = .depth32Float
        let blend = fd.colorAttachments[0]!; blend.isBlendingEnabled = true; blend.rgbBlendOperation = .add; blend.alphaBlendOperation = .add; blend.sourceRGBBlendFactor = .sourceAlpha; blend.destinationRGBBlendFactor = .oneMinusSourceAlpha; blend.sourceAlphaBlendFactor = .sourceAlpha; blend.destinationAlphaBlendFactor = .oneMinusSourceAlpha
        finPipeline = try metalDevice.makeRenderPipelineState(descriptor: fd)
        let bd = MTLRenderPipelineDescriptor(); bd.label = "Sindhorn Betta background pipeline"; bd.vertexFunction = backgroundVertex; bd.fragmentFunction = backgroundFragment; bd.colorAttachments[0].pixelFormat = .bgra8Unorm; bd.depthAttachmentPixelFormat = .depth32Float
        backgroundPipeline = try metalDevice.makeRenderPipelineState(descriptor: bd)
        let dd = MTLDepthStencilDescriptor(); dd.depthCompareFunction = .lessEqual; dd.isDepthWriteEnabled = false
        guard let ds = metalDevice.makeDepthStencilState(descriptor: dd) else { throw BettaRendererError.metalUnavailable }; depthState = ds
        geometry = try BettaGeometry(device: metalDevice)
        finUniformStride = Self.aligned(MemoryLayout<FinUniforms>.stride); backgroundUniformStride = Self.aligned(MemoryLayout<BackgroundUniforms>.stride)
        guard let fb = metalDevice.makeBuffer(length: finUniformStride * 2 * Self.inFlightCount, options: .storageModeShared), let bb = metalDevice.makeBuffer(length: backgroundUniformStride * Self.inFlightCount, options: .storageModeShared) else { throw BettaRendererError.bufferAllocationFailed }
        fb.label = "Triple-buffered Betta fin uniforms"; bb.label = "Triple-buffered Betta background uniforms"; finUniformBuffer = fb; backgroundUniformBuffer = bb
        super.init()
        view.colorPixelFormat = .bgra8Unorm; view.depthStencilPixelFormat = .depth32Float; view.sampleCount = 1; view.preferredFramesPerSecond = BettaSettings.preferredFPS; view.enableSetNeedsDisplay = false; view.isPaused = false; view.framebufferOnly = true; view.clearColor = MTLClearColorMake(0.003,0.005,0.012,1); view.delegate = self
    }

    func setManualPreset(_ index: Int) { morph.setManual(index, now: ProcessInfo.processInfo.systemUptime) }
    func useLiveMode() { morph.useLive(now: ProcessInfo.processInfo.systemUptime) }
    func usePreviewMode() { morph.usePreview(now: ProcessInfo.processInfo.systemUptime) }
    func cycle(_ direction: Int) { morph.cycle(direction: direction, now: ProcessInfo.processInfo.systemUptime) }
    var statusText: String { let p = BettaPreset.all[morph.toIndex]; let fps = measuredFPS > 0 ? String(format:"%.0f fps",measuredFPS) : "warming up"; return "\(morph.modeLabel) · Fish #\(p.referenceId) · \(p.name) · \(fps) · \(device.name)" }
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let pass = view.currentRenderPassDescriptor, let drawable = view.currentDrawable else { return }
        inFlightSemaphore.wait(); guard let cb = commandQueue.makeCommandBuffer() else { inFlightSemaphore.signal(); return }; let sem = inFlightSemaphore; cb.addCompletedHandler { _ in sem.signal() }
        let now = ProcessInfo.processInfo.systemUptime; if lastTime == 0 { lastTime = now }; activeTime += Float(min(0.05,max(0,now-lastTime))); lastTime = now; updatePerformance(now:now)
        let mf = morph.frame(now:now), from = BettaPreset.all[mf.fromIndex], to = BettaPreset.all[mf.toIndex], e = mf.mix
        let aspect = Float(max(1,view.drawableSize.width)/max(1,view.drawableSize.height)), fov = BettaSettings.fovYDegrees * .pi / 180
        let vp = perspectiveRHMetal(fovYRadians:fov, aspect:aspect, near:BettaSettings.nearPlane, far:BettaSettings.farPlane) * translationMatrix(SIMD3<Float>(0,0,-BettaSettings.cameraZ))
        let slot = frameNumber % Self.inFlightCount; frameNumber += 1; let bo = slot * backgroundUniformStride; write(makeBackgroundUniforms(from:from,to:to,mix:e),to:backgroundUniformBuffer,offset:bo)
        pass.colorAttachments[0].loadAction = .clear; pass.colorAttachments[0].storeAction = .store; pass.depthAttachment.loadAction = .clear; pass.depthAttachment.storeAction = .dontCare; pass.depthAttachment.clearDepth = 1
        guard let enc = cb.makeRenderCommandEncoder(descriptor:pass) else { cb.commit(); return }; enc.label = "Sindhorn Betta frame encoder"; enc.setCullMode(.none)
        enc.setRenderPipelineState(backgroundPipeline); enc.setFragmentBuffer(backgroundUniformBuffer,offset:bo,index:0); enc.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:3)
        enc.setRenderPipelineState(finPipeline); enc.setDepthStencilState(depthState); enc.setVertexBuffer(geometry.vertexBuffer,offset:0,index:0)
        for layer in 0..<2 { let off = (slot*2+layer)*finUniformStride; write(makeFinUniforms(from:from,to:to,mix:e,layerIndex:layer,aspect:aspect,viewProjection:vp),to:finUniformBuffer,offset:off); enc.setVertexBuffer(finUniformBuffer,offset:off,index:1); enc.setFragmentBuffer(finUniformBuffer,offset:off,index:1); enc.drawIndexedPrimitives(type:.triangle,indexCount:geometry.indexCount,indexType:.uint16,indexBuffer:geometry.indexBuffer,indexBufferOffset:0) }
        enc.endEncoding(); cb.present(drawable); cb.commit()
    }

    private func makeFinUniforms(from:BettaPreset,to:BettaPreset,mix e:Float,layerIndex:Int,aspect:Float,viewProjection:simd_float4x4)->FinUniforms {
        let a=from.params,b=to.params,la=from.layers[layerIndex],lb=to.layers[layerIndex],p:(Float,Float)->Float={lerp($0,$1,e)}
        let ma=BettaLandscapeMapper.map(position:SIMD3<Float>(a.offsetX+la.offset.x,a.offsetY+la.offset.y,a.cameraDepth+la.offset.z),aspect:aspect,referenceId:from.referenceId), mb=BettaLandscapeMapper.map(position:SIMD3<Float>(b.offsetX+lb.offset.x,b.offsetY+lb.offset.y,b.cameraDepth+lb.offset.z),aspect:aspect,referenceId:to.referenceId)
        let pos=lerp(ma.position,mb.position,e), scale=p(a.scale*la.scale*ma.scaleMultiplier,b.scale*lb.scale*mb.scaleMultiplier), rx=lerpAngle(a.rotationX,b.rotationX,e), ry=lerpAngle(a.rotationY,b.rotationY,e), rz=lerpAngle(a.rotation+la.rotation+ma.rotationZOffset,b.rotation+lb.rotation+mb.rotationZOffset,e)
        let model=translationMatrix(pos)*rotationYMatrix(ry)*rotationXMatrix(rx)*rotationZMatrix(rz)*uniformScaleMatrix(scale), n=BettaSettings.neutralSatellite
        return FinUniforms(modelMatrix:model,viewProjectionMatrix:viewProjection,cameraPosition:SIMD4<Float>(0,0,BettaSettings.cameraZ,1),timeSeedPhaseMorph:SIMD4<Float>(activeTime,p(la.seed,lb.seed),p(la.phase,lb.phase),e),shape0:SIMD4<Float>(p(a.spread,b.spread),p(a.foldDensity,b.foldDensity),p(a.curl,b.curl),p(a.twist,b.twist)),shape1:SIMD4<Float>(p(a.edgeFlutter,b.edgeFlutter),p(a.depth,b.depth),p(a.currentStrength,b.currentStrength),p(a.motionSpeed,b.motionSpeed)),shape2:SIMD4<Float>(p(a.turbulence,b.turbulence),p(a.motionAmplitude,b.motionAmplitude),p(a.opacity,b.opacity),p(a.transmission,b.transmission)),lighting:SIMD4<Float>(p(a.rimStrength,b.rimStrength),p(a.foldHighlight,b.foldHighlight),p(a.iridescence,b.iridescence),p(a.bloom,b.bloom)),grading:SIMD4<Float>(p(a.saturation,b.saturation),p(a.brightness,b.brightness),p(a.gradientPosition,b.gradientPosition),p(la.alpha,lb.alpha)),modes:SIMD4<Float>(from.morphMode,to.morphMode,n.energy,n.cloud),satelliteA:SIMD4<Float>(n.cold,n.cooling,n.texture,n.vapor),satelliteB:SIMD4<Float>(n.visible,n.motion.x,n.motion.y,n.motion.x),satelliteC:SIMD4<Float>(n.motion.y,n.color.x,n.color.y,n.color.z),fingerprint:SIMD4<Float>(n.fingerprint.x,n.fingerprint.y,n.fingerprint.z,0),color0From:rgba(from.palette[0]),color1From:rgba(from.palette[1]),color2From:rgba(from.palette[2]),color3From:rgba(from.palette[3]),color0To:rgba(to.palette[0]),color1To:rgba(to.palette[1]),color2To:rgba(to.palette[2]),color3To:rgba(to.palette[3]))
    }
    private func makeBackgroundUniforms(from:BettaPreset,to:BettaPreset,mix:Float)->BackgroundUniforms { let n=BettaSettings.neutralSatellite,s=0.025+0.025*n.cloud+0.018*n.visible; return BackgroundUniforms(bg0From:rgba(from.background[0]),bg1From:rgba(from.background[1]),bg2From:rgba(from.background[2]),bg0To:rgba(to.background[0]),bg1To:rgba(to.background[1]),bg2To:rgba(to.background[2]),satelliteColorMix:SIMD4<Float>(n.color.x,n.color.y,n.color.z,s),transition:SIMD4<Float>(mix,0,0,0)) }
    private func updatePerformance(now:TimeInterval){ if perfWindowStart==0 { perfWindowStart=now }; perfFrames += 1; let elapsed=now-perfWindowStart; if elapsed>=1 { measuredFPS=Double(perfFrames)/elapsed; perfFrames=0; perfWindowStart=now } }
    private func rgba(_ c:SIMD3<Float>)->SIMD4<Float>{SIMD4<Float>(c.x,c.y,c.z,1)}
    private func write<T>(_ value:T,to buffer:MTLBuffer,offset:Int){var copy=value;withUnsafeBytes(of:&copy){buffer.contents().advanced(by:offset).copyMemory(from:$0.baseAddress!,byteCount:$0.count)}}
    private static func aligned(_ value:Int)->Int{(value + uniformAlignment - 1) & ~(uniformAlignment - 1)}
    private static func loadShaderSource() throws -> String { if let url=Bundle.main.url(forResource:"Shaders",withExtension:"metal"),let s=try?String(contentsOf:url,encoding:.utf8){return s}; if let url=Bundle.module.url(forResource:"Shaders",withExtension:"metal"),let s=try?String(contentsOf:url,encoding:.utf8){return s}; throw BettaRendererError.shaderSourceMissing }
}
