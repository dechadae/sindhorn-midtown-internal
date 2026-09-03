import AppKit

/// Small product-layer bridge that keeps Display Art discoverable outside the
/// Gallery without coupling the interaction renderer back into AppDelegate.
/// It replaces the older user-facing Ambient Screen menu item while preserving
/// that legacy controller internally as a fallback implementation detail.
@MainActor
final class BettaDisplayArtMenuController {
    static let shared = BettaDisplayArtMenuController()

    private var launchObserver: NSObjectProtocol?
    private var stateObserver: NSObjectProtocol?
    private weak var displayItem: NSMenuItem?

    private init() {}

    func start() {
        guard launchObserver == nil else { return }
        stateObserver = NotificationCenter.default.addObserver(
            forName: .bettaDisplayArtStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.syncTitle() }
        }
        launchObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didFinishLaunchingNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                // Run after the release shell has injected its legacy menus.
                DispatchQueue.main.async { [weak self] in self?.install() }
            }
        }
    }

    private func install() {
        guard let viewMenu = NSApp.mainMenu?.items.first(where: { $0.submenu?.title == "View" })?.submenu else { return }

        // Remove only the old presentation affordance; the fallback class stays
        // compiled and available to older code paths.
        for item in viewMenu.items where item.title == "Enter Ambient Screen" {
            viewMenu.removeItem(item)
        }

        if let existing = viewMenu.items.first(where: { $0.action == #selector(toggleDisplayArt(_:)) }) {
            displayItem = existing
            syncTitle()
            return
        }

        if viewMenu.items.last?.isSeparatorItem == false { viewMenu.addItem(.separator()) }
        let item = NSMenuItem(title: "Display Art", action: #selector(toggleDisplayArt(_:)), keyEquivalent: "a")
        item.target = self
        item.toolTip = "Present the current living Betta full-screen. Move the pointer like a hand under water; press Esc to exit."
        viewMenu.addItem(item)
        displayItem = item
        syncTitle()
    }

    @objc private func toggleDisplayArt(_ sender: Any?) {
        BettaDisplayArtController.shared.toggle(on: NSApp.keyWindow?.screen)
        syncTitle()
    }

    private func syncTitle() {
        displayItem?.title = BettaDisplayArtController.shared.isActive ? "Stop Display Art" : "Display Art"
    }
}
