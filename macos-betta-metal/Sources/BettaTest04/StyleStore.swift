import Foundation

/// Styles the studio made, kept so they can be used.
///
/// Everything else in this app names a picture with a seed and a crop, and
/// rebuilds it by sampling the constitution. That works because a seed is the
/// whole story. A studio style is not: it is a seed *plus* a patch, and the
/// patch is where the intent lives. Without somewhere to put it, a studio
/// style can be looked at once and never again - not the desktop, not live,
/// not the archive.
///
/// A record holds the **resolved** numbers, not just the patch. Replaying a
/// patch over a seed depends on the constitution that drew the seed, so an
/// edit to a constitution months from now would silently repaint a picture
/// the owner had already kept. The patch and the prompt are kept beside the
/// numbers as provenance - how it came to be - never as the source of truth.
///
///   Betta Explorer/styles/<id>.json
///
/// The id is a hash of the resolved numbers, so the same picture always
/// answers to the same name, whichever device made it.
struct StyleRecord: Codable, Equatable {
    let id: String
    /// The words that asked for it, or the patch file's name.
    let prompt: String
    /// The seed the patch was laid over, for provenance.
    let seed: String
    /// The constitution version that drew the base style.
    let constitution: Int
    let createdAt: String
    /// The patch as it was written, so the reasoning survives with the style.
    let patch: String
    let style: GeneratedStyle

    var frame: FrameRef { FrameRef(seed: seed, composition: "8", style: id) }
}

enum StyleStore {
    private static let directory = "styles"

    /// A stable name for a set of numbers: FNV-1a over the values in a fixed
    /// order. Not a security hash - a short, deterministic label that two
    /// machines agree on without talking to each other.
    static func identify(_ style: GeneratedStyle) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        func mix(_ text: String) {
            for byte in text.utf8 {
                hash ^= UInt64(byte)
                hash = hash &* 0x0000_0100_0000_01b3
            }
        }
        for (name, value) in Studio.values(of: style) {
            // Rounded, so a value that survives a round trip through JSON at
            // the seventh decimal still lands on the same id.
            mix("\(name)=\(String(format: "%.6f", value));")
        }
        for part in style.parts {
            mix("\(part.primitive.rawValue):\(String(format: "%.4f,%.4f,%.4f,%.4f,%.4f", part.scale, part.orbitRadius, part.orbitAngleDeg, part.tiltDeg, part.phaseOffset));")
        }
        return String(format: "%012llx", hash & 0xffff_ffff_ffff)
    }

    static func url(for id: String) -> URL {
        ExplorerStorage.root
            .appendingPathComponent(directory, isDirectory: true)
            .appendingPathComponent("\(id).json")
    }

    @discardableResult
    static func save(style: GeneratedStyle, seed: String, prompt: String,
                     constitution: Int, patch: String) -> StyleRecord {
        let record = StyleRecord(
            id: identify(style), prompt: prompt, seed: seed,
            constitution: constitution, createdAt: ExplorerStorage.now(),
            patch: patch, style: style
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(record) {
            try? data.write(to: url(for: record.id), options: .atomic)
        }
        return record
    }

    static func load(id: String) -> StyleRecord? {
        guard let data = try? Data(contentsOf: url(for: id)) else { return nil }
        return try? JSONDecoder().decode(StyleRecord.self, from: data)
    }

    /// Every kept style, newest first.
    static func all() -> [StyleRecord] {
        let dir = ExplorerStorage.root.appendingPathComponent(directory, isDirectory: true)
        let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
        return names
            .filter { $0.hasSuffix(".json") }
            .compactMap { load(id: String($0.dropLast(5))) }
            .sorted { $0.createdAt > $1.createdAt }
    }

    /// True when the text is a style id this store holds - the studio's ids
    /// are hex, a seed is decimal, so one field can take either.
    static func exists(_ id: String) -> Bool {
        FileManager.default.fileExists(atPath: url(for: id).path)
    }

    // MARK: - The server copy

    /// Sends a style to `betta_styles`, where the phone can reach it.
    ///
    /// The id is a hash of the numbers, so sending the same style twice is the
    /// same row twice: the request asks the server to ignore the duplicate
    /// rather than treating it as a failure. A style that does not arrive is
    /// not lost - the file on disk is the record, and this is the copy.
    static func upload(_ record: StyleRecord, completion: ((Bool) -> Void)? = nil) {
        guard let url = URL(string: "\(VerdictStore.urlBase)/rest/v1/betta_styles"),
              let numbers = try? JSONSerialization.data(
                  withJSONObject: Dictionary(uniqueKeysWithValues: Studio.values(of: record.style)),
                  options: [.sortedKeys]),
              let styleJSON = try? JSONSerialization.jsonObject(with: numbers)
        else { completion?(false); return }

        let payload: [String: Any] = [
            "id": record.id,
            "prompt": record.prompt,
            "seed": record.seed,
            "constitution": "v\(record.constitution)",
            "device": VerdictStore.device,
            "patch": record.patch,
            "style": styleJSON,
        ]
        guard let body = try? JSONSerialization.data(withJSONObject: [payload]) else {
            completion?(false); return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(VerdictStore.key, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(VerdictStore.key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal,resolution=ignore-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = body
        // The completion arrives on the session's thread, not the main one: a
        // command-line caller blocks main while it waits, and hopping to main
        // here would deadlock against that. A caller touching the UI hops for
        // itself.
        URLSession.shared.dataTask(with: request) { _, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            completion?((200..<300).contains(status))
        }.resume()
    }
}
