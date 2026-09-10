import Foundation

/// Where the explorer keeps what it must not lose.
///
/// Everything lives under Application Support rather than beside the source:
/// the judge wrote its CSV into the working directory because the CSV was the
/// experiment, and the experiment's rows are frozen states now. The explorer
/// is a product that happens to record, so its files go where a product's go.
///
///   Betta Explorer/
///     judgements.csv   every verdict, arm,seed,composition,verdict,at
///     queue.json       verdicts the server has not yet taken
///     session-id       one id per install, so a sitting can be told from the next
///     live.json        the seed the desktop is showing, and whether it is on
///     archive.json     every seed that has been the wallpaper, newest first
///     wallpapers/      the still set as a desktop picture, one PNG per seed
///     stills/          frames saved by hand at 5120x2880
///     thumbs/          the archive's thumbnails, rendered once from the seed
enum ExplorerStorage {
    static let root: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let url = base.appendingPathComponent("Betta Explorer", isDirectory: true)
        for sub in ["", "wallpapers", "stills", "thumbs", "styles"] {
            try? FileManager.default.createDirectory(
                at: url.appendingPathComponent(sub, isDirectory: true),
                withIntermediateDirectories: true
            )
        }
        return url
    }()

    static func file(_ name: String) -> URL { root.appendingPathComponent(name) }

    static func readJSON<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let data = try? Data(contentsOf: file(name)) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func writeJSON<T: Encodable>(_ value: T, to name: String) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: file(name), options: .atomic)
    }

    /// UTC, to the second, the way the phone's archive and rows are stamped -
    /// and Gregorian: a machine set to Thai would otherwise date everything
    /// 543 years ahead (see `Recall.today`).
    static func now() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        return f.string(from: Date())
    }

    static func date(_ stamp: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        return f.date(from: stamp)
    }
}

/// A frame is a seed and a framing; the seed rebuilds the organism and the
/// framing label rebuilds the crop - one of the owner's eight by id, or "r"
/// for the crop derived from the seed. This is the whole hand-off between the
/// explorer, the live desktop, the archive and a row on the server.
struct FrameRef: Codable, Equatable {
    let seed: String
    let composition: String
    /// A studio style's id, when this frame is one. Nil for a frame the
    /// constitution drew, which is every frame the explorer produces. The
    /// property is optional so every `live.json` and `archive.json` written
    /// before styles existed still decodes.
    let style: String?

    init(seed: String, composition: String, style: String? = nil) {
        self.seed = seed
        self.composition = composition
        self.style = style
    }

    var seedValue: UInt64? { UInt64(seed) }

    /// The organism itself: a kept style if this frame names one, otherwise
    /// the seed sampled from the constitution. A named style whose file has
    /// gone falls back to the seed rather than showing nothing.
    func resolveStyle(constitution: Constitution) -> GeneratedStyle {
        if let style, let record = StyleStore.load(id: style) { return record.style }
        return SeedSampler.generate(seed: seedValue ?? 0, constitution: constitution)
    }

    /// Resolves the crop. Locked ids read the owner's eight, never written.
    func resolveComposition(locked: [Int: Composition]) -> Composition {
        if let id = Int(composition), let c = locked[id] { return c }
        return .randomised(seed: seedValue ?? 0)
    }

    var fileStem: String {
        if let style { return "betta-style-\(style)-comp-\(composition)" }
        return "betta-\(seed)-comp-\(composition)"
    }

    /// What names this frame for a person: a style id when it has one, since
    /// two studio styles can share a seed and would otherwise collide.
    var identity: String { style ?? seed }
}
