import Foundation
import simd

final class BettaEvolutionController {
    static let defaultSegmentDuration: TimeInterval = 45

    private let advancedStore = BettaAdvancedTuningStore.shared
    private let randomStore = BettaRandomStyleStore.shared
    private var timer: Timer?
    private var referenceId: Int?
    private var source: BettaRandomGeneration?
    private var target: BettaRandomGeneration?
    private var segmentStart: TimeInterval = 0

    private(set) var isRunning = false

    var currentReferenceId: Int? { referenceId }

    var targetSeedShort: String? {
        target?.style.shortSeed
    }

    var progress: Float {
        guard isRunning else { return 0 }
        let elapsed = ProcessInfo.processInfo.systemUptime - segmentStart
        return Float(max(0, min(1, elapsed / Self.defaultSegmentDuration)))
    }

    var statusText: String? {
        guard isRunning else { return nil }
        let seed = targetSeedShort ?? "------"
        let percent = Int((progress * 100).rounded())
        return "Continuous Evolution · next #\(seed) · \(percent)%"
    }

    @discardableResult
    func start(referenceId: Int) -> Bool {
        stop()
        guard let source = randomStore.snapshot(referenceId: referenceId),
              let target = randomStore.makeGeneration(referenceId: referenceId) else { return false }

        self.referenceId = referenceId
        self.source = source
        self.target = target
        segmentStart = ProcessInfo.processInfo.systemUptime
        isRunning = true

        let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        self.timer = timer
        RunLoop.main.add(timer, forMode: .common)
        return true
    }

    func stop() {
        if isRunning { tick() }
        timer?.invalidate()
        timer = nil
        isRunning = false
        referenceId = nil
        source = nil
        target = nil
    }

    private func tick() {
        guard isRunning,
              let referenceId,
              let source,
              let target else { return }

        let now = ProcessInfo.processInfo.systemUptime
        let raw = Float(max(0, min(1, (now - segmentStart) / Self.defaultSegmentDuration)))
        let eased = smoothstep(raw)
        let generation = interpolate(source, target, eased)

        advancedStore.update(referenceId: referenceId, adjustment: generation.adjustment)
        randomStore.update(referenceId: referenceId, style: generation.style)

        guard raw >= 1 else { return }

        // The completed target becomes the exact source of the next generation.
        // There is no cross-fade reset or dwell frame between organisms.
        self.source = target
        guard let next = randomStore.makeGeneration(referenceId: referenceId) else {
            stop()
            return
        }
        self.target = next
        segmentStart = now
    }

    private func interpolate(_ a: BettaRandomGeneration, _ b: BettaRandomGeneration, _ t: Float) -> BettaRandomGeneration {
        let camera = a.adjustment.camera
        let adjustment = BettaAdvancedAdjustment(
            camera: camera,
            tail: interpolateTail(a.adjustment.tail, b.adjustment.tail, t),
            frontLayer: interpolateLayer(a.adjustment.frontLayer, b.adjustment.frontLayer, t),
            backLayer: interpolateLayer(a.adjustment.backLayer, b.adjustment.backLayer, t)
        ).normalized

        let style = BettaRandomStyle(
            seed: b.style.seed,
            palette: interpolateColors(a.style.palette, b.style.palette, count: 4, t: t),
            background: interpolateColors(a.style.background, b.style.background, count: 3, t: t)
        )
        return BettaRandomGeneration(adjustment: adjustment, style: style)
    }

    private func interpolateTail(_ a: BettaTailTuning, _ b: BettaTailTuning, _ t: Float) -> BettaTailTuning {
        let p: (Float, Float) -> Float = { self.mix($0, $1, t) }
        return BettaTailTuning(
            spread: p(a.spread, b.spread),
            rayCount: p(a.rayCount, b.rayCount),
            foldDensity: p(a.foldDensity, b.foldDensity),
            curl: p(a.curl, b.curl),
            twist: p(a.twist, b.twist),
            edgeFlutter: p(a.edgeFlutter, b.edgeFlutter),
            depth: p(a.depth, b.depth),
            currentStrength: p(a.currentStrength, b.currentStrength),
            motionSpeed: p(a.motionSpeed, b.motionSpeed),
            turbulence: p(a.turbulence, b.turbulence),
            motionAmplitude: p(a.motionAmplitude, b.motionAmplitude),
            opacity: p(a.opacity, b.opacity),
            transmission: p(a.transmission, b.transmission),
            rimStrength: p(a.rimStrength, b.rimStrength),
            foldHighlight: p(a.foldHighlight, b.foldHighlight),
            iridescence: p(a.iridescence, b.iridescence),
            bloom: p(a.bloom, b.bloom),
            saturation: p(a.saturation, b.saturation),
            brightness: p(a.brightness, b.brightness),
            gradientPosition: p(a.gradientPosition, b.gradientPosition),
            microFold: p(a.microFold, b.microFold),
            rayDefinition: p(a.rayDefinition, b.rayDefinition),
            edgeRuffle: p(a.edgeRuffle, b.edgeRuffle),
            veinStrength: p(a.veinStrength, b.veinStrength),
            membraneGrain: p(a.membraneGrain, b.membraneGrain),
            fineFlutter: p(a.fineFlutter, b.fineFlutter),
            normalDetail: p(a.normalDetail, b.normalDetail)
        ).normalized
    }

    private func interpolateLayer(_ a: BettaLayerTuning, _ b: BettaLayerTuning, _ t: Float) -> BettaLayerTuning {
        BettaLayerTuning(
            scale: mix(a.scale, b.scale, t),
            rotation: mix(a.rotation, b.rotation, t),
            x: mix(a.x, b.x, t),
            y: mix(a.y, b.y, t),
            z: mix(a.z, b.z, t),
            alpha: mix(a.alpha, b.alpha, t),
            phase: mix(a.phase, b.phase, t)
        ).normalized
    }

    private func interpolateColors(_ a: [BettaStoredColor], _ b: [BettaStoredColor], count: Int, t: Float) -> [BettaStoredColor] {
        guard a.count >= count, b.count >= count else { return Array(b.prefix(count)) }
        return (0..<count).map { index in
            let ca = a[index].simd
            let cb = b[index].simd
            return BettaStoredColor(ca + (cb - ca) * t)
        }
    }

    private func mix(_ a: Float, _ b: Float, _ t: Float) -> Float {
        a + (b - a) * t
    }

    private func smoothstep(_ x: Float) -> Float {
        let t = min(1, max(0, x))
        return t * t * (3 - 2 * t)
    }
}