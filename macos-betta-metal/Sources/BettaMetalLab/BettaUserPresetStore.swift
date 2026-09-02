import Foundation

struct BettaSavedPreset: Codable, Equatable {
    var id: String
    var name: String
    var createdAt: Date
    var referenceId: Int
    var composition: BettaCompositionAdjustment
    var advanced: BettaAdvancedAdjustment
    var randomStyle: BettaRandomStyle?
    var isFavorite: Bool
}

final class BettaUserPresetStore {
    static let shared = BettaUserPresetStore()

    private static let storageKey = "sindhorn-betta-metal:user-presets:v1"
    private let lock = NSLock()
    private var values: [BettaSavedPreset]

    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode([BettaSavedPreset].self, from: data) {
            values = decoded.filter { (1...8).contains($0.referenceId) }
        } else {
            values = []
        }
    }

    func all() -> [BettaSavedPreset] {
        lock.lock(); defer { lock.unlock() }
        return values.sorted {
            if $0.isFavorite != $1.isFavorite { return $0.isFavorite && !$1.isFavorite }
            return $0.createdAt > $1.createdAt
        }
    }

    func preset(id: String) -> BettaSavedPreset? {
        lock.lock(); defer { lock.unlock() }
        return values.first(where: { $0.id == id })
    }

    @discardableResult
    func saveCurrent(referenceId: Int, name: String, favorite: Bool = false) -> BettaSavedPreset? {
        guard (1...8).contains(referenceId) else { return nil }
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let snapshot = BettaSavedPreset(
            id: UUID().uuidString,
            name: cleanName.isEmpty ? defaultName(referenceId: referenceId) : cleanName,
            createdAt: Date(),
            referenceId: referenceId,
            composition: BettaCompositionStore.shared.adjustment(for: referenceId),
            advanced: BettaAdvancedTuningStore.shared.adjustment(for: referenceId),
            randomStyle: BettaRandomStyleStore.shared.style(for: referenceId),
            isFavorite: favorite
        )
        lock.lock()
        values.append(snapshot)
        let saved = persistLocked()
        lock.unlock()
        return saved ? snapshot : nil
    }

    @discardableResult
    func toggleFavoriteCurrent(referenceId: Int) -> BettaSavedPreset? {
        guard (1...8).contains(referenceId) else { return nil }
        let composition = BettaCompositionStore.shared.adjustment(for: referenceId)
        let advanced = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        let style = BettaRandomStyleStore.shared.style(for: referenceId)

        lock.lock()
        if let index = values.firstIndex(where: {
            $0.referenceId == referenceId &&
            $0.composition == composition &&
            $0.advanced == advanced &&
            $0.randomStyle == style
        }) {
            values[index].isFavorite.toggle()
            values[index].createdAt = Date()
            let result = values[index]
            _ = persistLocked()
            lock.unlock()
            return result
        }
        lock.unlock()
        return saveCurrent(referenceId: referenceId, name: defaultName(referenceId: referenceId), favorite: true)
    }

    func currentMatch(referenceId: Int) -> BettaSavedPreset? {
        let composition = BettaCompositionStore.shared.adjustment(for: referenceId)
        let advanced = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        let style = BettaRandomStyleStore.shared.style(for: referenceId)
        lock.lock(); defer { lock.unlock() }
        return values.first(where: {
            $0.referenceId == referenceId &&
            $0.composition == composition &&
            $0.advanced == advanced &&
            $0.randomStyle == style
        })
    }

    @discardableResult
    func apply(_ preset: BettaSavedPreset) -> Bool {
        guard (1...8).contains(preset.referenceId) else { return false }
        BettaCompositionStore.shared.update(referenceId: preset.referenceId, adjustment: preset.composition)
        BettaAdvancedTuningStore.shared.update(referenceId: preset.referenceId, adjustment: preset.advanced)
        if let style = preset.randomStyle {
            BettaRandomStyleStore.shared.update(referenceId: preset.referenceId, style: style)
        } else {
            BettaRandomStyleStore.shared.clear(referenceId: preset.referenceId)
        }
        return true
    }

    @discardableResult
    func delete(id: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard let index = values.firstIndex(where: { $0.id == id }) else { return false }
        values.remove(at: index)
        return persistLocked()
    }

    private func defaultName(referenceId: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d · HH:mm"
        return "Betta #\(referenceId) · \(formatter.string(from: Date()))"
    }

    private func persistLocked() -> Bool {
        guard let data = try? JSONEncoder().encode(values) else { return false }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
        return UserDefaults.standard.synchronize()
    }
}
