import AppKit
import MetalKit

@MainActor
final class BettaDisplayCoordinator {
    static let shared = BettaDisplayCoordinator()

    private final class Surface {
        let screenID: String
        let window: NSWindow
        let view: MTKView
        let renderer: BettaRenderer
        var sessionRevision: UInt64 = .max

        init(screenID: String, window: NSWindow, view: MTKView, renderer: BettaRenderer) {
            self.screenID = screenID
            self.window = window
            self.view = view
            self.renderer = renderer
        }
    }

    private let defaults = UserDefaults.standard
    private let mirrorKey = "betta.release.mirror-all-displays.v1"
    private var surfaces: [String: Surface] = [:]
    private var timer: Timer?
    private var screenObserver: NSObjectProtocol?
    private var started = false

    private init() {}

    var mirrorsAllDisplays: Bool {
        if defaults.object(forKey: mirrorKey) == nil { return true }
        return defaults.bool(forKey: mirrorKey)
    }

    var connectedDisplayCount: Int { NSScreen.screens.count }

    func start() {
        guard !started else { return }
        started = true
        screenObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.rebuild() }
        }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sync() }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
        sync()
    }

    func stop() {
        timer?.invalidate(); timer = nil
        if let screenObserver { NotificationCenter.default.removeObserver(screenObserver) }
        screenObserver = nil
        teardown()
        started = false
    }

    func setMirrorsAllDisplays(_ enabled: Bool) {
        defaults.set(enabled, forKey: mirrorKey)
        rebuild()
    }

    func rebuild() {
        teardown()
        sync()
    }

    private func sync() {
        guard mirrorsAllDisplays,
              let primary = NSApp.windows.compactMap({ $0 as? BettaDesktopWindow }).first,
              primary.desktopMode,
              let primaryScreen = primary.screen ?? NSScreen.screens.first(where: { $0.frame.intersects(primary.frame) }) else {
            teardown()
            return
        }

        let primaryID = screenID(primaryScreen)
        let desired = Set(NSScreen.screens.map(screenID).filter { $0 != primaryID })

        for id in surfaces.keys where !desired.contains(id) {
            surfaces[id]?.window.orderOut(nil)
            surfaces.removeValue(forKey: id)
        }

        for screen in NSScreen.screens where screenID(screen) != primaryID {
            let id = screenID(screen)
            if surfaces[id] == nil {
                surfaces[id] = makeSurface(for: screen)
            } else if surfaces[id]?.window.frame != screen.frame {
                surfaces[id]?.window.setFrame(screen.frame, display: true)
            }
        }

        let session = BettaSharedSessionState.shared.snapshot
        for surface in surfaces.values {
            if surface.sessionRevision != session.revision {
                apply(session.mode, to: surface.renderer)
                surface.sessionRevision = session.revision
            }
            applyEnergy(to: surface.view)
        }
    }

    private func makeSurface(for screen: NSScreen) -> Surface? {
        let window = NSWindow(
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
        window.ignoresMouseEvents = true
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        let desktop = CGWindowLevelForKey(.desktopWindow)
        let icons = CGWindowLevelForKey(.desktopIconWindow)
        window.level = NSWindow.Level(rawValue: Int(min(desktop + 1, icons - 1)))

        let view = MTKView(frame: NSRect(origin: .zero, size: screen.frame.size))
        view.autoresizingMask = [.width, .height]
        window.contentView = view

        do {
            let renderer = try BettaRenderer(view: view)
            let surface = Surface(screenID: screenID(screen), window: window, view: view, renderer: renderer)
            let session = BettaSharedSessionState.shared.snapshot
            apply(session.mode, to: renderer)
            surface.sessionRevision = session.revision
            applyEnergy(to: view)
            window.orderFrontRegardless()
            return surface
        } catch {
            window.orderOut(nil)
            return nil
        }
    }

    private func teardown() {
        for surface in surfaces.values {
            surface.view.isPaused = true
            surface.window.orderOut(nil)
            surface.window.close()
        }
        surfaces.removeAll()
    }

    private func apply(_ mode: BettaSharedPresentationMode, to renderer: BettaRenderer) {
        switch mode {
        case .live: renderer.useLiveMode()
        case .manual(let index): renderer.setManualPreset(index)
        case .preview: renderer.usePreviewMode()
        }
    }

    private func applyEnergy(to view: MTKView) {
        let process = ProcessInfo.processInfo
        if process.thermalState == .serious || process.thermalState == .critical || process.isLowPowerModeEnabled {
            view.preferredFramesPerSecond = 15
        } else {
            view.preferredFramesPerSecond = BettaSettings.preferredFPS
        }
        view.isPaused = false
    }

    private func screenID(_ screen: NSScreen) -> String {
        if let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber {
            return number.stringValue
        }
        let f = screen.frame
        return "\(Int(f.origin.x)):\(Int(f.origin.y)):\(Int(f.width)):\(Int(f.height))"
    }
}

@MainActor
final class BettaAmbientScreenController {
    static let shared = BettaAmbientScreenController()

    private struct Surface {
        let window: NSWindow
        let view: MTKView
        let renderer: BettaRenderer
    }

    private var surfaces: [Surface] = []
    private var eventMonitor: Any?
    private(set) var isActive = false

    private init() {}

    func toggle() {
        isActive ? stop() : start()
    }

    func start() {
        guard !isActive else { return }
        isActive = true
        let session = BettaSharedSessionState.shared.snapshot

        for screen in NSScreen.screens {
            let window = NSWindow(
                contentRect: screen.frame,
                styleMask: [.borderless],
                backing: .buffered,
                defer: false,
                screen: screen
            )
            window.isOpaque = true
            window.backgroundColor = .black
            window.hasShadow = false
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
            window.level = .screenSaver

            let view = MTKView(frame: NSRect(origin: .zero, size: screen.frame.size))
            view.autoresizingMask = [.width, .height]
            window.contentView = view

            if let renderer = try? BettaRenderer(view: view) {
                apply(session.mode, to: renderer)
                surfaces.append(Surface(window: window, view: view, renderer: renderer))
                window.orderFrontRegardless()
            }
        }

        NSApp.activate(ignoringOtherApps: true)
        NSCursor.hide()
        eventMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.keyDown, .leftMouseDown, .rightMouseDown, .otherMouseDown]
        ) { [weak self] _ in
            Task { @MainActor in self?.stop() }
            return nil
        }
    }

    func stop() {
        guard isActive else { return }
        isActive = false
        if let eventMonitor { NSEvent.removeMonitor(eventMonitor) }
        eventMonitor = nil
        NSCursor.unhide()
        for surface in surfaces {
            surface.view.isPaused = true
            surface.window.orderOut(nil)
            surface.window.close()
        }
        surfaces.removeAll()
    }

    private func apply(_ mode: BettaSharedPresentationMode, to renderer: BettaRenderer) {
        switch mode {
        case .live: renderer.useLiveMode()
        case .manual(let index): renderer.setManualPreset(index)
        case .preview: renderer.usePreviewMode()
        }
    }
}

@MainActor
final class BettaOnboardingController {
    static let completedKey = "betta.release.onboarding.completed.v1"

    private var window: NSPanel?

    var isCompleted: Bool { UserDefaults.standard.bool(forKey: Self.completedKey) }

    func show(force: Bool = false) {
        guard force || !isCompleted else { return }
        if let window {
            window.makeKeyAndOrderFront(nil)
            return
        }

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 700, height: 430),
            styleMask: [.titled, .closable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.title = "Welcome to BETTA"
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.center()

        let eyebrow = NSTextField(labelWithString: "BETTA")
        eyebrow.font = .systemFont(ofSize: 12, weight: .semibold)
        eyebrow.textColor = .secondaryLabelColor
        let title = NSTextField(labelWithString: "Living generative art for your Mac")
        title.font = .systemFont(ofSize: 28, weight: .semibold)
        let intro = NSTextField(wrappingLabelWithString: "Every Betta is rendered live in Metal. There are no video loops and no fixed wallpaper library—your organism can remain still, evolve continuously, or respond gently to Bangkok's live Himawari atmosphere.")
        intro.font = .systemFont(ofSize: 13)
        intro.textColor = .secondaryLabelColor
        intro.maximumNumberOfLines = 4

        let meet = step("1", "Meet your Betta", "Begin with one of eight immutable Originals.")
        let make = step("2", "Make it yours", "Randomize, save Favorites, or enter Living Studio for full control.")
        let live = step("3", "Let it live", "Use it on your desktop, evolve it, or let Bangkok Live set the mood.")

        let button = NSButton(title: "Enter Living Gallery", target: self, action: #selector(complete(_:)))
        button.bezelStyle = .rounded
        button.controlSize = .large
        button.keyEquivalent = "\r"

        let stack = NSStackView(views: [eyebrow, title, intro, meet, make, live, button])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        let host = NSView(frame: .zero)
        host.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -28),
            stack.topAnchor.constraint(equalTo: host.topAnchor, constant: 26),
            stack.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -26),
            button.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
        panel.contentView = BettaLiquidGlassSurface.make(content: host, cornerRadius: 0)
        window = panel
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func reset() {
        UserDefaults.standard.removeObject(forKey: Self.completedKey)
    }

    @objc private func complete(_ sender: Any?) {
        UserDefaults.standard.set(true, forKey: Self.completedKey)
        window?.orderOut(nil)
        window?.close()
        window = nil
    }

    private func step(_ number: String, _ title: String, _ detail: String) -> NSView {
        let badge = NSTextField(labelWithString: number)
        badge.font = .monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        badge.alignment = .center
        badge.widthAnchor.constraint(equalToConstant: 28).isActive = true

        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 14, weight: .medium)
        let detailLabel = NSTextField(labelWithString: detail)
        detailLabel.font = .systemFont(ofSize: 12)
        detailLabel.textColor = .secondaryLabelColor
        let copy = NSStackView(views: [titleLabel, detailLabel])
        copy.orientation = .vertical
        copy.alignment = .leading
        copy.spacing = 2

        let row = NSStackView(views: [badge, copy])
        row.orientation = .horizontal
        row.alignment = .centerY
        row.spacing = 10
        return row
    }
}

@MainActor
final class BettaSettingsWindowController {
    private var window: NSWindow?
    private let launchAtLogin = BettaLaunchAtLoginController()
    private let atmosphere = BettaHimawariAtmosphereController()
    private var loginSwitch: NSSwitch!
    private var atmosphereSwitch: NSSwitch!
    private var displaySwitch: NSSwitch!
    private var displayLabel: NSTextField!
    var onShowWelcome: (() -> Void)?

    func show() {
        if window == nil { build() }
        refresh()
        window?.center()
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func build() {
        let w = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 500),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        w.title = "BETTA Settings"
        w.isReleasedWhenClosed = false

        let title = NSTextField(labelWithString: "Settings")
        title.font = .systemFont(ofSize: 24, weight: .semibold)
        let sub = NSTextField(wrappingLabelWithString: "BETTA keeps the rendering engine quiet when it can, while preserving the exact organism, composition and visual detail you created.")
        sub.font = .systemFont(ofSize: 12)
        sub.textColor = .secondaryLabelColor
        sub.maximumNumberOfLines = 3

        loginSwitch = makeSwitch(action: #selector(toggleLogin(_:)))
        atmosphereSwitch = makeSwitch(action: #selector(toggleAtmosphere(_:)))
        displaySwitch = makeSwitch(action: #selector(toggleDisplays(_:)))

        let loginRow = settingRow("Launch at Login", "Keep BETTA available from the menu bar after you sign in.", loginSwitch)
        let atmosphereRow = settingRow("Bangkok Live · Himawari", "JMA satellite imagery is sampled into a slow atmospheric mood; remote images are never used as artwork.", atmosphereSwitch)
        displayLabel = NSTextField(labelWithString: "")
        displayLabel.font = .systemFont(ofSize: 11)
        displayLabel.textColor = .tertiaryLabelColor
        let displaysRow = settingRow("Mirror across displays", "Render the same living organism and environment on every connected display.", displaySwitch)

        let energyTitle = NSTextField(labelWithString: "Energy Intelligence")
        energyTitle.font = .systemFont(ofSize: 13, weight: .medium)
        let energyCopy = NSTextField(wrappingLabelWithString: "Automatic: 60 fps while visible, reduced frame scheduling under Low Power Mode or thermal pressure, and paused when the non-desktop renderer is hidden. Mesh and shader quality are never reduced.")
        energyCopy.font = .systemFont(ofSize: 11)
        energyCopy.textColor = .secondaryLabelColor
        energyCopy.maximumNumberOfLines = 4

        let privacyTitle = NSTextField(labelWithString: "Privacy")
        privacyTitle.font = .systemFont(ofSize: 13, weight: .medium)
        let privacyCopy = NSTextField(wrappingLabelWithString: "BETTA contacts JMA only for Bangkok Live atmosphere. Diagnostic reports are sent only when you explicitly choose Send Bug Report; they do not include your username, host name, serial number, files or document contents.")
        privacyCopy.font = .systemFont(ofSize: 11)
        privacyCopy.textColor = .secondaryLabelColor
        privacyCopy.maximumNumberOfLines = 4

        let ambient = NSButton(title: "Enter Ambient Screen", target: self, action: #selector(toggleAmbient(_:)))
        ambient.bezelStyle = .rounded
        let welcome = NSButton(title: "Show Welcome Again", target: self, action: #selector(showWelcome(_:)))
        welcome.bezelStyle = .rounded
        let actions = NSStackView(views: [ambient, welcome])
        actions.orientation = .horizontal
        actions.distribution = .fillEqually
        actions.spacing = 8

        let stack = NSStackView(views: [
            title, sub,
            loginRow,
            atmosphereRow,
            displaysRow, displayLabel,
            energyTitle, energyCopy,
            privacyTitle, privacyCopy,
            actions
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 13
        stack.translatesAutoresizingMaskIntoConstraints = false

        let host = NSView(frame: .zero)
        host.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: host.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: host.bottomAnchor, constant: -22),
            actions.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
        w.contentView = BettaLiquidGlassSurface.make(content: host, cornerRadius: 0)
        window = w
    }

    private func refresh() {
        loginSwitch?.state = launchAtLogin.isEnabled ? .on : .off
        atmosphereSwitch?.state = UserDefaults.standard.object(forKey: "betta.atmosphere.himawari.enabled.v1") == nil || UserDefaults.standard.bool(forKey: "betta.atmosphere.himawari.enabled.v1") ? .on : .off
        displaySwitch?.state = BettaDisplayCoordinator.shared.mirrorsAllDisplays ? .on : .off
        displayLabel?.stringValue = "\(BettaDisplayCoordinator.shared.connectedDisplayCount) display\(BettaDisplayCoordinator.shared.connectedDisplayCount == 1 ? "" : "s") currently connected"
    }

    private func makeSwitch(action: Selector) -> NSSwitch {
        let control = NSSwitch(frame: .zero)
        control.target = self
        control.action = action
        return control
    }

    private func settingRow(_ title: String, _ detail: String, _ control: NSSwitch) -> NSView {
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        let detailLabel = NSTextField(wrappingLabelWithString: detail)
        detailLabel.font = .systemFont(ofSize: 11)
        detailLabel.textColor = .secondaryLabelColor
        detailLabel.maximumNumberOfLines = 3
        let copy = NSStackView(views: [titleLabel, detailLabel])
        copy.orientation = .vertical
        copy.alignment = .leading
        copy.spacing = 2
        let row = NSStackView(views: [copy, control])
        row.orientation = .horizontal
        row.alignment = .centerY
        row.distribution = .fill
        row.spacing = 16
        control.setContentHuggingPriority(.required, for: .horizontal)
        return row
    }

    @objc private func toggleLogin(_ sender: NSSwitch) {
        _ = launchAtLogin.setEnabled(sender.state == .on)
        refresh()
    }

    @objc private func toggleAtmosphere(_ sender: NSSwitch) {
        atmosphere.setEnabled(sender.state == .on)
        refresh()
    }

    @objc private func toggleDisplays(_ sender: NSSwitch) {
        BettaDisplayCoordinator.shared.setMirrorsAllDisplays(sender.state == .on)
        refresh()
    }

    @objc private func toggleAmbient(_ sender: Any?) {
        window?.orderOut(nil)
        BettaAmbientScreenController.shared.toggle()
    }

    @objc private func showWelcome(_ sender: Any?) {
        onShowWelcome?()
    }
}

@MainActor
final class BettaReleaseExperienceController {
    static let shared = BettaReleaseExperienceController()

    private let settings = BettaSettingsWindowController()
    private let onboarding = BettaOnboardingController()
    private var launchObserver: NSObjectProtocol?
    private var started = false

    private init() {
        settings.onShowWelcome = { [weak self] in
            guard let self else { return }
            self.onboarding.reset()
            self.onboarding.show(force: true)
        }
    }

    func start() {
        guard !started else { return }
        started = true
        launchObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didFinishLaunchingNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.applicationReady() }
        }
    }

    private func applicationReady() {
        BettaDisplayCoordinator.shared.start()
        injectReleaseMenus()
        guard !CommandLine.arguments.contains("--desktop") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.onboarding.show()
        }
    }

    private func injectReleaseMenus() {
        if let appMenu = NSApp.mainMenu?.items.first?.submenu,
           !appMenu.items.contains(where: { $0.action == #selector(openSettings(_:)) }) {
            let item = NSMenuItem(title: "Settings…", action: #selector(openSettings(_:)), keyEquivalent: ",")
            item.target = self
            if let loginIndex = appMenu.items.firstIndex(where: { $0.title == "Launch at Login" }) {
                appMenu.insertItem(item, at: loginIndex)
            } else {
                appMenu.insertItem(item, at: max(0, appMenu.numberOfItems - 1))
            }
        }

        if let viewMenu = NSApp.mainMenu?.items.first(where: { $0.submenu?.title == "View" })?.submenu,
           !viewMenu.items.contains(where: { $0.action == #selector(toggleAmbient(_:)) }) {
            viewMenu.addItem(.separator())
            let ambient = NSMenuItem(title: "Enter Ambient Screen", action: #selector(toggleAmbient(_:)), keyEquivalent: "a")
            ambient.target = self
            viewMenu.addItem(ambient)
        }
    }

    @objc private func openSettings(_ sender: Any?) {
        settings.show()
    }

    @objc private func toggleAmbient(_ sender: Any?) {
        BettaAmbientScreenController.shared.toggle()
    }
}
