import AppKit
import Foundation

/// Wallpapers you've used.
///
/// The phone's archive (WallpaperArchive.kt) records a seed the moment it
/// becomes the wallpaper - a still when the system accepts the bitmap, a live
/// one when a real engine shows it - and keeps one entry per seed, newest
/// first, up to 300. The Mac keeps the same shape in a JSON file, so the same
/// seed can be set again on either device from the same record.
struct ArchiveEntry: Codable, Equatable {
    let seed: String
    let composition: String
    var kind: String
    var at: String
    /// The studio style this entry is, when it is one. Optional so entries
    /// written before styles existed still decode.
    var style: String?

    var frame: FrameRef { FrameRef(seed: seed, composition: composition, style: style) }

    /// What tells one entry from another: two studio styles can share a seed.
    var identity: String { style ?? seed }
}

final class WallpaperArchive {
    static let cap = 300
    private let file = "archive.json"
    private(set) var entries: [ArchiveEntry]

    init() {
        entries = ExplorerStorage.readJSON(file, as: [ArchiveEntry].self) ?? []
    }

    var latest: ArchiveEntry? { entries.first }

    func isLatest(_ frame: FrameRef) -> Bool {
        latest?.identity == frame.identity
    }

    /// Moves the seed to the top, or adds it. Re-using an old wallpaper is a
    /// new use, so it comes back to the front with a fresh date.
    func record(_ frame: FrameRef, kind: String) {
        entries.removeAll { $0.identity == frame.identity }
        entries.insert(
            ArchiveEntry(seed: frame.seed, composition: frame.composition, kind: kind,
                         at: ExplorerStorage.now(), style: frame.style),
            at: 0
        )
        if entries.count > Self.cap { entries = Array(entries.prefix(Self.cap)) }
        ExplorerStorage.writeJSON(entries, to: file)
    }

    func remove(seed: String) {
        entries.removeAll { $0.identity == seed }
        ExplorerStorage.writeJSON(entries, to: file)
    }

    /// "live now", "8 Sep · live", "8 Sep · still" - the phone's captions.
    func caption(for entry: ArchiveEntry, liveSeed: String?) -> String {
        if entry.kind == "live", entry.identity == liveSeed { return "live now" }
        let day: String
        if let date = ExplorerStorage.date(entry.at) {
            let f = DateFormatter()
            f.calendar = Calendar(identifier: .gregorian)
            f.locale = Locale(identifier: "en_US_POSIX")
            f.dateFormat = "d MMM"
            day = f.string(from: date)
        } else {
            day = "—"
        }
        return "\(day) · \(entry.kind)"
    }
}

/// Renders frames to files: the still that becomes a desktop picture, the
/// stills saved by hand, and the archive's thumbnails.
///
/// Both renderers are made on first use. The high-detail one is the judge's
/// still renderer (rays 640, segments 576, MSAA 4); the thumbnail one is the
/// preview's geometry without multisampling, because 240 pixels cannot show
/// the difference and the archive may have to draw a few hundred of them.
final class FrameFiles {
    private let locked: [Int: Composition]
    private lazy var fine: EngineRenderer? = try? EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
    private lazy var coarse: EngineRenderer? = try? EngineRenderer(rays: 320, segments: 288, sampleCount: 1)
    private var thumbCache: [String: NSImage] = [:]

    init(locked: [Int: Composition]) {
        self.locked = locked
    }

    /// The pixel size the still is rendered at: the largest of the screens it
    /// is going to cover, in device pixels, so no screen upsamples it.
    static func pixelSize(covering screens: [NSScreen]) -> (Int, Int) {
        var w = 0, h = 0
        for s in screens {
            let scale = s.backingScaleFactor
            w = max(w, Int((s.frame.width * scale).rounded()))
            h = max(h, Int((s.frame.height * scale).rounded()))
        }
        return (max(w, 1440), max(h, 810))
    }

    /// Renders the frame to `dir/<stem>.png` at the given size, returning the
    /// file. A file already there for the same frame and size is reused.
    @discardableResult
    func writeStill(_ frame: FrameRef, style: GeneratedStyle, phase: Double,
                    width: Int, height: Int, into dir: String, suffix: String = "") throws -> URL {
        let url = ExplorerStorage.root
            .appendingPathComponent(dir, isDirectory: true)
            .appendingPathComponent("\(frame.fileStem)\(suffix).png")
        guard let fine else { throw RendererError.pipelineFailed("still renderer") }
        let rendered = try fine.render(
            style: style,
            surface: Surface(name: dir, width: width, height: height),
            phase: phase,
            composition: frame.resolveComposition(locked: locked)
        )
        try writePNG(rendered, to: url)
        return url
    }

    /// The archive thumbnail, 240 wide at the aspect given, rendered once from
    /// the seed and kept as a file - the phone keeps the same in localStorage.
    func thumbnail(_ frame: FrameRef, style: GeneratedStyle, aspect: Double) -> NSImage? {
        if let cached = thumbCache[frame.fileStem] { return cached }
        let url = ExplorerStorage.root
            .appendingPathComponent("thumbs", isDirectory: true)
            .appendingPathComponent("\(frame.fileStem).png")
        if let image = NSImage(contentsOf: url) {
            thumbCache[frame.fileStem] = image
            return image
        }
        guard let coarse else { return nil }
        let width = 240
        let height = max(1, Int((Double(width) / aspect).rounded()))
        guard let rendered = try? coarse.render(
            style: style,
            surface: Surface(name: "thumb", width: width, height: height),
            phase: EngineRenderer.phase(for: style, atSeconds: 4),
            composition: frame.resolveComposition(locked: locked)
        ) else { return nil }
        try? writePNG(rendered, to: url)
        let image = NSImage(contentsOf: url)
        if let image { thumbCache[frame.fileStem] = image }
        return image
    }
}

/// The desktop picture: a still of the frame, rendered for the screens it
/// covers and handed to the system. On the phone this was `setBitmap`; here
/// it is `NSWorkspace.setDesktopImageURL`, per screen, so "this display" and
/// "all displays" are the same call over a different list.
enum DesktopPicture {
    static func set(_ frame: FrameRef, style: GeneratedStyle, phase: Double,
                    files: FrameFiles, screens: [NSScreen]) throws -> URL {
        let (w, h) = FrameFiles.pixelSize(covering: screens)
        let url = try files.writeStill(frame, style: style, phase: phase,
                                       width: w, height: h, into: "wallpapers")
        for screen in screens {
            try NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [:])
        }
        return url
    }
}
