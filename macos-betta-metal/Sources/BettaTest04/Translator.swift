import Foundation

/// One turn: what was asked, what changed, and what the translator says it did.
struct Turn {
    let prompt: String
    /// Field name to value, in the same vocabulary a patch file uses.
    let patch: [String: Double]
    /// One sentence, in the translator's own words.
    let note: String
    /// Words the translator could not turn into numbers. Reported, never guessed.
    let unread: [String]
    /// "local" now, "studio" when the model answers.
    let source: String
}

enum TranslationError: LocalizedError {
    case nothingUnderstood(String)

    var errorDescription: String? {
        switch self {
        case .nothingUnderstood(let text): return text
        }
    }
}

/// Words in, numbers out. The room talks to this and nothing else, so the
/// model can replace the local parser without the room noticing.
protocol Translator {
    var name: String { get }
    func translate(prompt: String, style: GeneratedStyle) throws -> Turn
}

/// The translator that needs no key, no network and no model.
///
/// It does two things, both mechanical. It reads a field by name -
/// `opacity .42`, `motionSpeed = 0.14` - which is unambiguous and is how the
/// studio's own patches are written. And it reads a small table of relative
/// adjustments, each of which is the *obvious* dial for the word rather than
/// a judgement about it: "slower" moves `motionSpeed` down, and that is all it
/// claims. Anything outside the table is reported back unread.
///
/// It is not a small model and does not pretend to be one. It exists so the
/// room can be built and used before a single token is spent, and so it still
/// works when the network does not.
struct LocalTranslator: Translator {
    let name = "local"

    /// Each phrase, the fields it moves, and how. A multiplier scales what is
    /// there; an offset adds; a target sets. Every entry is one line of taste
    /// at most, and all of them are here rather than scattered through the UI.
    private struct Move {
        let fields: [String]
        let factor: Double?
        let offset: Double?
        let says: String
    }

    private static let table: [String: Move] = [
        "more translucent": Move(fields: ["opacity"], factor: 0.75, offset: nil, says: "thinner material"),
        "less translucent": Move(fields: ["opacity"], factor: 1.3, offset: nil, says: "denser material"),
        "more transparent": Move(fields: ["opacity"], factor: 0.75, offset: nil, says: "thinner material"),
        "more solid": Move(fields: ["opacity"], factor: 1.3, offset: nil, says: "denser material"),
        "slower": Move(fields: ["motionSpeed"], factor: 0.6, offset: nil, says: "slower"),
        "faster": Move(fields: ["motionSpeed"], factor: 1.6, offset: nil, says: "faster"),
        "calmer": Move(fields: ["turbulence", "motionAmplitude"], factor: 0.7, offset: nil, says: "calmer"),
        "wilder": Move(fields: ["turbulence", "motionAmplitude"], factor: 1.4, offset: nil, says: "wilder"),
        "paler": Move(fields: ["saturation"], factor: 0.75, offset: nil, says: "paler"),
        "richer": Move(fields: ["saturation"], factor: 1.25, offset: nil, says: "richer"),
        "brighter": Move(fields: ["brightness"], factor: 1.15, offset: nil, says: "brighter"),
        "darker": Move(fields: ["brightness"], factor: 0.87, offset: nil, says: "darker"),
        "bigger": Move(fields: ["presenceScale"], factor: 1.25, offset: nil, says: "larger in frame"),
        "smaller": Move(fields: ["presenceScale"], factor: 0.8, offset: nil, says: "smaller in frame"),
        "wider": Move(fields: ["spread"], factor: 1.2, offset: nil, says: "wider"),
        "narrower": Move(fields: ["spread"], factor: 0.83, offset: nil, says: "narrower"),
        "more folds": Move(fields: ["foldDensity"], factor: 1.3, offset: nil, says: "more folds"),
        "fewer folds": Move(fields: ["foldDensity"], factor: 0.75, offset: nil, says: "fewer folds"),
        "smoother": Move(fields: ["membraneGrain", "veinStrength", "edgeRuffle"], factor: 0.6, offset: nil, says: "smoother"),
        "rougher": Move(fields: ["membraneGrain", "veinStrength", "edgeRuffle"], factor: 1.4, offset: nil, says: "rougher"),
        "shinier": Move(fields: ["rimStrength", "foldHighlight"], factor: 1.25, offset: nil, says: "more sheen"),
        "matter": Move(fields: ["rimStrength", "foldHighlight"], factor: 0.8, offset: nil, says: "less sheen"),
        "more rainbow": Move(fields: ["iridescence"], factor: 1.0, offset: 0.25, says: "more iridescence"),
        "less rainbow": Move(fields: ["iridescence"], factor: 1.0, offset: -0.25, says: "less iridescence"),
        "warmer": Move(fields: ["baseHueDeg", "accentHueDeg"], factor: 1.0, offset: -12, says: "hues warmed"),
        "cooler": Move(fields: ["baseHueDeg", "accentHueDeg"], factor: 1.0, offset: 12, says: "hues cooled"),
    ]

    /// Field names, longest first, so `groundSaturation` is not read as
    /// `saturation` with a stray prefix.
    private static let fieldNames: [String] = Studio.fields.keys.sorted { $0.count > $1.count }

    func translate(prompt: String, style: GeneratedStyle) throws -> Turn {
        let text = prompt.lowercased()
        var patch: [String: Double] = [:]
        var said: [String] = []
        var consumed = text

        // Direct assignments first: they are exact, and a phrase that also
        // matches the table should not overwrite a number the owner typed.
        for field in Self.fieldNames {
            // A designer writes .42 as often as 0.42, so the number may lead
            // with its point.
            let number = "-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)"
            let pattern = "\(field.lowercased())\\s*(?:=|:|to)?\\s*\(number)"
            guard let match = consumed.range(of: pattern, options: [.regularExpression]) else { continue }
            let fragment = String(consumed[match])
            guard let numberRange = fragment.range(of: number, options: [.regularExpression, .backwards]),
                  let value = Double(fragment[numberRange]) else { continue }
            patch[field] = value
            said.append("\(field) \(trim(value))")
            consumed = consumed.replacingCharacters(in: match, with: " ")
        }

        // Then the table, longest phrase first so "more translucent" wins
        // over a bare "more".
        for phrase in Self.table.keys.sorted(by: { $0.count > $1.count }) {
            guard consumed.contains(phrase), let move = Self.table[phrase] else { continue }
            for field in move.fields {
                guard let path = Studio.fields[field] else { continue }
                let current = patch[field] ?? style[keyPath: path]
                var next = current * (move.factor ?? 1)
                if let offset = move.offset { next += offset }
                if field.hasSuffix("HueDeg") { next = (next + 360).truncatingRemainder(dividingBy: 360) }
                patch[field] = next
            }
            said.append(move.says)
            consumed = consumed.replacingOccurrences(of: phrase, with: " ")
        }

        // What is left over, minus the words that are only glue.
        let glue: Set<String> = ["a", "an", "and", "the", "it", "make", "please", "bit", "little",
                                 "more", "less", "much", "very", "to", "of", "is", "be", "but", "with"]
        let unread = consumed
            .split(whereSeparator: { !$0.isLetter })
            .map(String.init)
            .filter { !glue.contains($0) && $0.count > 2 }

        guard !patch.isEmpty else {
            throw TranslationError.nothingUnderstood(
                unread.isEmpty
                    ? "Nothing to change there."
                    : "I don't know \(unread.map { "“\($0)”" }.joined(separator: ", ")) as numbers. Name a field — opacity .4 — or wait for the model."
            )
        }
        return Turn(prompt: prompt, patch: patch, note: said.joined(separator: ", "),
                    unread: unread, source: name)
    }

    private func trim(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%g", value)
    }
}
