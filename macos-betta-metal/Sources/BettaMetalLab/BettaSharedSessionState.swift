import AppKit
import MetalKit

enum BettaSharedPresentationMode: Equatable {
    case live
    case manual(Int)
    case preview
}

/// Process-wide presentation intent shared by mirrored desktop and Ambient
/// Screen surfaces. The primary renderer remains authoritative; this object
/// observes it rather than creating a second source of truth.
@MainActor
final class BettaSharedSessionState {
    static let shared = BettaSharedSessionState()

    private var mode: BettaSharedPresentationMode = .live
    private var revision: UInt64 = 0

    private init() {}

    var snapshot: (mode: BettaSharedPresentationMode, revision: UInt64) {
        if let inferred = inferPrimaryMode(), inferred != mode {
            mode = inferred
            revision &+= 1
        }
        return (mode, revision)
    }

    private func inferPrimaryMode() -> BettaSharedPresentationMode? {
        guard let primary = NSApp.windows.compactMap({ $0 as? BettaDesktopWindow }).first,
              let root = primary.contentView,
              let renderer = findRenderer(in: root) else { return nil }

        let status = renderer.statusText
        if status.hasPrefix("Live Bangkok") { return .live }
        if status.hasPrefix("3-minute preview") { return .preview }

        if let editor = findEditor(in: root) {
            return .manual(min(7, max(0, editor.selectedFishIndex)))
        }

        if let fishRange = status.range(of: "Fish #"),
           let first = status[fishRange.upperBound...].first,
           let value = Int(String(first)), (1...8).contains(value) {
            return .manual(value - 1)
        }
        return mode
    }

    private func findRenderer(in view: NSView) -> BettaRenderer? {
        if let metal = view as? MTKView, let renderer = metal.delegate as? BettaRenderer {
            return renderer
        }
        for child in view.subviews {
            if let renderer = findRenderer(in: child) { return renderer }
        }
        return nil
    }

    private func findEditor(in view: NSView) -> BettaCompositionEditorPanel? {
        if let editor = view as? BettaCompositionEditorPanel { return editor }
        for child in view.subviews {
            if let editor = findEditor(in: child) { return editor }
        }
        return nil
    }
}
