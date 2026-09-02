import Foundation

struct BettaCompositionAdjustment: Codable, Equatable {
    var scale: Float
    var x: Float
    var y: Float
    var z: Float
    var rotationX: Float
    var rotationY: Float
    var rotationZ: Float

    static let landscapeDefault = BettaCompositionAdjustment(
        scale: 1,
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 90
    )

    var normalized: BettaCompositionAdjustment {
        BettaCompositionAdjustment(
            scale: min(2.2, max(0.35, scale)),
            x: min(8, max(-8, x)),
            y: min(5, max(-5, y)),
            z: min(4, max(-4, z)),
            rotationX: Self.clampedDegrees(rotationX),
            rotationY: Self.clampedDegrees(rotationY),
            rotationZ: Self.clampedDegrees(rotationZ)
        )
    }

    private static func clampedDegrees(_ value: Float) -> Float {
        min(180, max(-180, value))
    }
}

final class BettaCompositionStore {
    static let shared = BettaCompositionStore()

    private struct LegacyAdjustment: Codable {
        var quarterTurns: Int
        var scale: Float
        var x: Float
        var y: Float
        var z: Float
    }

    private static let storageKey = "sindhorn-betta-metal:landscape-compositions:v2"
    private static let legacyStorageKey = "sindhorn-betta-metal:landscape-compositions:v1"
    private let lock = NSLock()
    private var values: [Int: BettaCompositionAdjustment]

    private init() {
        var loaded: [Int: BettaCompositionAdjustment] = [:]

        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode([String: BettaCompositionAdjustment].self, from: data) {
            for (key, value) in decoded {
                if let referenceId = Int(key), (1...8).contains(referenceId) {
                    loaded[referenceId] = value.normalized
                }
            }
        } else if let data = UserDefaults.standard.data(forKey: Self.legacyStorageKey),
                  let decoded = try? JSONDecoder().decode([String: LegacyAdjustment].self, from: data) {
            for (key, value) in decoded {
                guard let referenceId = Int(key), (1...8).contains(referenceId) else { continue }
                loaded[referenceId] = BettaCompositionAdjustment(
                    scale: value.scale,
                    x: value.x,
                    y: value.y,
                    z: value.z,
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: Float(min(1, max(-1, value.quarterTurns))) * 90
                ).normalized
            }
        }

        for referenceId in 1...8 where loaded[referenceId] == nil {
            loaded[referenceId] = .landscapeDefault
        }
        values = loaded
    }

    func adjustment(for referenceId: Int) -> BettaCompositionAdjustment {
        lock.lock(); defer { lock.unlock() }
        return values[referenceId] ?? .landscapeDefault
    }

    func update(referenceId: Int, adjustment: BettaCompositionAdjustment) {
        guard (1...8).contains(referenceId) else { return }
        lock.lock(); defer { lock.unlock() }
        values[referenceId] = adjustment.normalized
    }

    func reset(referenceId: Int) {
        update(referenceId: referenceId, adjustment: .landscapeDefault)
    }

    func resetAll() {
        lock.lock(); defer { lock.unlock() }
        for referenceId in 1...8 { values[referenceId] = .landscapeDefault }
    }

    @discardableResult
    func save() -> Bool {
        lock.lock()
        let snapshot = values
        lock.unlock()
        let encoded = Dictionary(uniqueKeysWithValues: snapshot.map { (String($0.key), $0.value.normalized) })
        guard let data = try? JSONEncoder().encode(encoded) else { return false }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
        return UserDefaults.standard.synchronize()
    }

    func snapshot() -> [Int: BettaCompositionAdjustment] {
        lock.lock(); defer { lock.unlock() }
        return values
    }
}
