import Foundation
import simd

struct BettaStoredColor: Codable, Equatable {
    var r: Float
    var g: Float
    var b: Float

    init(_ value: SIMD3<Float>) {
        r = value.x
        g = value.y
        b = value.z
    }

    var simd: SIMD3<Float> {
        SIMD3<Float>(
            min(1, max(0, r)),
            min(1, max(0, g)),
            min(1, max(0, b))
        )
    }
}

struct BettaRandomStyle: Codable, Equatable {
    var seed: UInt64
    var palette: [BettaStoredColor]
    var background: [BettaStoredColor]

    var resolvedPalette: [SIMD3<Float>]? {
        guard palette.count >= 4 else { return nil }
        return Array(palette.prefix(4)).map(\.simd)
    }

    var resolvedBackground: [SIMD3<Float>]? {
        guard background.count >= 3 else { return nil }
        return Array(background.prefix(3)).map(\.simd)
    }

    var shortSeed: String {
        String(seed, radix: 16, uppercase: true).suffix(6).description
    }
}

final class BettaRandomStyleStore {
    static let shared = BettaRandomStyleStore()

    private struct SplitMix64 {
        var state: UInt64

        mutating func next() -> UInt64 {
            state &+= 0x9E3779B97F4A7C15
            var z = state
            z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
            z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
            return z ^ (z >> 31)
        }

        mutating func unit() -> Float {
            let value = Double(next() >> 11) / 9_007_199_254_740_992.0
            return Float(value)
        }

        mutating func range(_ lower: Float, _ upper: Float) -> Float {
            lower + (upper - lower) * unit()
        }

        mutating func signed(_ magnitude: Float) -> Float {
            range(-magnitude, magnitude)
        }

        mutating func index(_ count: Int) -> Int {
            guard count > 0 else { return 0 }
            return Int(next() % UInt64(count))
        }

        mutating func chance(_ probability: Float) -> Bool {
            unit() < probability
        }
    }

    private static let storageKey = "sindhorn-betta-metal:random-styles:v1"
    private let lock = NSLock()
    private var values: [Int: BettaRandomStyle]

    private init() {
        var loaded: [Int: BettaRandomStyle] = [:]
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode([String: BettaRandomStyle].self, from: data) {
            for (key, value) in decoded {
                guard let referenceId = Int(key), (1...8).contains(referenceId),
                      value.resolvedPalette != nil, value.resolvedBackground != nil else { continue }
                loaded[referenceId] = value
            }
        }
        values = loaded
    }

    func style(for referenceId: Int) -> BettaRandomStyle? {
        lock.lock(); defer { lock.unlock() }
        return values[referenceId]
    }

    func clear(referenceId: Int) {
        lock.lock(); defer { lock.unlock() }
        values.removeValue(forKey: referenceId)
    }

    @discardableResult
    func randomize(referenceId: Int) -> BettaRandomStyle? {
        guard let preset = BettaPreset.all.first(where: { $0.referenceId == referenceId }) else { return nil }

        let seed = UInt64.random(in: UInt64.min...UInt64.max)
        var rng = SplitMix64(state: seed)
        let archetype = BettaPreset.all[rng.index(BettaPreset.all.count)]
        let accentPreset = BettaPreset.all[rng.index(BettaPreset.all.count)]

        var tail = BettaTailTuning.canonical(archetype)
        tail.spread *= rng.range(0.90, 1.12)
        tail.rayCount = Float([72, 80, 88, 96, 104, 112, 120, 128][rng.index(8)])
        tail.foldDensity *= rng.range(0.86, 1.18)
        tail.curl += rng.signed(0.24)
        tail.twist += rng.signed(0.24)
        tail.edgeFlutter *= rng.range(0.78, 1.42)
        tail.depth *= rng.range(0.88, 1.18)
        tail.currentStrength *= rng.range(0.82, 1.24)
        tail.motionSpeed *= rng.range(0.88, 1.16)
        tail.turbulence *= rng.range(0.80, 1.30)
        tail.motionAmplitude *= rng.range(0.88, 1.18)
        tail.opacity *= rng.range(0.90, 1.08)
        tail.transmission *= rng.range(0.90, 1.10)
        tail.rimStrength *= rng.range(0.90, 1.14)
        tail.foldHighlight *= rng.range(0.90, 1.14)
        tail.iridescence *= rng.range(0.78, 1.30)
        tail.bloom *= rng.range(0.88, 1.16)
        tail.saturation *= rng.range(0.92, 1.10)
        tail.brightness *= rng.range(0.94, 1.08)
        tail.gradientPosition += rng.signed(0.08)
        tail.microFold = rng.range(0.65, 1.75)
        tail.rayDefinition = rng.range(0.72, 1.85)
        tail.edgeRuffle = rng.range(0.60, 1.75)
        tail.veinStrength = rng.range(0.45, 1.60)
        tail.membraneGrain = rng.range(0.45, 1.40)
        tail.fineFlutter = rng.range(0.60, 1.70)
        tail.normalDetail = rng.range(0.82, 1.85)
        tail = tail.normalized

        var adjustment = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        adjustment.tail = tail
        adjustment.frontLayer = randomizedLayer(
            canonical: .canonical(preset.layers[0]),
            isBack: false,
            rng: &rng
        )
        adjustment.backLayer = randomizedLayer(
            canonical: .canonical(preset.layers[1]),
            isBack: true,
            rng: &rng
        )
        BettaAdvancedTuningStore.shared.update(referenceId: referenceId, adjustment: adjustment)

        let palette = makePalette(base: archetype.palette, accent: accentPreset.palette, rng: &rng)
        let background = makeMatchingBackground(palette: palette, rng: &rng)
        let style = BettaRandomStyle(
            seed: seed,
            palette: palette.map(BettaStoredColor.init),
            background: background.map(BettaStoredColor.init)
        )

        lock.lock()
        values[referenceId] = style
        lock.unlock()
        return style
    }

    @discardableResult
    func save() -> Bool {
        lock.lock(); let snapshot = values; lock.unlock()
        let encoded = Dictionary(uniqueKeysWithValues: snapshot.map { (String($0.key), $0.value) })
        guard let data = try? JSONEncoder().encode(encoded) else { return false }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
        return UserDefaults.standard.synchronize()
    }

    private func randomizedLayer(canonical: BettaLayerTuning, isBack: Bool, rng: inout SplitMix64) -> BettaLayerTuning {
        var layer = canonical
        layer.scale *= isBack ? rng.range(0.88, 1.08) : rng.range(0.96, 1.05)
        layer.rotation += rng.signed(isBack ? 0.16 : 0.055)
        layer.x += rng.signed(isBack ? 0.08 : 0.035)
        layer.y += rng.signed(isBack ? 0.08 : 0.035)
        layer.z += rng.signed(isBack ? 0.06 : 0.025)
        layer.alpha *= isBack ? rng.range(0.78, 1.18) : rng.range(0.94, 1.04)
        layer.phase += rng.signed(isBack ? 12 : 7)
        return layer.normalized
    }

    private func makePalette(base: [SIMD3<Float>], accent: [SIMD3<Float>], rng: inout SplitMix64) -> [SIMD3<Float>] {
        guard base.count >= 4, accent.count >= 4 else { return base }
        let subtleMix = rng.range(0.04, 0.22)
        let useAccentHighlight = rng.chance(0.62)
        let useAccentEdge = rng.chance(0.72)

        return [
            mix(base[0], accent[0], subtleMix * 0.35),
            mix(base[1], accent[1], subtleMix),
            useAccentHighlight ? mix(base[2], accent[2], rng.range(0.52, 0.88)) : base[2],
            useAccentEdge ? mix(base[3], accent[3], rng.range(0.48, 0.86)) : base[3]
        ].map(clampedColor)
    }

    private func makeMatchingBackground(palette: [SIMD3<Float>], rng: inout SplitMix64) -> [SIMD3<Float>] {
        guard palette.count >= 4 else { return [SIMD3<Float>(repeating: 0.003), SIMD3<Float>(repeating: 0.008), SIMD3<Float>(repeating: 0.012)] }
        let neutral = SIMD3<Float>(0.0012, 0.0016, 0.0024)
        let first = (mix(palette[0], palette[1], rng.range(0.28, 0.48)) * rng.range(0.045, 0.085)) + neutral
        let middle = (mix(palette[1], palette[2], rng.range(0.18, 0.40)) * rng.range(0.055, 0.105)) + neutral * 1.25
        let last = (mix(palette[2], palette[3], rng.range(0.28, 0.58)) * rng.range(0.040, 0.085)) + neutral
        return [first, middle, last].map { color in
            SIMD3<Float>(
                min(0.16, max(0.0005, color.x)),
                min(0.16, max(0.0005, color.y)),
                min(0.16, max(0.0005, color.z))
            )
        }
    }

    private func mix(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ t: Float) -> SIMD3<Float> {
        a + (b - a) * min(1, max(0, t))
    }

    private func clampedColor(_ value: SIMD3<Float>) -> SIMD3<Float> {
        SIMD3<Float>(
            min(1, max(0, value.x)),
            min(1, max(0, value.y)),
            min(1, max(0, value.z))
        )
    }
}