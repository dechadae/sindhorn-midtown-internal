import Foundation

/// Compositions the owner wants to keep, as candidates for later.
///
/// Deliberately a separate file from `locked-compositions.json`. Those eight
/// are locked and this target only ever reads them; nothing here writes to
/// that file or to the BettaMetalLab UserDefaults it came from. Promoting a
/// kept composition into the locked set is the owner's decision, made in the
/// composition editor, not something a test writes behind him.
struct KeptComposition: Codable {
    let name: String
    let seed: String
    let arm: String
    let framing: String
    let keptOn: String
    let note: String?
    let composition: Composition
}

struct KeptCompositions: Codable {
    var note: String
    var kept: [KeptComposition]

    /// Beside the judging logs rather than in the bundle: this is working
    /// material the owner edits and reads, not a resource the target loads.
    static var url: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()      // BettaTest04
            .deletingLastPathComponent()      // Sources
            .deletingLastPathComponent()      // macos-betta-metal
            .appendingPathComponent("kept-compositions.json")
    }

    static func load() -> KeptCompositions {
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(KeptCompositions.self, from: data) else {
            return KeptCompositions(
                note: "Candidate compositions kept during judging. NOT the locked eight - "
                    + "these are proposals. Each reproduces exactly from its seed via "
                    + "`--recall <arm> <seed>`.",
                kept: []
            )
        }
        return decoded
    }

    /// Appends, or replaces the entry with the same seed so re-keeping a frame
    /// updates its name rather than accumulating duplicates.
    mutating func add(_ entry: KeptComposition) {
        kept.removeAll { $0.seed == entry.seed }
        kept.append(entry)
    }

    func save() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(self).write(to: Self.url)
    }
}

/// Rebuilds one judged frame from the three things a CSV row records.
enum Recall {
    struct Resolved {
        let constitution: Constitution
        let style: GeneratedStyle
        let composition: Composition
        let framingNote: String
    }

    static func resolve(arm: String, seed: UInt64, compositionId: Int?) throws -> Resolved {
        let lowered = arm.lowercased()
        let letter = lowered.hasPrefix("b") ? "b" : lowered.hasPrefix("a") ? "a" : "c"
        let constitution = try Constitution.loadArm(letter)

        if let id = compositionId, let locked = try LockedCompositions.load()[id] {
            return Resolved(
                constitution: constitution,
                style: SeedSampler.generate(seed: seed, constitution: constitution),
                composition: locked,
                framingNote: "locked composition \(id)"
            )
        }
        return Resolved(
            constitution: constitution,
            style: SeedSampler.generate(seed: seed, constitution: constitution),
            composition: .randomised(seed: seed),
            framingNote: "randomised from the seed"
        )
    }

    /// Pinned to the Gregorian calendar and a fixed locale. On a machine set to
    /// Thai this otherwise formats as the Buddhist year - 2569 for 2026 - which
    /// would date every kept composition 543 years into the future and sort
    /// them against the evidence files incorrectly.
    static var today: String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}
