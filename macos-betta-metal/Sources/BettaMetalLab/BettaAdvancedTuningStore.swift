import Foundation

struct BettaCameraAdjustment: Codable, Equatable {
    var fov: Float
    var x: Float
    var y: Float
    var z: Float
    var pitch: Float
    var yaw: Float
    var roll: Float

    static let canonical = BettaCameraAdjustment(fov: 32, x: 0, y: 0, z: 9, pitch: 0, yaw: 0, roll: 0)

    var normalized: BettaCameraAdjustment {
        BettaCameraAdjustment(
            fov: min(90, max(12, fov)),
            x: min(10, max(-10, x)),
            y: min(10, max(-10, y)),
            z: min(25, max(2, z)),
            pitch: min(89, max(-89, pitch)),
            yaw: min(180, max(-180, yaw)),
            roll: min(180, max(-180, roll))
        )
    }
}

struct BettaLayerTuning: Codable, Equatable {
    var scale: Float
    var rotation: Float
    var x: Float
    var y: Float
    var z: Float
    var alpha: Float
    var phase: Float

    static func canonical(_ layer: BettaLayer) -> BettaLayerTuning {
        BettaLayerTuning(scale: layer.scale, rotation: layer.rotation, x: layer.offset.x, y: layer.offset.y, z: layer.offset.z, alpha: layer.alpha, phase: layer.phase)
    }

    var normalized: BettaLayerTuning {
        BettaLayerTuning(
            scale: min(1.8, max(0.25, scale)),
            rotation: min(.pi, max(-.pi, rotation)),
            x: min(2, max(-2, x)),
            y: min(2, max(-2, y)),
            z: min(2, max(-2, z)),
            alpha: min(1.25, max(0, alpha)),
            phase: min(100, max(-100, phase))
        )
    }
}

struct BettaTailTuning: Codable, Equatable {
    var spread: Float
    var rayCount: Float
    var foldDensity: Float
    var curl: Float
    var twist: Float
    var edgeFlutter: Float
    var depth: Float
    var currentStrength: Float
    var motionSpeed: Float
    var turbulence: Float
    var motionAmplitude: Float
    var opacity: Float
    var transmission: Float
    var rimStrength: Float
    var foldHighlight: Float
    var iridescence: Float
    var bloom: Float
    var saturation: Float
    var brightness: Float
    var gradientPosition: Float

    // Mac-only high-detail controls. 1.0 preserves the canonical appearance.
    var microFold: Float
    var rayDefinition: Float
    var edgeRuffle: Float
    var veinStrength: Float
    var membraneGrain: Float
    var fineFlutter: Float
    var normalDetail: Float

    static func canonical(_ preset: BettaPreset) -> BettaTailTuning {
        let p = preset.params
        return BettaTailTuning(
            spread: p.spread,
            rayCount: Float(p.rayCount),
            foldDensity: p.foldDensity,
            curl: p.curl,
            twist: p.twist,
            edgeFlutter: p.edgeFlutter,
            depth: p.depth,
            currentStrength: p.currentStrength,
            motionSpeed: p.motionSpeed,
            turbulence: p.turbulence,
            motionAmplitude: p.motionAmplitude,
            opacity: p.opacity,
            transmission: p.transmission,
            rimStrength: p.rimStrength,
            foldHighlight: p.foldHighlight,
            iridescence: p.iridescence,
            bloom: p.bloom,
            saturation: p.saturation,
            brightness: p.brightness,
            gradientPosition: p.gradientPosition,
            microFold: 1,
            rayDefinition: 1,
            edgeRuffle: 1,
            veinStrength: 1,
            membraneGrain: 1,
            fineFlutter: 1,
            normalDetail: 1
        )
    }

    var normalized: BettaTailTuning {
        var v = self
        v.spread = min(4.8, max(1.2, v.spread))
        v.rayCount = min(160, max(24, v.rayCount))
        v.foldDensity = min(24, max(2, v.foldDensity))
        v.curl = min(2, max(-2, v.curl))
        v.twist = min(1.5, max(-1.5, v.twist))
        v.edgeFlutter = min(0.45, max(0, v.edgeFlutter))
        v.depth = min(1.5, max(0.05, v.depth))
        v.currentStrength = min(1, max(0, v.currentStrength))
        v.motionSpeed = min(1, max(0.03, v.motionSpeed))
        v.turbulence = min(1, max(0, v.turbulence))
        v.motionAmplitude = min(1, max(0, v.motionAmplitude))
        v.opacity = min(1.2, max(0.05, v.opacity))
        v.transmission = min(1.3, max(0, v.transmission))
        v.rimStrength = min(2.5, max(0, v.rimStrength))
        v.foldHighlight = min(2.5, max(0, v.foldHighlight))
        v.iridescence = min(1.5, max(0, v.iridescence))
        v.bloom = min(1.5, max(0, v.bloom))
        v.saturation = min(2.5, max(0, v.saturation))
        v.brightness = min(2.5, max(0.4, v.brightness))
        v.gradientPosition = min(0.5, max(-0.5, v.gradientPosition))
        v.microFold = min(2.5, max(0, v.microFold))
        v.rayDefinition = min(2.5, max(0, v.rayDefinition))
        v.edgeRuffle = min(2.5, max(0, v.edgeRuffle))
        v.veinStrength = min(2.5, max(0, v.veinStrength))
        v.membraneGrain = min(2.5, max(0, v.membraneGrain))
        v.fineFlutter = min(2.5, max(0, v.fineFlutter))
        v.normalDetail = min(2.5, max(0, v.normalDetail))
        return v
    }
}

struct BettaAdvancedAdjustment: Codable, Equatable {
    var camera: BettaCameraAdjustment
    var tail: BettaTailTuning
    var frontLayer: BettaLayerTuning
    var backLayer: BettaLayerTuning

    static func canonical(_ preset: BettaPreset) -> BettaAdvancedAdjustment {
        BettaAdvancedAdjustment(
            camera: .canonical,
            tail: .canonical(preset),
            frontLayer: .canonical(preset.layers[0]),
            backLayer: .canonical(preset.layers[1])
        )
    }

    var normalized: BettaAdvancedAdjustment {
        BettaAdvancedAdjustment(camera: camera.normalized, tail: tail.normalized, frontLayer: frontLayer.normalized, backLayer: backLayer.normalized)
    }
}

final class BettaAdvancedTuningStore {
    static let shared = BettaAdvancedTuningStore()

    private static let storageKey = "sindhorn-betta-metal:advanced-tail-camera:v1"
    private let lock = NSLock()
    private var values: [Int: BettaAdvancedAdjustment]

    private init() {
        var loaded: [Int: BettaAdvancedAdjustment] = [:]
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode([String: BettaAdvancedAdjustment].self, from: data) {
            for (key, value) in decoded {
                if let referenceId = Int(key), (1...8).contains(referenceId) {
                    loaded[referenceId] = value.normalized
                }
            }
        }
        for preset in BettaPreset.all where loaded[preset.referenceId] == nil {
            loaded[preset.referenceId] = .canonical(preset)
        }
        values = loaded
    }

    func adjustment(for referenceId: Int) -> BettaAdvancedAdjustment {
        lock.lock(); defer { lock.unlock() }
        if let value = values[referenceId] { return value }
        let preset = BettaPreset.all.first(where: { $0.referenceId == referenceId }) ?? BettaPreset.all[0]
        return .canonical(preset)
    }

    func update(referenceId: Int, adjustment: BettaAdvancedAdjustment) {
        guard (1...8).contains(referenceId) else { return }
        lock.lock(); defer { lock.unlock() }
        values[referenceId] = adjustment.normalized
    }

    func reset(referenceId: Int) {
        guard let preset = BettaPreset.all.first(where: { $0.referenceId == referenceId }) else { return }
        update(referenceId: referenceId, adjustment: .canonical(preset))
    }

    func resetAll() {
        lock.lock(); defer { lock.unlock() }
        for preset in BettaPreset.all { values[preset.referenceId] = .canonical(preset) }
    }

    @discardableResult
    func save() -> Bool {
        lock.lock(); let snapshot = values; lock.unlock()
        let encoded = Dictionary(uniqueKeysWithValues: snapshot.map { (String($0.key), $0.value.normalized) })
        guard let data = try? JSONEncoder().encode(encoded) else { return false }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
        return UserDefaults.standard.synchronize()
    }
}
