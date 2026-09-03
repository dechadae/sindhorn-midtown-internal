import AppKit
import MetalKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: BettaDesktopWindow!
    private var metalView: MTKView!
    private var renderer: BettaRenderer!
    private var editorPanel: BettaCompositionEditorPanel!
    private var galleryView: BettaLivingGalleryView!
    private var titleTimer: Timer?
    private var evolutionMenuItem: NSMenuItem?
    private var statusEvolutionMenuItem: NSMenuItem?
    private var statusItem: NSStatusItem?
    private let diagnostics = BettaDiagnostics.shared
    private let evolution = BettaEvolutionController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let hadPreviousIncompleteLaunch = diagnostics.hasPreviousIncompleteLaunch
        let previousIncompleteSummary = diagnostics.previousIncompleteSummary
        diagnostics.begin()
        diagnostics.checkpoint("app.didFinishLaunching")

        buildMenu()
        buildStatusItem()
        diagnostics.checkpoint("app.menu.ready")

        let screen = NSScreen.main ?? NSScreen.screens.first
        let initialFrame = screen?.visibleFrame.insetBy(dx: (screen?.visibleFrame.width ?? 1200) * 0.05, dy: (screen?.visibleFrame.height ?? 800) * 0.05)
            ?? NSRect(x: 100, y: 100, width: 1280, height: 800)

        diagnostics.checkpoint("window.create.begin")
        window = BettaDesktopWindow(contentRect: initialFrame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 1000, height: 720)
        window.title = "BETTA — Living Gallery"
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
            self.stopEvolution(showEditor: false)
            self.renderer?.setManualPreset(index)
            self.galleryView?.selectFish(index: index)
        }
        editorPanel.onSaveAndUse = { [weak self] in self?.saveAndUseAsWallpaper() }
        root.addSubview(editorPanel)
        NSLayoutConstraint.activate([
            editorPanel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18),
            editorPanel.topAnchor.constraint(equalTo: root.topAnchor, constant: 18)
        ])
        editorPanel.isHidden = true
        diagnostics.checkpoint("editor.init.complete")

        diagnostics.checkpoint("gallery.init.begin", detail: "fish-index=\(currentIndex)")
        galleryView = BettaLivingGalleryView(initialIndex: currentIndex)
        galleryView.onSelectOriginal = { [weak self] index in
            self?.selectWorkingFish(index)
        }
        galleryView.onUseOnDesktop = { [weak self] in self?.useCurrentOnDesktop() }
        galleryView.onCustomize = { [weak self] in self?.showStudio() }
        galleryView.onRandomize = { [weak self] in self?.randomizeBetta(nil) }
        galleryView.onToggleEvolution = { [weak self] in self?.toggleEvolution(nil) }
        galleryView.onToggleFavorite = { [weak self] in self?.toggleGalleryFavorite() }
        galleryView.onLoadFavorite = { [weak self] id in self?.loadFavorite(id: id) }
        root.addSubview(galleryView)
        NSLayoutConstraint.activate([
            galleryView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 22),
            galleryView.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -22)
        ])
        diagnostics.checkpoint("gallery.init.complete")

        diagnostics.checkpoint("launch.arguments.begin")
        applyLaunchArguments()
        diagnostics.checkpoint("launch.arguments.complete")

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        diagnostics.checkpoint("window.visible")

        titleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.updatePresentationChrome()
        }

        diagnostics.markStartupComplete()
    }

    func applicationWillTerminate(_ notification: Notification) {
        evolution.stop()
        titleTimer?.invalidate()
        metalView?.isPaused = true
        if let statusItem { NSStatusBar.system.removeStatusItem(statusItem) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func windowWillClose(_ notification: Notification) {
        // Premium menu-bar behavior: closing the consumer window hides the UI,
        // but the app remains available from the status item.
    }

    @objc private func selectFish(_ sender: NSMenuItem) {
        selectWorkingFish(sender.tag)
    }

    private func selectWorkingFish(_ index: Int) {
        let safe = min(7, max(0, index))
        editorPanel?.selectFish(index: safe)
        galleryView?.selectFish(index: safe)
    }

    @objc private func useLive(_ sender: Any?) {
        stopEvolution(showEditor: false)
        renderer?.useLiveMode()
        galleryView?.refresh(message: "Bangkok live cycle · slow environmental sequence")
    }

    @objc private func usePreview(_ sender: Any?) {
        stopEvolution(showEditor: false)
        renderer?.usePreviewMode()
        galleryView?.refresh(message: "Previewing a full Bangkok day in three minutes")
    }

    @objc private func nextFish(_ sender: Any?) {
        guard let editorPanel else { return }
        selectWorkingFish((editorPanel.selectedFishIndex + 1) % 8)
    }

    @objc private func previousFish(_ sender: Any?) {
        guard let editorPanel else { return }
        selectWorkingFish((editorPanel.selectedFishIndex + 7) % 8)
    }

    @objc private func randomizeBetta(_ sender: Any?) {
        stopEvolution(showEditor: false)
        guard let editorPanel, let style = editorPanel.randomizeCurrentBetta() else { return }
        galleryView?.selectFish(index: editorPanel.selectedFishIndex)
        galleryView?.refresh(message: "New organism generated · #\(style.shortSeed)")
        diagnostics.checkpoint(
            "random.generated",
            detail: "fish-index=\(editorPanel.selectedFishIndex) seed=\(style.shortSeed)"
        )
    }

    @objc private func restoreOriginalColorsOnly(_ sender: Any?) {
        stopEvolution(showEditor: false)
        guard let editorPanel else { return }
        let index = editorPanel.selectedFishIndex
        let preset = BettaPreset.all[index]
        guard let style = BettaRandomStyleStore.shared.restoreOriginalColors(referenceId: preset.referenceId) else { return }

        editorPanel.selectFish(index: index, notifyRenderer: false)
        galleryView?.selectFish(index: index)
        galleryView?.refresh(message: "Original palette + gradient restored · form preserved")
        diagnostics.checkpoint(
            "original-colors.restored",
            detail: "fish-index=\(index) reference-id=\(preset.referenceId) seed=\(style.shortSeed) palette+background-only"
        )
    }

    private func toggleGalleryFavorite() {
        guard let editorPanel else { return }
        let index = editorPanel.selectedFishIndex
        let id = BettaPreset.all[index].referenceId
        guard let result = BettaUserPresetStore.shared.toggleFavoriteCurrent(referenceId: id) else { return }
        editorPanel.selectFish(index: index, notifyRenderer: false)
        galleryView?.refresh(message: result.isFavorite ? "Saved to Favorites" : "Removed from Favorites")
    }

    private func loadFavorite(id: String) {
        stopEvolution(showEditor: false)
        guard let saved = BettaUserPresetStore.shared.preset(id: id),
              BettaUserPresetStore.shared.apply(saved) else { return }
        let index = min(7, max(0, saved.referenceId - 1))
        editorPanel?.selectFish(index: index)
        galleryView?.selectFish(index: index)
        galleryView?.refresh(message: "Favorite loaded · \(saved.name)")
    }

    @objc private func toggleEvolution(_ sender: Any?) {
        if evolution.isRunning {
            let shouldRestoreStudio = editorPanel?.isHidden == false
            stopEvolution(showEditor: shouldRestoreStudio)
            galleryView?.refresh(message: "Evolution frozen at the current organism")
            return
        }
        startEvolutionForSelected()
        galleryView?.refresh(message: "Continuous evolution running")
    }

    @objc private func openGallery(_ sender: Any?) { showGallery() }
    @objc private func openStudio(_ sender: Any?) { showStudio() }

    private func showGallery() {
        if window?.desktopMode == true { window.setDesktopMode(false) }
        editorPanel?.isHidden = true
        galleryView?.isHidden = false
        galleryView?.selectFish(index: editorPanel?.selectedFishIndex ?? 0)
        galleryView?.setEvolutionActive(evolution.isRunning)
        window?.title = "BETTA — Living Gallery"
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func showStudio() {
        if window?.desktopMode == true { window.setDesktopMode(false) }
        stopEvolution(showEditor: false)
        galleryView?.isHidden = true
        editorPanel?.isHidden = false
        if let editorPanel {
            editorPanel.selectFish(index: editorPanel.selectedFishIndex, notifyRenderer: false)
        }
        window?.title = "BETTA — Living Studio"
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleDesktop(_ sender: Any?) {
        guard let window, let renderer else { return }
        if window.desktopMode {
            stopEvolution(showEditor: false)
            window.setDesktopMode(false)
            galleryView?.isHidden = true
            if let editorPanel {
                editorPanel.selectFish(index: editorPanel.selectedFishIndex, notifyRenderer: false)
            }
            editorPanel?.isHidden = false
        } else {
            _ = BettaCompositionStore.shared.save()
            _ = BettaAdvancedTuningStore.shared.save()
            _ = BettaRandomStyleStore.shared.save()
            if !evolution.isRunning { renderer.useLiveMode() }
            galleryView?.isHidden = true
            editorPanel?.isHidden = true
            window.setDesktopMode(true)
        }
    }

    private func useCurrentOnDesktop() {
        guard let window, let renderer, let editorPanel else { return }
        _ = BettaCompositionStore.shared.save()
        _ = BettaAdvancedTuningStore.shared.save()
        _ = BettaRandomStyleStore.shared.save()
        if !evolution.isRunning { renderer.setManualPreset(editorPanel.selectedFishIndex) }
        galleryView?.isHidden = true
        editorPanel.isHidden = true
        window.setDesktopMode(true)
        diagnostics.checkpoint("gallery.use-on-desktop", detail: "fish-index=\(editorPanel.selectedFishIndex)")
    }

    private func saveAndUseAsWallpaper() {
        guard let window, let renderer else { return }
        _ = BettaRandomStyleStore.shared.save()
        if !evolution.isRunning { renderer.useLiveMode() }
        galleryView?.isHidden = true
        editorPanel?.isHidden = true
        window.setDesktopMode(true)
    }

    private func startEvolutionForSelected() {
        guard let editorPanel, let renderer else { return }
        let index = editorPanel.selectedFishIndex
        let referenceId = BettaPreset.all[index].referenceId
        renderer.setManualPreset(index)

        guard evolution.start(referenceId: referenceId) else { return }
        if editorPanel.isHidden == false { editorPanel.isHidden = true }
        syncEvolutionMenuItems()
        galleryView?.setEvolutionActive(true)
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
        syncEvolutionMenuItems()
        galleryView?.setEvolutionActive(false)
        diagnostics.checkpoint(
            "evolution.stopped",
            detail: "reference-id=\(referenceId.map(String.init) ?? "unknown") target=\(targetSeed ?? "unknown")"
        )

        if showEditor, window?.desktopMode != true, let editorPanel {
            galleryView?.isHidden = true
            editorPanel.selectFish(index: editorPanel.selectedFishIndex, notifyRenderer: false)
            editorPanel.isHidden = false
        }
    }

    private func syncEvolutionMenuItems() {
        let title = evolution.isRunning ? "Stop Continuous Evolution" : "Start Continuous Evolution"
        evolutionMenuItem?.state = evolution.isRunning ? .on : .off
        evolutionMenuItem?.title = title
        statusEvolutionMenuItem?.state = evolution.isRunning ? .on : .off
        statusEvolutionMenuItem?.title = title
    }

    private func updatePresentationChrome() {
        guard let editorPanel else { return }
        let preset = BettaPreset.all[editorPanel.selectedFishIndex]
        statusItem?.button?.toolTip = "\(preset.name) · \(evolution.isRunning ? "Evolving" : "Betta")"
        galleryView?.setEvolutionActive(evolution.isRunning)

        guard let window, !window.desktopMode else { return }
        if galleryView?.isHidden == false {
            window.title = "BETTA — Living Gallery"
        } else if editorPanel.isHidden == false {
            window.title = "BETTA — Living Studio"
        } else {
            window.title = "BETTA"
        }
    }

    private func applyLaunchArguments() {
        guard let renderer else { return }
        let args = CommandLine.arguments
        if args.contains("--preview") { renderer.usePreviewMode() }
        if let fishArg = args.first(where: { $0.hasPrefix("--fish=") }), let value = Int(fishArg.split(separator: "=").last ?? ""), (1...8).contains(value) {
            selectWorkingFish(value - 1)
        }
        if args.contains("--studio") { showStudio() }
        if args.contains("--evolve") { startEvolutionForSelected() }
        if args.contains("--desktop") {
            if !evolution.isRunning { renderer.useLiveMode() }
            galleryView?.isHidden = true
            editorPanel?.isHidden = true
            window?.setDesktopMode(true)
        }
    }

    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu(title: "BETTA"); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About BETTA", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit BETTA", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let viewMenu = NSMenu(title: "View"); viewItem.submenu = viewMenu
        let gallery = NSMenuItem(title: "Open Living Gallery", action: #selector(openGallery(_:)), keyEquivalent: "g"); gallery.target = self; viewMenu.addItem(gallery)
        let studio = NSMenuItem(title: "Open Living Studio", action: #selector(openStudio(_:)), keyEquivalent: "s"); studio.target = self; viewMenu.addItem(studio)

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
        let desktop = NSMenuItem(title: "Toggle Wallpaper / Studio", action: #selector(toggleDesktop(_:)), keyEquivalent: "d"); desktop.target = self; bettaMenu.addItem(desktop)
        NSApp.mainMenu = main
    }

    private func buildStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem = item
        if let button = item.button {
            if let image = NSImage(systemSymbolName: "fish.fill", accessibilityDescription: "BETTA") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "β"
            }
            button.toolTip = "BETTA"
        }

        let menu = NSMenu(title: "BETTA")
        let gallery = NSMenuItem(title: "Open Living Gallery", action: #selector(openGallery(_:)), keyEquivalent: "")
        gallery.target = self; menu.addItem(gallery)
        let studio = NSMenuItem(title: "Open Living Studio", action: #selector(openStudio(_:)), keyEquivalent: "")
        studio.target = self; menu.addItem(studio)
        menu.addItem(.separator())

        let random = NSMenuItem(title: "Random Betta", action: #selector(randomizeBetta(_:)), keyEquivalent: "")
        random.target = self; menu.addItem(random)
        let evolutionItem = NSMenuItem(title: "Start Continuous Evolution", action: #selector(toggleEvolution(_:)), keyEquivalent: "")
        evolutionItem.target = self; menu.addItem(evolutionItem)
        statusEvolutionMenuItem = evolutionItem
        let desktop = NSMenuItem(title: "Use Current on Desktop", action: #selector(useCurrentOnDesktopFromMenu(_:)), keyEquivalent: "")
        desktop.target = self; menu.addItem(desktop)
        menu.addItem(.separator())

        let live = NSMenuItem(title: "Live Bangkok Cycle", action: #selector(useLive(_:)), keyEquivalent: "")
        live.target = self; menu.addItem(live)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit BETTA", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quit)
        item.menu = menu
    }

    @objc private func useCurrentOnDesktopFromMenu(_ sender: Any?) { useCurrentOnDesktop() }

    private func presentFailure(_ error: Error) {
        diagnostics.checkpoint("failure.ui.begin")
        let frame = window?.contentView?.bounds ?? NSRect(x: 0, y: 0, width: 900, height: 680)
        let failureView = BettaFailureView(frame: frame, error: error, diagnostics: diagnostics)
        failureView.autoresizingMask = [.width, .height]
        window.contentView = failureView
        window.title = "BETTA — Diagnostic Report"
        window.minSize = NSSize(width: 780, height: 620)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        diagnostics.checkpoint("failure.ui.visible")
        diagnostics.markFailureUIReady()
    }
}
