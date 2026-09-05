import AppKit
import CoreGraphics

final class BettaDesktopWindow: NSWindow {
    private(set) var desktopMode = false
    private var savedLabFrame: NSRect?

    override var canBecomeKey: Bool { !desktopMode }
    override var canBecomeMain: Bool { !desktopMode }

    func setDesktopMode(_ enabled: Bool) {
        guard enabled != desktopMode else { return }
        desktopMode = enabled
        if enabled {
            savedLabFrame = frame
            styleMask = [.borderless]
            titleVisibility = .hidden
            titlebarAppearsTransparent = true
            isMovable = false
            hasShadow = false
            ignoresMouseEvents = true
            isOpaque = true
            backgroundColor = .black
            collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

            let desktop = CGWindowLevelForKey(.desktopWindow)
            let icons = CGWindowLevelForKey(.desktopIconWindow)
            let desired = min(desktop + 1, icons - 1)
            level = NSWindow.Level(rawValue: Int(desired))

            if let screen = screen ?? NSScreen.main {
                setFrame(screen.frame, display: true)
            }
            orderFrontRegardless()
        } else {
            styleMask = [.titled, .closable, .miniaturizable, .resizable]
            titleVisibility = .visible
            titlebarAppearsTransparent = false
            isMovable = true
            hasShadow = true
            ignoresMouseEvents = false
            collectionBehavior = [.managed]
            level = .normal
            if let savedLabFrame {
                setFrame(savedLabFrame, display: true)
            } else if let screen = NSScreen.main {
                setFrame(screen.visibleFrame.insetBy(dx: screen.visibleFrame.width * 0.08, dy: screen.visibleFrame.height * 0.08), display: true)
            }
            makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
