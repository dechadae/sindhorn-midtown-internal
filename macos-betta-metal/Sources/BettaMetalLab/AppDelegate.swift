import AppKit
import MetalKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: BettaDesktopWindow!
    private var metalView: MTKView!
    private var renderer: BettaRenderer!
    private var editorPanel: BettaCompositionEditorPanel!
    private var titleTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let screen = NSScreen.main ?? NSScreen.screens.first
        let initialFrame = screen?.visibleFrame.insetBy(dx: (screen?.visibleFrame.width ?? 1200) * 0.05, dy: (screen?.visibleFrame.height ?? 800) * 0.05)
            ?? NSRect(x: 100, y: 100, width: 1280, height: 800)

        window = BettaDesktopWindow(contentRect: initialFrame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 900, height: 650)
        window.title = "Sindhorn Betta Metal Lab"
        window.backgroundColor = .black

        let root = NSView(frame: window.contentView?.bounds ?? initialFrame)
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor
        window.contentView = root

        metalView = MTKView(frame: root.bounds)
        metalView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(metalView)
        NSLayoutConstraint.activate([
            metalView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            metalView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            metalView.topAnchor.constraint(equalTo: root.topAnchor),
            metalView.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        do { renderer = try BettaRenderer(view: metalView) }
        catch { presentFatal(error); return }

        let currentIndex = BettaMorphState.bangkokIndex(for: Date())
        editorPanel = BettaCompositionEditorPanel(initialIndex: currentIndex)
        editorPanel.onSelectFish = { [weak self] index in self?.renderer.setManualPreset(index) }
        editorPanel.onSaveAndUse = { [weak self] in self?.saveAndUseAsWallpaper() }
        root.addSubview(editorPanel)
        NSLayoutConstraint.activate([
            editorPanel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18),
            editorPanel.topAnchor.constraint(equalTo: root.topAnchor, constant: 18)
        ])

        applyLaunchArguments()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        titleTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, !self.window.desktopMode else { return }
            self.window.title = "Sindhorn Betta Metal Lab · \(self.renderer.statusText)"
        }
    }

    func applicationWillTerminate(_ notification: Notification) { titleTimer?.invalidate(); metalView?.isPaused = true }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func windowWillClose(_ notification: Notification) { if !window.desktopMode { NSApp.terminate(nil) } }

    @objc private func selectFish(_ sender: NSMenuItem) {
        editorPanel.selectFish(index: sender.tag)
    }

    @objc private func useLive(_ sender: Any?) { renderer.useLiveMode() }
    @objc private func usePreview(_ sender: Any?) { renderer.usePreviewMode() }
    @objc private func nextFish(_ sender: Any?) {
        let next = min(7, max(0, editorPanelIndexOffset(1)))
        editorPanel.selectFish(index: next)
    }
    @objc private func previousFish(_ sender: Any?) {
        let previous = min(7, max(0, editorPanelIndexOffset(-1)))
        editorPanel.selectFish(index: previous)
    }

    @objc private func toggleDesktop(_ sender: Any?) {
        if window.desktopMode {
            window.setDesktopMode(false)
            setEditorVisible(true)
        } else {
            _ = BettaCompositionStore.shared.save()
            renderer.useLiveMode()
            setEditorVisible(false)
            window.setDesktopMode(true)
        }
    }

    private func editorPanelIndexOffset(_ delta: Int) -> Int {
        let current = BettaMorphState.bangkokIndex(for: Date())
        return (current + delta + 8) % 8
    }

    private func saveAndUseAsWallpaper() {
        renderer.useLiveMode()
        setEditorVisible(false)
        window.setDesktopMode(true)
    }

    private func setEditorVisible(_ visible: Bool) {
        editorPanel.isHidden = !visible
    }

    private func applyLaunchArguments() {
        let args = CommandLine.arguments
        if args.contains("--preview") { renderer.usePreviewMode() }
        if let fishArg = args.first(where: { $0.hasPrefix("--fish=") }), let value = Int(fishArg.split(separator: "=").last ?? ""), (1...8).contains(value) {
            editorPanel.selectFish(index: value - 1)
        }
        if args.contains("--desktop") {
            renderer.useLiveMode()
            setEditorVisible(false)
            window.setDesktopMode(true)
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

    private func presentFatal(_ error: Error) {
        let alert = NSAlert(); alert.alertStyle = .critical; alert.messageText = "Betta Metal Lab could not start"; alert.informativeText = error.localizedDescription; alert.addButton(withTitle: "Quit"); alert.runModal(); NSApp.terminate(nil)
    }
}
