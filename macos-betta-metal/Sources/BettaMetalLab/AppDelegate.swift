import AppKit
import MetalKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: BettaDesktopWindow!
    private var metalView: MTKView!
    private var renderer: BettaRenderer!
    private var editorPanel: BettaCompositionEditorPanel!
    private var titleTimer: Timer?
    private let diagnostics = BettaDiagnostics.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        let hadPreviousIncompleteLaunch = diagnostics.hasPreviousIncompleteLaunch
        let previousIncompleteSummary = diagnostics.previousIncompleteSummary
        diagnostics.begin()
        diagnostics.checkpoint("app.didFinishLaunching")

        buildMenu()
        diagnostics.checkpoint("app.menu.ready")

        let screen = NSScreen.main ?? NSScreen.screens.first
        let initialFrame = screen?.visibleFrame.insetBy(dx: (screen?.visibleFrame.width ?? 1200) * 0.05, dy: (screen?.visibleFrame.height ?? 800) * 0.05)
            ?? NSRect(x: 100, y: 100, width: 1280, height: 800)

        diagnostics.checkpoint("window.create.begin")
        window = BettaDesktopWindow(contentRect: initialFrame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 1000, height: 720)
        window.title = "Sindhorn Betta Metal Lab"
        window.backgroundColor = .black
        diagnostics.checkpoint("window.create.complete")

        if hadPreviousIncompleteLaunch && !CommandLine.arguments.contains("--retry-startup") {
            let message = previousIncompleteSummary ?? "The previous launch stopped before startup completed."
            let error = NSError(domain: "BettaDiagnostics", code: 9001, userInfo: [NSLocalizedDescriptionKey: message])
            diagnostics.fail(stage: "recovery.previous_incomplete_launch", error: error)
            presentFailure(error)
            return
        }

        let root = NSView(frame: window.contentView?.bounds ?? initialFrame)
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor
        window.contentView = root
        diagnostics.checkpoint("window.root.ready")

        diagnostics.checkpoint("metal.view.create.begin")
        metalView = MTKView(frame: root.bounds)
        metalView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(metalView)
        NSLayoutConstraint.activate([
            metalView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            metalView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            metalView.topAnchor.constraint(equalTo: root.topAnchor),
            metalView.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])
        diagnostics.checkpoint("metal.view.create.complete")

        diagnostics.checkpoint("renderer.init.begin")
        do {
            renderer = try BettaRenderer(view: metalView)
            diagnostics.checkpoint("renderer.init.complete", detail: renderer.device.name)
        } catch {
            diagnostics.fail(stage: "renderer.init", error: error)
            presentFailure(error)
            return
        }

        let currentIndex = BettaMorphState.bangkokIndex(for: Date())
        diagnostics.checkpoint("editor.init.begin", detail: "fish-index=\(currentIndex)")
        editorPanel = BettaCompositionEditorPanel(initialIndex: currentIndex)
        editorPanel.onSelectFish = { [weak self] index in self?.renderer?.setManualPreset(index) }
        editorPanel.onSaveAndUse = { [weak self] in self?.saveAndUseAsWallpaper() }
        root.addSubview(editorPanel)
        NSLayoutConstraint.activate([
            editorPanel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18),
            editorPanel.topAnchor.constraint(equalTo: root.topAnchor, constant: 18)
        ])
        diagnostics.checkpoint("editor.init.complete")

        diagnostics.checkpoint("launch.arguments.begin")
        applyLaunchArguments()
        diagnostics.checkpoint("launch.arguments.complete")

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        diagnostics.checkpoint("window.visible")

        titleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let window = self.window, let renderer = self.renderer, !window.desktopMode else { return }
            window.title = "Sindhorn Betta Metal Lab · \(renderer.statusText)"
        }

        diagnostics.markStartupComplete()
    }

    func applicationWillTerminate(_ notification: Notification) {
        titleTimer?.invalidate()
        metalView?.isPaused = true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func windowWillClose(_ notification: Notification) {
        if window?.desktopMode != true { NSApp.terminate(nil) }
    }

    @objc private func selectFish(_ sender: NSMenuItem) { editorPanel?.selectFish(index: sender.tag) }
    @objc private func useLive(_ sender: Any?) { renderer?.useLiveMode() }
    @objc private func usePreview(_ sender: Any?) { renderer?.usePreviewMode() }
    @objc private func nextFish(_ sender: Any?) { editorPanel?.cycleFish(1) }
    @objc private func previousFish(_ sender: Any?) { editorPanel?.cycleFish(-1) }

    @objc private func toggleDesktop(_ sender: Any?) {
        guard let window, let renderer else { return }
        if window.desktopMode {
            window.setDesktopMode(false)
            setEditorVisible(true)
        } else {
            _ = BettaCompositionStore.shared.save()
            _ = BettaAdvancedTuningStore.shared.save()
            renderer.useLiveMode()
            setEditorVisible(false)
            window.setDesktopMode(true)
        }
    }

    private func saveAndUseAsWallpaper() {
        guard let window, let renderer else { return }
        renderer.useLiveMode()
        setEditorVisible(false)
        window.setDesktopMode(true)
    }

    private func setEditorVisible(_ visible: Bool) { editorPanel?.isHidden = !visible }

    private func applyLaunchArguments() {
        guard let renderer else { return }
        let args = CommandLine.arguments
        if args.contains("--preview") { renderer.usePreviewMode() }
        if let fishArg = args.first(where: { $0.hasPrefix("--fish=") }), let value = Int(fishArg.split(separator: "=").last ?? ""), (1...8).contains(value) {
            editorPanel?.selectFish(index: value - 1)
        }
        if args.contains("--desktop") {
            renderer.useLiveMode()
            setEditorVisible(false)
            window?.setDesktopMode(true)
        }
    }

    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu(title: "Sindhorn Betta Metal Lab"); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Sindhorn Betta Metal Lab", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Sindhorn Betta Metal Lab", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let bettaItem = NSMenuItem(); main.addItem(bettaItem)
        let bettaMenu = NSMenu(title: "Betta"); bettaItem.submenu = bettaMenu
        let live = NSMenuItem(title: "Live Bangkok Cycle", action: #selector(useLive(_:)), keyEquivalent: "l"); live.target = self; bettaMenu.addItem(live)
        let preview = NSMenuItem(title: "Preview Full Day in 3 Minutes", action: #selector(usePreview(_:)), keyEquivalent: "p"); preview.target = self; bettaMenu.addItem(preview)
        bettaMenu.addItem(.separator())
        for (index, preset) in BettaPreset.all.enumerated() {
            let item = NSMenuItem(title: "Fish #\(preset.referenceId) — \(preset.name)", action: #selector(selectFish(_:)), keyEquivalent: String(index + 1))
            item.target = self; item.tag = index; bettaMenu.addItem(item)
        }
        bettaMenu.addItem(.separator())
        let previous = NSMenuItem(title: "Previous Fish", action: #selector(previousFish(_:)), keyEquivalent: "["); previous.target = self; bettaMenu.addItem(previous)
        let next = NSMenuItem(title: "Next Fish", action: #selector(nextFish(_:)), keyEquivalent: "]"); next.target = self; bettaMenu.addItem(next)
        bettaMenu.addItem(.separator())
        let desktop = NSMenuItem(title: "Toggle Wallpaper / Editor", action: #selector(toggleDesktop(_:)), keyEquivalent: "d"); desktop.target = self; bettaMenu.addItem(desktop)
        NSApp.mainMenu = main
    }

    private func presentFailure(_ error: Error) {
        diagnostics.checkpoint("failure.ui.begin")
        let frame = window?.contentView?.bounds ?? NSRect(x: 0, y: 0, width: 900, height: 680)
        let failureView = BettaFailureView(frame: frame, error: error, diagnostics: diagnostics)
        failureView.autoresizingMask = [.width, .height]
        window.contentView = failureView
        window.title = "Sindhorn Betta Metal Lab — Diagnostic Report"
        window.minSize = NSSize(width: 780, height: 620)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        diagnostics.checkpoint("failure.ui.visible")
        diagnostics.markFailureUIReady()
    }
}
