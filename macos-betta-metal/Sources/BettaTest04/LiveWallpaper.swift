import AppKit
import CoreGraphics
import Metal
import QuartzCore

/// The live desktop.
///
/// The phone's `BettaWallpaperService` draws the same page onto the wallpaper
/// surface and stops drawing the moment the system says the wallpaper is not
/// visible. The Mac has no wallpaper surface, so this is the production trick
/// (BettaDesktopWindow): a borderless window per screen, ordered between the
/// desktop picture and the desktop icons, that ignores the mouse and joins
/// every Space. It stops when no window is visible, when the screens sleep,
/// when the session goes to another user or the screen locks, and picks up
/// where it left off - `lastTick` is reset on resume so the pause is not
/// replayed as one giant jump.
final class LiveWallpaper {
    struct State: Codable {
        var on: Bool
        var seed: String
        var composition: String
        /// The studio style on the desktop, when it is one. Optional, so a
        /// live.json written before styles existed still decodes.
        var style: String?
    }

    private final class DesktopWindow: NSWindow {
        override var canBecomeKey: Bool { false }
        override var canBecomeMain: Bool { false }
        let metalLayer = CAMetalLayer()
        /// One frame on the GPU at a time per screen: a tick that finds the
        /// last frame still drawing skips rather than waits, so a slow frame
        /// costs a frame and never the main thread.
        var inFlight = false

        init(screen: NSScreen, device: MTLDevice) {
            super.init(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
            titleVisibility = .hidden
            isMovable = false
            hasShadow = false
            ignoresMouseEvents = true
            isOpaque = true
            backgroundColor = .black
            isReleasedWhenClosed = false
            collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

            let desktop = CGWindowLevelForKey(.desktopWindow)
            let icons = CGWindowLevelForKey(.desktopIconWindow)
            level = NSWindow.Level(rawValue: Int(min(desktop + 1, icons - 1)))

            metalLayer.device = device
            metalLayer.pixelFormat = .bgra8Unorm
            metalLayer.framebufferOnly = true
            let view = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
            view.wantsLayer = true
            view.layer = metalLayer
            contentView = view
            setFrame(screen.frame, display: true)
        }
    }

    private let renderer: EngineRenderer
    private let locked: [Int: Composition]
    private let constitution: Constitution
    private var windows: [DesktopWindow] = []
    private var timer: Timer?
    private var observers: [Any] = []
    private var activity: NSObjectProtocol?

    private(set) var frame: FrameRef?
    private var style: GeneratedStyle?
    private var composition: Composition = .neutralLandscape
    private var phase: Double = 0
    private var lastTick = CFAbsoluteTimeGetCurrent()
    private var frameCount = 0

    /// The system's reasons to stop, independent of what the windows report.
    private var screensAsleep = false
    private var sessionInactive = false
    private var screenLocked = false
    private(set) var running = false

    /// Told when the live state changes, so the status item and title follow.
    var onChange: (() -> Void)?

    var isOn: Bool { frame != nil }

    init(renderer: EngineRenderer, locked: [Int: Composition], constitution: Constitution) {
        self.renderer = renderer
        self.locked = locked
        self.constitution = constitution
        observe()
    }

    /// Picks up the seed the desktop was showing when the app last quit.
    func restore() {
        guard let state = ExplorerStorage.readJSON("live.json", as: State.self), state.on else { return }
        show(FrameRef(seed: state.seed, composition: state.composition, style: state.style))
    }

    /// Shows the frame on every screen, swapping the seed in place when the
    /// desktop is already live - the phone did the same through
    /// `window.__bettaSeed`, no restart, no black frame.
    func show(_ frame: FrameRef) {
        guard frame.seedValue != nil || frame.style != nil else { return }
        self.frame = frame
        style = frame.resolveStyle(constitution: constitution)
        composition = frame.resolveComposition(locked: locked)
        phase = 0
        lastTick = CFAbsoluteTimeGetCurrent()
        if windows.isEmpty { buildWindows() }
        if timer == nil {
            let t = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in self?.tick() }
            RunLoop.main.add(t, forMode: .common)
            timer = t
        }
        ExplorerStorage.writeJSON(
            State(on: true, seed: frame.seed, composition: frame.composition, style: frame.style),
            to: "live.json")
        decide()
        onChange?()
    }

    func stop() {
        let last = frame
        frame = nil
        style = nil
        timer?.invalidate(); timer = nil
        for w in windows { w.orderOut(nil); w.close() }
        windows.removeAll()
        if let last {
            ExplorerStorage.writeJSON(
                State(on: false, seed: last.seed, composition: last.composition, style: last.style),
                to: "live.json")
        }
        decide()
        onChange?()
    }

    private func buildWindows() {
        for w in windows { w.orderOut(nil); w.close() }
        windows = NSScreen.screens.map { DesktopWindow(screen: $0, device: renderer.device) }
        for w in windows { w.orderFrontRegardless() }
    }

    // MARK: - When to draw

    private func observe() {
        let ws = NSWorkspace.shared.notificationCenter
        let nc = NotificationCenter.default
        let dnc = DistributedNotificationCenter.default()
        func on(_ center: NotificationCenter, _ name: Notification.Name, _ body: @escaping () -> Void) {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { _ in body() })
        }
        on(ws, NSWorkspace.screensDidSleepNotification) { [weak self] in self?.screensAsleep = true; self?.evaluate() }
        on(ws, NSWorkspace.screensDidWakeNotification) { [weak self] in self?.screensAsleep = false; self?.evaluate() }
        on(ws, NSWorkspace.sessionDidResignActiveNotification) { [weak self] in self?.sessionInactive = true; self?.evaluate() }
        on(ws, NSWorkspace.sessionDidBecomeActiveNotification) { [weak self] in self?.sessionInactive = false; self?.evaluate() }
        on(ws, NSWorkspace.willSleepNotification) { [weak self] in self?.screensAsleep = true; self?.evaluate() }
        on(ws, NSWorkspace.didWakeNotification) { [weak self] in self?.screensAsleep = false; self?.evaluate() }
        on(dnc, Notification.Name("com.apple.screenIsLocked")) { [weak self] in self?.screenLocked = true; self?.evaluate() }
        on(dnc, Notification.Name("com.apple.screenIsUnlocked")) { [weak self] in self?.screenLocked = false; self?.evaluate() }
        on(nc, NSWindow.didChangeOcclusionStateNotification) { [weak self] in self?.evaluate() }
        on(nc, NSApplication.didChangeScreenParametersNotification) { [weak self] in
            guard let self, self.isOn else { return }
            self.buildWindows()
            self.evaluate()
        }
        on(nc, ProcessInfo.thermalStateDidChangeNotification) { [weak self] in self?.evaluate() }
        on(nc, Notification.Name.NSProcessInfoPowerStateDidChange) { [weak self] in self?.evaluate() }
    }

    private var anyWindowVisible: Bool {
        windows.contains { $0.occlusionState.contains(.visible) }
    }

    /// Ambient, as production calls it: a quarter of the frames when the
    /// machine is hot or on low power, the motion still continuous.
    private var ambient: Bool {
        switch ProcessInfo.processInfo.thermalState {
        case .serious, .critical: return true
        default: return ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }

    private var pending: DispatchWorkItem?

    /// Coalesced: a window appearing over the desktop fires a burst of
    /// occlusion changes in its first frames, and one decision a tenth of a
    /// second later is the same decision without the flutter.
    private func evaluate() {
        pending?.cancel()
        let item = DispatchWorkItem { [weak self] in self?.decide() }
        pending = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12, execute: item)
    }

    private func decide() {
        let shouldRun = isOn && !screensAsleep && !sessionInactive && !screenLocked && anyWindowVisible
        if shouldRun != running {
            running = shouldRun
            if running {
                lastTick = CFAbsoluteTimeGetCurrent()
                print("live: drawing")
            } else if isOn {
                var why: [String] = []
                if screensAsleep { why.append("screens asleep") }
                if sessionInactive { why.append("session inactive") }
                if screenLocked { why.append("screen locked") }
                if !anyWindowVisible { why.append("desktop covered") }
                print("live: paused (\(why.joined(separator: ", ")))")
            }
        }
        // Idle sleep is allowed throughout: a wallpaper never keeps a Mac
        // awake. What the activity prevents is App Nap throttling the timer
        // while the desktop is on view.
        if running, activity == nil {
            activity = ProcessInfo.processInfo.beginActivity(
                options: [.userInitiatedAllowingIdleSystemSleep],
                reason: "Betta live desktop"
            )
        } else if !running, let a = activity {
            ProcessInfo.processInfo.endActivity(a)
            activity = nil
        }
    }

    private func tick() {
        guard running, let style else { return }
        frameCount &+= 1
        if ambient, frameCount % 4 != 0 { return }
        let now = CFAbsoluteTimeGetCurrent()
        let delta = min(now - lastTick, 0.05)
        lastTick = now
        phase += delta * style.motionSpeed * 6.0

        for w in windows where w.occlusionState.contains(.visible) && !w.inFlight {
            let scale = w.backingScaleFactor
            let size = w.contentView!.bounds.size
            w.metalLayer.drawableSize = CGSize(width: size.width * scale, height: size.height * scale)
            guard let drawable = w.metalLayer.nextDrawable() else { continue }
            let surface = Surface(name: "desktop", width: drawable.texture.width, height: drawable.texture.height)
            w.inFlight = true
            renderer.present(style: style, surface: surface, phase: phase, composition: composition,
                             drawable: drawable) { [weak w] in w?.inFlight = false }
        }
    }
}
