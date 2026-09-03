import AppKit
import Foundation
import simd

final class BettaEnvironmentStore {
    static let shared = BettaEnvironmentStore()

    private let lock = NSLock()
    private var state = BettaSettings.neutralSatelliteBaseline
    private var target = BettaSettings.neutralSatelliteBaseline
    private var _sourceLabel = "Neutral"
    private var _lastObservation: Date?
    private var _lastError: String?

    private init() {}

    var current: NeutralSatelliteState {
        lock.lock(); defer { lock.unlock() }
        return state
    }

    var sourceLabel: String {
        lock.lock(); defer { lock.unlock() }
        return _sourceLabel
    }

    var lastObservation: Date? {
        lock.lock(); defer { lock.unlock() }
        return _lastObservation
    }

    var lastError: String? {
        lock.lock(); defer { lock.unlock() }
        return _lastError
    }

    func setTarget(_ newTarget: NeutralSatelliteState, source: String, observedAt: Date?) {
        lock.lock(); defer { lock.unlock() }
        target = newTarget.clamped
        _sourceLabel = source
        _lastObservation = observedAt
        _lastError = nil
    }

    func setError(_ message: String) {
        lock.lock(); defer { lock.unlock() }
        _lastError = message
    }

    func returnToNeutral() {
        lock.lock(); defer { lock.unlock() }
        target = BettaSettings.neutralSatelliteBaseline
        _sourceLabel = "Neutral"
        _lastObservation = nil
    }

    /// Smooth environmental changes over minutes so a new satellite frame never
    /// causes a visible jump in the organism. Half-life is intentionally long.
    func advance(deltaTime: TimeInterval, halfLife: TimeInterval = 180) {
        let dt = max(0, min(5, deltaTime))
        let alpha = Float(1 - exp(-log(2) * dt / max(1, halfLife)))
        guard alpha > 0 else { return }

        lock.lock(); defer { lock.unlock() }
        state = state.interpolated(to: target, t: alpha).clamped
    }
}

private extension NeutralSatelliteState {
    var clamped: NeutralSatelliteState {
        NeutralSatelliteState(
            energy: clamp01(energy),
            cloud: clamp01(cloud),
            cold: clamp01(cold),
            cooling: clamp01(cooling),
            texture: clamp01(texture),
            vapor: clamp01(vapor),
            visible: clamp01(visible),
            motion: SIMD2<Float>(min(1, max(-1, motion.x)), min(1, max(-1, motion.y))),
            color: SIMD3<Float>(
                min(1, max(0, color.x)),
                min(1, max(0, color.y)),
                min(1, max(0, color.z))
            ),
            fingerprint: SIMD3<Float>(
                clamp01(fingerprint.x),
                clamp01(fingerprint.y),
                clamp01(fingerprint.z)
            )
        )
    }

    func interpolated(to other: NeutralSatelliteState, t: Float) -> NeutralSatelliteState {
        NeutralSatelliteState(
            energy: lerp(energy, other.energy, t),
            cloud: lerp(cloud, other.cloud, t),
            cold: lerp(cold, other.cold, t),
            cooling: lerp(cooling, other.cooling, t),
            texture: lerp(texture, other.texture, t),
            vapor: lerp(vapor, other.vapor, t),
            visible: lerp(visible, other.visible, t),
            motion: motion + (other.motion - motion) * t,
            color: lerp(color, other.color, t),
            fingerprint: lerp(fingerprint, other.fingerprint, t)
        )
    }
}

struct BettaAtmosphereMetrics: Equatable {
    var infraredLuma: Float
    var infraredContrast: Float
    var vaporLuma: Float
    var vaporContrast: Float
    var trueColorLuma: Float
    var trueColorRGB: SIMD3<Float>
    var motionStrength: Float
    var motion: SIMD2<Float>
    var fingerprint: SIMD3<Float>
}

enum BettaAtmosphereMath {
    static func makeState(metrics m: BettaAtmosphereMetrics) -> NeutralSatelliteState {
        let baseline = BettaSettings.neutralSatelliteBaseline
        let cloud = clamp01(0.10 + m.infraredLuma * 0.90)
        let cold = clamp01((m.infraredLuma - 0.22) / 0.62)
        let vapor = clamp01(0.12 + m.vaporLuma * 0.92)
        let texture = clamp01(0.10 + m.infraredContrast * 2.7 + m.vaporContrast * 1.5)
        let visible = clamp01(m.trueColorLuma * 1.35)
        let cooling = clamp01(max(0, cold - 0.52) * 0.9)
        let energy = clamp01(0.36 + texture * 0.26 + m.motionStrength * 0.28 + cloud * 0.12)

        var atmosphericColor = baseline.color * 0.68 + m.trueColorRGB * 0.32
        atmosphericColor.x = min(0.65, max(0.04, atmosphericColor.x))
        atmosphericColor.y = min(0.65, max(0.04, atmosphericColor.y))
        atmosphericColor.z = min(0.72, max(0.06, atmosphericColor.z))

        return NeutralSatelliteState(
            energy: energy,
            cloud: cloud,
            cold: cold,
            cooling: cooling,
            texture: texture,
            vapor: vapor,
            visible: visible,
            motion: SIMD2<Float>(
                min(1, max(-1, m.motion.x)),
                min(1, max(-1, m.motion.y))
            ),
            color: atmosphericColor,
            fingerprint: SIMD3<Float>(
                clamp01(m.fingerprint.x),
                clamp01(m.fingerprint.y),
                clamp01(m.fingerprint.z)
            )
        )
    }
}

@MainActor
final class BettaHimawariAtmosphereController {
    private struct TargetTime: Decodable {
        let basetime: String
        let validtime: String
    }

    private struct ImageSample {
        let rgb: SIMD3<Float>
        let luma: Float
        let contrast: Float
        let quadrants: SIMD4<Float>
        let grid: [Float]
    }

    private let store = BettaEnvironmentStore.shared
    private let defaults = UserDefaults.standard
    private let enabledKey = "betta.atmosphere.himawari.enabled.v1"
    private var smoothingTimer: Timer?
    private var refreshTimer: Timer?
    private var previousInfrared: ImageSample?
    private var lastTick = ProcessInfo.processInfo.systemUptime
    private var isRefreshing = false

    private let targetTimesURL = URL(string: "https://www.jma.go.jp/bosai/himawari/data/satimg/targetTimes_fd.json")!
    private let zoom = 5
    // Standard Web Mercator tile containing central Bangkok at z=5.
    private let bangkokTileX = 24
    private let bangkokTileY = 14

    var isEnabled: Bool {
        if defaults.object(forKey: enabledKey) == nil { return true }
        return defaults.bool(forKey: enabledKey)
    }

    var statusText: String {
        if !isEnabled { return "Atmosphere · Still" }
        if isRefreshing { return "Atmosphere · Himawari updating…" }
        if store.lastError != nil, store.lastObservation == nil {
            return "Atmosphere · Neutral fallback"
        }
        if let date = store.lastObservation {
            let formatter = DateFormatter()
            formatter.timeZone = BettaSettings.bangkokTimeZone
            formatter.dateFormat = "HH:mm"
            return "Atmosphere · Himawari \(formatter.string(from: date))"
        }
        return "Atmosphere · Himawari starting"
    }

    func start() {
        stopTimers()
        lastTick = ProcessInfo.processInfo.systemUptime
        smoothingTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let now = ProcessInfo.processInfo.systemUptime
                self.store.advance(deltaTime: now - self.lastTick)
                self.lastTick = now
            }
        }
        if let smoothingTimer { RunLoop.main.add(smoothingTimer, forMode: .common) }

        refreshTimer = Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refreshNow() }
        }
        if let refreshTimer { RunLoop.main.add(refreshTimer, forMode: .common) }

        if isEnabled { refreshNow() }
        else { store.returnToNeutral() }
    }

    func stop() {
        stopTimers()
    }

    func setEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: enabledKey)
        if enabled { refreshNow() }
        else {
            store.returnToNeutral()
            previousInfrared = nil
        }
    }

    func refreshNow() {
        guard isEnabled, !isRefreshing else { return }
        isRefreshing = true
        Task { [weak self] in
            guard let self else { return }
            defer { self.isRefreshing = false }
            do {
                try await self.refreshFromJMA()
            } catch {
                self.store.setError(error.localizedDescription)
            }
        }
    }

    private func stopTimers() {
        smoothingTimer?.invalidate(); smoothingTimer = nil
        refreshTimer?.invalidate(); refreshTimer = nil
    }

    private func refreshFromJMA() async throws {
        let timesData = try await fetch(targetTimesURL)
        let times = try JSONDecoder().decode([TargetTime].self, from: timesData)
        guard let latest = times.max(by: { $0.validtime < $1.validtime }) else {
            throw NSError(domain: "BETTA.Himawari", code: 1, userInfo: [NSLocalizedDescriptionKey: "JMA returned no Himawari observation times."])
        }

        let irURL = tileURL(time: latest, segment: "B13/TBB")
        let vaporURL = tileURL(time: latest, segment: "B08/TBB")
        let colorURL = tileURL(time: latest, segment: "REP/ETC")

        async let irData = fetch(irURL)
        async let vaporData = fetch(vaporURL)
        async let colorData = fetch(colorURL)
        let (irBytes, vaporBytes, colorBytes) = try await (irData, vaporData, colorData)

        guard let ir = sampleImage(irBytes),
              let vapor = sampleImage(vaporBytes),
              let color = sampleImage(colorBytes) else {
            throw NSError(domain: "BETTA.Himawari", code: 2, userInfo: [NSLocalizedDescriptionKey: "Himawari image tiles could not be sampled."])
        }

        let movement = movementMetrics(previous: previousInfrared, current: ir)
        previousInfrared = ir

        let metrics = BettaAtmosphereMetrics(
            infraredLuma: ir.luma,
            infraredContrast: ir.contrast,
            vaporLuma: vapor.luma,
            vaporContrast: vapor.contrast,
            trueColorLuma: color.luma,
            trueColorRGB: color.rgb,
            motionStrength: movement.strength,
            motion: movement.vector,
            fingerprint: SIMD3<Float>(ir.quadrants.x, ir.quadrants.y, ir.quadrants.z)
        )
        let state = BettaAtmosphereMath.makeState(metrics: metrics)
        store.setTarget(state, source: "JMA Himawari-9", observedAt: parseJMATime(latest.validtime))
    }

    private func fetch(_ url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.cachePolicy = .reloadRevalidatingCacheData
        request.setValue("BETTA/1.0 macOS living-art renderer", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "BETTA.Himawari", code: 3, userInfo: [NSLocalizedDescriptionKey: "Himawari request failed."])
        }
        return data
    }

    private func tileURL(time: TargetTime, segment: String) -> URL {
        URL(string: "https://www.jma.go.jp/bosai/himawari/data/satimg/\(time.basetime)/fd/\(time.validtime)/\(segment)/\(zoom)/\(bangkokTileX)/\(bangkokTileY).jpg")!
    }

    private func parseJMATime(_ string: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyyMMddHHmmss"
        return f.date(from: string)
    }

    private func sampleImage(_ data: Data) -> ImageSample? {
        guard let bitmap = NSBitmapImageRep(data: data), bitmap.pixelsWide > 0, bitmap.pixelsHigh > 0 else { return nil }
        let sampleSide = 16
        var rgb = SIMD3<Float>.zero
        var lumas: [Float] = []
        lumas.reserveCapacity(sampleSide * sampleSide)
        var quadrants = SIMD4<Float>.zero
        var quadrantCounts = SIMD4<Float>.zero

        for gy in 0..<sampleSide {
            for gx in 0..<sampleSide {
                let x = min(bitmap.pixelsWide - 1, Int((Float(gx) + 0.5) / Float(sampleSide) * Float(bitmap.pixelsWide)))
                let y = min(bitmap.pixelsHigh - 1, Int((Float(gy) + 0.5) / Float(sampleSide) * Float(bitmap.pixelsHigh)))
                guard let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.sRGB) else { continue }
                let c = SIMD3<Float>(Float(color.redComponent), Float(color.greenComponent), Float(color.blueComponent))
                let l = c.x * 0.2126 + c.y * 0.7152 + c.z * 0.0722
                rgb += c
                lumas.append(l)
                let qi = (gy < sampleSide / 2 ? 0 : 2) + (gx < sampleSide / 2 ? 0 : 1)
                quadrants[qi] += l
                quadrantCounts[qi] += 1
            }
        }

        guard !lumas.isEmpty else { return nil }
        let count = Float(lumas.count)
        let mean = lumas.reduce(0, +) / count
        let variance = lumas.reduce(Float.zero) { $0 + ($1 - mean) * ($1 - mean) } / count
        for i in 0..<4 where quadrantCounts[i] > 0 { quadrants[i] /= quadrantCounts[i] }
        return ImageSample(
            rgb: rgb / count,
            luma: mean,
            contrast: sqrt(max(0, variance)),
            quadrants: quadrants,
            grid: lumas
        )
    }

    private func movementMetrics(previous: ImageSample?, current: ImageSample) -> (strength: Float, vector: SIMD2<Float>) {
        guard let previous, previous.grid.count == current.grid.count, !current.grid.isEmpty else {
            return (0, .zero)
        }

        var total: Float = 0
        var left: Float = 0, right: Float = 0, top: Float = 0, bottom: Float = 0
        let side = Int(sqrt(Double(current.grid.count)))
        for i in current.grid.indices {
            let d = abs(current.grid[i] - previous.grid[i])
            total += d
            let x = i % side
            let y = i / side
            if x < side / 2 { left += d } else { right += d }
            if y < side / 2 { top += d } else { bottom += d }
        }
        let count = Float(current.grid.count)
        let mean = total / count
        let half = max(1, count / 2)
        let vector = SIMD2<Float>(
            min(1, max(-1, ((right - left) / half) * 5)),
            min(1, max(-1, ((bottom - top) / half) * 5))
        )
        return (clamp01(mean * 7), vector)
    }
}
