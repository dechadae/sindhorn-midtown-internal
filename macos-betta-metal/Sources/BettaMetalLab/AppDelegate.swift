import AppKit
import MetalKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: BettaDesktopWindow!
    private var metalView: MTKView!
    private var renderer: BettaRenderer!
    private var editorPanel: BettaCompositionEditorPanel!
    private var titleTimer: Timer?
    private var evolutionMenuItem: NSMenuItem?
    private let diagnostics = BettaDiagnostics.shared
    private let evolution = BettaEvolutionController()

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
        editorPanel.onSelectFish = { [weak self] index in
            guard let self else { return }
            self.stopEvolution(showEditor: self.window?.desktopMode != true)
            self.renderer?.setManualPreset(index)
        }
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
            let evolutionText = self.evolution.statusText.map { " · \($0)" } ?? ""
            window.title = "Sindhorn Betta Metal Lab · \(renderer.statusText)\(evolutionText)"
        }

        diagnostics.markStartupComplete()
    }

    func applicationWillTerminate(_ notification: Notification) {
        evolution.stop()
        titleTimer?.invalidate()
        metalView?.isPaused = true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func windowWillClose(_ notification: Notification) {
        if window?.desktopMode != true { NSApp.terminate(nil) }
    }

    @objc private func selectFish(_ sender: NSMenuItem) {
        editorPanel?.selectFish(index: sender.tag)
    }

    @objc private func useLive(_ sender: Any?) {
        stopEvolution(showEditor: window?.desktopMode != true)
        renderer?.useLiveMode()
    }

    @objc private func usePreview(_ sender: Any?) {
        stopEvolution(showEditor: window?.desktopMode != true)
        renderer?.usePreviewMode()
    }

    @objc private func nextFish(_ sender: Any?) { editorPanel?.cycleFish(1) }
    @objc private func previousFish(_ sender: Any?) { editorPanel?.cycleFish(-1) }

    @objc private func randomizeBetta(_ sender: Any?) {
        stopEvolution(showEditor: window?.desktopMode != true)
        guard let editorPanel, let style = editorPanel.randomizeCurrentBetta() else { return }
        diagnostics.checkpoint(
            "random.generated",
            detail: "fish-index=\(editorPanel.selectedFishIndex) seed=\(style.shortSeed)"
        )
    }

    @objc private func restoreOriginalColorsOnly(_ sender: Any?) {
        stopEvolution(showEditor: window?.desktopMode != true)
        guard let editorPanel else { return }
        let index = editorPanel.selectedFishIndex
        let preset = BettaPreset.all[index]
        guard let style = BettaRandomStyleStore.shared.restoreOriginalColors(referenceId: preset.referenceId) else { return }

        // Refresh the editor without changing the selected fish or touching any
        // geometry/camera/composition/membrane settings.
        editorPanel.selectFish(index: index, notifyRenderer: false)
        diagnostics.checkpoint(
            "original-colors.restored",
            detail: "fish-index=\(index) reference-id=\(preset.referenceId) seed=\(style.shortSeed) palette+background-only"
        )
    }

    @objc private func toggleEvolution(_ sender: Any?) {
        if evolution.isRunning {
            stopEvolution(showEditor: window?.desktopMode != true)
            return
        }
        startEvolutionForSelected()
    }

    @objc private func toggleDesktop(_ sender: Any?) {
        guard let window, let renderer else { return }
        if window.desktopMode {
            stopEvolution(showEditor: false)
            window.setDesktopMode(false)
            if let editorPanel {
                editorPanel.selectFish(index: editorPanel.selectedFishIndex, notifyRenderer: false)
            }
            setEditorVisible(true)
        } else {
            _ = BettaCompositionStore.shared.save()
            _ = BettaAdvancedTuningStore.shared.save()
            _ = BettaRandomStyleStore.shared.save()
            if !evolution.isRunning { renderer.useLiveMode() }
            setEditorVisible(false)
            window.setDesktopMode(true)
        }
    }

    private func saveAndUseAsWallpaper() {
        guard let window, let renderer else { return }
        _ = BettaRandomStyleStore.shared.save()
        if !evolution.isRunning { renderer.useLiveMode() }
        setEditorVisible(false)
        window.setDesktopMode(true)
    }

    private func startEvolutionForSelected() {
        guard let editorPanel, let renderer else { return }
        let index = editorPanel.selectedFishIndex
        let referenceId = BettaPreset.all[index].referenceId
        renderer.setManualPreset(index)

        guard evolution.start(referenceId: referenceId) else { return }
        setEditorVisible(false)
        syncEvolutionMenuItem()
        diagnostics.checkpoint(
            "evolution.started",
            detail: "fish-index=\(index) reference-id=\(referenceId) target=\(evolution.targetSeedShort ?? "unknown") duration=\(Int(BettaEvolutionController.defaultSegmentDuration))s"
        )
    }

    private func stopEvolution(showEditor: Bool) {
        guard evolution.isRunning else { return }
        let referenceId = evolution.currentReferenceId
        let targetSeed = evolution.targetSeedShort
        evolution.stop()
        syncEvolutionMenuItem()
        diagnostics.checkpoint(
            "evolution.stopped",
            detail: "reference-id=\(referenceId.map(String.init) ?? "unknown") target=\(targetSeed ?? "unknown")"
        )

        if showEditor, window?.desktopMode != true, let editorPanel {
            editorPanel.selectFish(index: editorPanel.selectedFishIndex, notifyRenderer: false)
            setEditorVisible(true)
        }
    }

    private func syncEvolutionMenuItem() {
        evolutionMenuItem?.state = evolution.isRunning ? .on : .off
        evolutionMenuItem?.title = evolution.isRunning ? "Stop Continuous Evolution" : "Start Continuous Evolution"
    }

    private func setEditorVisible(_ visible: Bool) { editorPanel?.isHidden = !visible }

    private func applyLaunchArguments() {
        guard let renderer else { return }
        let args = CommandLine.arguments
        if args.contains("--preview") { renderer.usePreviewMode() }
        if let fishArg = args.first(where: { $0.hasPrefix("--fish=") }), let value = Int(fishArg.split(separator: "=").last ?? ""), (1...8).contains(value) {
            editorPanel?.selectFish(index: value - 1)
        }
        if args.contains("--evolve") {
            startEvolutionForSelected()
        }
        if args.contains("--desktop") {
            if !evolution.isRunning { renderer.useLiveMode() }
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

        let random = NSMenuItem(title: "Random Betta + Matching Gradient", action: #selector(randomizeBetta(_:)), keyEquivalent: "r")
        random.target = self
        bettaMenu.addItem(random)

        let restoreColors = NSMenuItem(title: "Restore Original Colors Only", action: #selector(restoreOriginalColorsOnly(_:)), keyEquivalent: "")
        restoreColors.target = self
        restoreColors.toolTip = "Restore the selected original palette + gradient without changing shape, camera, composition or membranes."
        bettaMenu.addItem(restoreColors)

        let evolutionItem = NSMenuItem(title: "Start Continuous Evolution", action: #selector(toggleEvolution(_:)), keyEquivalent: "e")
        evolutionItem.target = self
        evolutionItem.state = .off
        bettaMenu.addItem(evolutionItem)
        evolutionMenuItem = evolutionItem

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
