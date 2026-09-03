import AppKit
import MetalKit
import simd

extension Notification.Name {
    static let bettaDisplayArtStateDidChange = Notification.Name("BETTA.DisplayArt.StateDidChange")
}

@MainActor
private final class BettaDisplayArtWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

/// One-click digital-art presentation. It deliberately reuses the exact BETTA
/// renderer and current process-wide presentation state instead of exporting a
/// movie or bitmap. The system pointer is replaced temporarily by a procedural
/// water-touch cursor, and mouse motion drives a transient wave field sampled by
/// the Metal membrane shader.
@MainActor
final class BettaDisplayArtController {
    static let shared = BettaDisplayArtController()

    private struct Surface {
        let screen: NSScreen
        let window: BettaDisplayArtWindow
        let view: MTKView
        let renderer: BettaRenderer
        let cursor: BettaWaterCursorView
    }

    private var surface: Surface?
    private var eventMonitor: Any?
    private var screenObserver: NSObjectProtocol?
    private var lastNDC: SIMD2<Float>?
    private var lastEventTime: TimeInterval?
    private var cursorHidden = false
    private(set) var isActive = false

    private init() {}

    func toggle(on screen: NSScreen? = nil) {
        isActive ? stop() : start(on: screen)
    }

    func start(on requestedScreen: NSScreen? = nil) {
        guard !isActive else { return }
        guard let screen = requestedScreen ?? NSApp.keyWindow?.screen ?? NSScreen.main ?? NSScreen.screens.first else { return }

        // Ambient Screen is the older passive presentation mode. Display Art is
        // interactive and owns the presentation while it is active.
        BettaAmbientScreenController.shared.stop()

        let window = BettaDisplayArtWindow(
            contentRect: screen.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false,
            screen: screen
        )
        window.isReleasedWhenClosed = false
        window.isOpaque = true
        window.backgroundColor = .black
        window.hasShadow = false
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        window.level = .screenSaver
        window.acceptsMouseMovedEvents = true
        window.ignoresMouseEvents = false

        let root = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
        root.autoresizingMask = [.width, .height]
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor

        let view = MTKView(frame: root.bounds)
        view.autoresizingMask = [.width, .height]
        root.addSubview(view)

        let cursor = BettaWaterCursorView(frame: NSRect(x: -100, y: -100, width: 28, height: 28))
        cursor.autoresizingMask = []
        cursor.alphaValue = 0
        root.addSubview(cursor, positioned: .above, relativeTo: view)
        window.contentView = root

        guard let renderer = try? BettaRenderer(view: view) else {
            window.close()
            return
        }
        apply(BettaSharedSessionState.shared.snapshot.mode, to: renderer)

        surface = Surface(screen: screen, window: window, view: view, renderer: renderer, cursor: cursor)
        isActive = true
        lastNDC = nil
        lastEventTime = nil
        BettaWaterInteractionStore.shared.begin()

        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        hideSystemCursor()
        installEventMonitor()
        installScreenObserver()

        // Seed the custom pointer at the current physical mouse location without
        // creating a strong disturbance until the user actually moves.
        updatePointer(globalPoint: NSEvent.mouseLocation, impulse: 0, allowStationaryPressure: false)
        NotificationCenter.default.post(name: .bettaDisplayArtStateDidChange, object: self)
    }

    func stop() {
        guard isActive else { return }
        isActive = false
        BettaWaterInteractionStore.shared.end()

        if let eventMonitor { NSEvent.removeMonitor(eventMonitor) }
        eventMonitor = nil
        if let screenObserver { NotificationCenter.default.removeObserver(screenObserver) }
        screenObserver = nil

        if cursorHidden {
            NSCursor.unhide()
            cursorHidden = false
        }

        surface?.view.isPaused = true
        surface?.window.orderOut(nil)
        surface?.window.close()
        surface = nil
        lastNDC = nil
        lastEventTime = nil
        NotificationCenter.default.post(name: .bettaDisplayArtStateDidChange, object: self)
    }

    private func installEventMonitor() {
        eventMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .leftMouseDown, .rightMouseDown, .otherMouseDown, .keyDown]
        ) { [weak self] event in
            guard let self else { return event }
            if event.type == .keyDown {
                if event.keyCode == 53 { // Escape
                    Task { @MainActor in self.stop() }
                    return nil
                }
                return event
            }

            let isPress = event.type == .leftMouseDown || event.type == .rightMouseDown || event.type == .otherMouseDown
            Task { @MainActor in
                self.updatePointer(globalPoint: NSEvent.mouseLocation, impulse: isPress ? 1.0 : 0.0, allowStationaryPressure: isPress)
            }
            return isPress ? nil : event
        }
    }

    private func installScreenObserver() {
        screenObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, let current = self.surface?.screen else { return }
                let stillConnected = NSScreen.screens.contains { $0 === current || $0.frame == current.frame }
                if !stillConnected { self.stop() }
            }
        }
    }

    private func updatePointer(globalPoint: NSPoint, impulse: Float, allowStationaryPressure: Bool) {
        guard let surface else { return }
        let frame = surface.screen.frame
        guard frame.width > 0, frame.height > 0, frame.contains(globalPoint) else {
            surface.cursor.alphaValue = 0
            return
        }

        let x = Float((globalPoint.x - frame.minX) / frame.width)
        let y = Float((globalPoint.y - frame.minY) / frame.height)
        let ndc = SIMD2<Float>(x * 2 - 1, y * 2 - 1)
        let now = ProcessInfo.processInfo.systemUptime

        var velocity = SIMD2<Float>.zero
        if let previous = lastNDC, let previousTime = lastEventTime {
            let dt = Float(max(1.0 / 240.0, min(0.12, now - previousTime)))
            velocity = (ndc - previous) / dt
        }
        let speed = simd_length(BettaWaterInteractionMath.clampedVelocity(velocity))

        if speed > 0.015 || impulse > 0 || allowStationaryPressure {
            BettaWaterInteractionStore.shared.push(positionNDC: ndc, velocity: velocity, impulse: impulse)
        }

        lastNDC = ndc
        lastEventTime = now

        let local = NSPoint(x: globalPoint.x - frame.minX, y: globalPoint.y - frame.minY)
        surface.cursor.update(center: local, normalizedSpeed: speed)
        surface.cursor.alphaValue = 1
    }

    private func hideSystemCursor() {
        guard !cursorHidden else { return }
        NSCursor.hide()
        cursorHidden = true
    }

    private func apply(_ mode: BettaSharedPresentationMode, to renderer: BettaRenderer) {
        switch mode {
        case .live: renderer.useLiveMode()
        case .manual(let index): renderer.setManualPreset(index)
        case .preview: renderer.usePreviewMode()
        }
    }
}
