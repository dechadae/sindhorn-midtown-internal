import AppKit
import Security
import Metal
import QuartzCore

/// The explorer: randomize, glance, keep or no - and the frame you are
/// looking at can become the desktop, still or live, with one key.
///
/// This is the phone's Betta Explorer on the Mac. The judge (`--judge`) was
/// an experiment with a frozen log; this is a product that records, so its
/// verdicts go to `betta_verdicts` alongside the phone's, with `device` set
/// to `macos-metal/<build>`, and its files live under Application Support.
///
/// Arm C only, the IDUI constitution. The framing alternates, in shuffled
/// pairs, between one of the owner's eight locked crops and a crop derived
/// from the seed; the row records which, in `framing`, the way the judge's
/// log did. The generator makes no appearance decision: the seed and the
/// constitution fully determine the picture.
final class Explorer: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let constitution: Constitution
    private let locked: [Int: Composition]
    private let lockedIds: [Int]
    private let renderer: EngineRenderer
    private let store = VerdictStore()
    private let archive = WallpaperArchive()
    private let files: FrameFiles
    private let live: LiveWallpaper

    private var window: NSWindow!
    private var metalLayer: CAMetalLayer!
    private var archiveWindow: NSWindow?
    private var statusItem: NSStatusItem!
    private var statusMenu = NSMenu()
    /// Filled on open, so a style kept a minute ago is already in the list.
    private var stylesMenu = NSMenu(title: "Studio Styles")
    /// The studio, while it is open. Held here or it would deallocate.
    private var studio: StudioWindow?

    private var frame = FrameRef(seed: "0", composition: "r")
    private var style: GeneratedStyle
    private var composition: Composition = .neutralLandscape
    private var phase: Double = 0
    private var lastTick = CFAbsoluteTimeGetCurrent()
    private var paused = false
    private var framingBag: [Bool] = []
    /// True when the frame on screen was typed in rather than drawn.
    private var lookedUp = false
    private var notice = ""
    private var noticeUntil: CFAbsoluteTime = 0
    private var lastTitle = ""
    private var inFlight = false

    init(constitution: Constitution) throws {
        self.constitution = constitution
        let loaded = try LockedCompositions.load()
        locked = loaded
        lockedIds = loaded.keys.sorted()
        renderer = try EngineRenderer(rays: 320, segments: 288, sampleCount: 4, pixelFormat: .bgra8Unorm)
        files = FrameFiles(locked: loaded)
        live = LiveWallpaper(renderer: renderer, locked: loaded, constitution: constitution)
        style = SeedSampler.generate(seed: 0, constitution: constitution)
        super.init()
    }

    func run() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = self
        app.run()
    }

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        buildStatusItem()

        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.handle(event) == true ? nil : event
        }
        let t = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(t, forMode: .common)
        let f = Timer(timeInterval: 60, repeats: true) { [weak self] _ in self?.store.flush() }
        RunLoop.main.add(f, forMode: .common)

        live.onChange = { [weak self] in self?.liveChanged() }
        store.onSent = { [weak self] sent, left in
            print("sent \(sent) verdict\(sent == 1 ? "" : "s")\(left > 0 ? ", \(left) still queued" : "")")
            self?.updateTitle()
        }
        live.restore()
        nextRandom()
        store.flush()
        print(help)
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        if archiveWindow?.isKeyWindow != true, window.isVisible { window.makeKey() }
        store.flush()
    }

    /// Closing the explorer while the desktop is live leaves the desktop live;
    /// the status item and the Dock icon bring the window back.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        !live.isOn
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showExplorer()
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("quit · \(store.judged) judged · \(store.pending) queued · live \(live.isOn ? "on, resumes at launch" : "off")")
    }

    private var help: String {
        """

        EXPLORE
        k              keep this one
        space  or  ⏎   no - move on (this counts as a reject)
        u              undo the last verdict and bring the frame back
        s              save a 5120x2880 still to Application Support/Betta Explorer/stills
        w              set this frame as the desktop picture on this display   (⇧W all displays)
        l              set this frame live on the desktop                      (⇧L stop live)
        ⌘N             open this frame in the studio and ask for a change
        g              go to a seed or a studio style  (⌘G; [ ] then walk the crops)
        a              wallpapers you've used
        .              pause the motion
        q              quit  (the live desktop comes back at next launch)

        studio styles are in the Explore menu; a style set live survives a quit

        files:  \(ExplorerStorage.root.path)

        """
    }

    private func buildWindow() {
        let screen = NSScreen.main ?? NSScreen.screens[0]
        let aspect = screen.frame.width / screen.frame.height
        let width = min(1440, screen.visibleFrame.width - 80)
        let rect = NSRect(x: 0, y: 0, width: width, height: (width / aspect).rounded())
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.contentAspectRatio = rect.size
        window.center()

        metalLayer = CAMetalLayer()
        metalLayer.device = renderer.device
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true

        let view = NSView(frame: rect)
        view.wantsLayer = true
        view.layer = metalLayer
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func item(_ title: String, _ action: Selector, _ key: String, _ mods: NSEvent.ModifierFlags = []) -> NSMenuItem {
        let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
        i.keyEquivalentModifierMask = mods
        i.target = self
        return i
    }

    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(item("Show Explorer", #selector(showExplorer), "1", .command))
        appMenu.addItem(.separator())
        appMenu.addItem(item("Quit Betta Explorer", #selector(NSApplication.terminate(_:)), "q", .command))
        appMenu.items.last?.target = nil
        appItem.submenu = appMenu

        let exploreItem = NSMenuItem(title: "Explore", action: nil, keyEquivalent: ""); main.addItem(exploreItem)
        let explore = NSMenu(title: "Explore")
        explore.addItem(item("Keep", #selector(keep), "k"))
        explore.addItem(item("No — Next", #selector(reject), " "))
        explore.addItem(item("Undo Last Verdict", #selector(undo), "u"))
        explore.addItem(item("Pause Motion", #selector(togglePause), "."))
        explore.addItem(.separator())
        explore.addItem(item("Save Still", #selector(saveStill), "s"))
        explore.addItem(item("Set as Desktop Picture", #selector(setDesktopHere), "w"))
        explore.addItem(item("Set as Desktop Picture on All Displays", #selector(setDesktopAll), "W", .shift))
        explore.addItem(item("Set Live on Desktop", #selector(setLive), "l"))
        explore.addItem(item("Stop Live", #selector(stopLive), "L", .shift))
        explore.addItem(.separator())
        explore.addItem(item("Open in Studio…", #selector(openStudio), "n", .command))
        explore.addItem(item("Go to Seed or Style…", #selector(goToSeed), "g", .command))
        let styles = NSMenuItem(title: "Studio Styles", action: nil, keyEquivalent: "")
        stylesMenu.delegate = self
        styles.submenu = stylesMenu
        explore.addItem(styles)
        explore.addItem(item("Wallpapers You've Used…", #selector(showArchive), "a"))
        exploreItem.submenu = explore

        let windowItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: ""); main.addItem(windowItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(NSMenuItem(title: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"))
        windowMenu.addItem(NSMenuItem(title: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        windowItem.submenu = windowMenu
        NSApp.mainMenu = main
        NSApp.windowsMenu = windowMenu
    }

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemSymbolName: "circle.circle", accessibilityDescription: "Betta Explorer")
        statusMenu.delegate = self
        statusItem.menu = statusMenu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        if menu === stylesMenu {
            menu.removeAllItems()
            let records = StyleStore.all()
            guard !records.isEmpty else {
                let empty = NSMenuItem(title: "None yet — the studio writes them", action: nil, keyEquivalent: "")
                empty.isEnabled = false
                menu.addItem(empty)
                return
            }
            for record in records {
                let entry = item(record.prompt, #selector(showStyle(_:)), "")
                entry.representedObject = record.id
                menu.addItem(entry)
            }
            return
        }
        guard menu === statusMenu else { return }
        menu.removeAllItems()
        if let f = live.frame {
            let line = NSMenuItem(title: "Live: seed \(f.seed) · crop \(f.composition)", action: nil, keyEquivalent: "")
            line.isEnabled = false
            menu.addItem(line)
        } else {
            let line = NSMenuItem(title: "Desktop not live", action: nil, keyEquivalent: "")
            line.isEnabled = false
            menu.addItem(line)
        }
        menu.addItem(.separator())
        menu.addItem(item("Show Explorer", #selector(showExplorer), ""))
        menu.addItem(item("Open in Studio…", #selector(openStudio), ""))
        menu.addItem(item("Go to Seed or Style…", #selector(goToSeed), ""))
        if live.isOn { menu.addItem(item("Stop Live", #selector(stopLive), "")) }
        menu.addItem(item("Wallpapers You've Used…", #selector(showArchive), ""))
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Betta Explorer", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        menu.addItem(quit)
    }

    // MARK: - Frames

    private func show(_ f: FrameRef, lookedUp: Bool = false) {
        frame = f
        self.lookedUp = lookedUp
        style = f.resolveStyle(constitution: constitution)
        composition = f.resolveComposition(locked: locked)
        phase = 0
        updateTitle()
    }

    /// Opens the studio on the frame currently on screen.
    ///
    /// The explorer finds; the studio asks. Handing it the frame rather than a
    /// blank page is the point: a seed the owner has just looked at and liked
    /// is exactly what they want to change one thing about.
    @objc private func openStudio() {
        if let studio {
            studio.present()
            return
        }
        do {
            let room = try StudioWindow(
                applied: Studio.Applied(
                    name: frame.identity,
                    prompt: frame.style.flatMap { StyleStore.load(id: $0)?.prompt }
                        ?? "seed \(frame.seed)",
                    style: style, changed: [], unknown: [],
                    contracts: Contracts.evaluate(style: style, constitution: constitution)
                ),
                compositionId: Int(frame.composition),
                stillDirectory: ExplorerStorage.root.appendingPathComponent("stills", isDirectory: true),
                constitution: constitution,
                seed: frame.seedValue ?? 0
            )
            // A kept style comes straight back to the explorer, so W and L
            // work on it without going looking for it in a menu.
            room.onKeep = { [weak self] record in
                guard let self else { return }
                self.show(FrameRef(seed: record.seed, composition: self.frame.composition,
                                   style: record.id), lookedUp: true)
                self.say("Kept — W for the desktop, L for live")
            }
            studio = room
            room.present()
        } catch {
            say("The studio could not open: \(error.localizedDescription)")
        }
    }

    // MARK: - Going to a seed

    /// Every wallpaper the app has ever shown is a seed and a crop, and both
    /// reproduce exactly - so a seed written down anywhere (a row in the
    /// table, the archive, a note) can be brought back here and set live.
    ///
    /// A frame reached this way is marked `lookedUp`, and a looked-up frame is
    /// never judged: the verdict table is a record of frames the constitution
    /// drew at random, and a seed the owner typed in is not one of those. It
    /// can still be saved, set as the desktop picture, or set live - those say
    /// nothing about taste.
    @objc private func goToSeed() {
        let alert = NSAlert()
        alert.messageText = "Go to a seed"
        alert.informativeText = "Type a seed number. Add a crop after it — 1 to 8 for one of your locked crops, or r for the one the seed derives — otherwise the crop on screen is kept."
        alert.addButton(withTitle: "Show")
        alert.addButton(withTitle: "Cancel")

        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        input.placeholderString = "9115462473253262005 8"
        input.stringValue = "\(frame.seed) \(frame.composition)"
        alert.accessoryView = input
        alert.window.initialFirstResponder = input

        guard alert.runModal() == .alertFirstButtonReturn else { return }

        // Tolerant of what a seed looks like when it has been carried by hand:
        // commas from a spreadsheet, tabs from a table, quotes from JSON.
        let cleaned = input.stringValue
            .replacingOccurrences(of: ",", with: " ")
            .replacingOccurrences(of: "\"", with: " ")
        let tokens = cleaned.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard let first = tokens.first else { return }

        // A studio style's id is hex and a seed is decimal, so one field takes
        // either without asking which it is.
        var styleId: String? = nil
        var seedText = first
        if UInt64(first) == nil || StyleStore.exists(first) {
            guard let record = StyleStore.load(id: first) else {
                say(UInt64(first) == nil ? "No style \(first)" : "Not a seed number")
                NSSound.beep()
                return
            }
            styleId = record.id
            seedText = record.seed
        }

        var crop = frame.composition
        if tokens.count > 1 {
            let asked = tokens[1].lowercased()
            if asked == "r" {
                crop = "r"
            } else if let id = Int(asked), locked[id] != nil {
                crop = String(id)
            } else {
                say("No crop \(tokens[1]) — showing crop \(crop)")
            }
        }
        show(FrameRef(seed: seedText, composition: crop, style: styleId), lookedUp: true)
        say(styleId.map { "Style \($0) · crop \(crop)" } ?? "Seed \(seedText) · crop \(crop)")
    }

    /// The studio's kept styles, newest first. A style is not a seed and the
    /// explorer cannot draw one, so this is how a patched picture gets back
    /// on screen - and from here W and L put it on the desktop.
    @objc private func showStyle(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String,
              let record = StyleStore.load(id: id) else { return }
        show(FrameRef(seed: record.seed, composition: "8", style: record.id), lookedUp: true)
        say(record.prompt)
    }

    /// Walks a looked-up seed through the eight locked crops and its own
    /// derived one, so the seed can be seen in every frame it might wear
    /// before one is set live. Only for looked-up frames: the explorer's own
    /// framing alternation is what keeps the verdict table balanced.
    private func cycleCrop(_ step: Int) {
        guard lookedUp else { return }
        let wheel = lockedIds.map(String.init) + ["r"]
        let at = wheel.firstIndex(of: frame.composition) ?? 0
        let next = wheel[(at + step + wheel.count) % wheel.count]
        show(FrameRef(seed: frame.seed, composition: next), lookedUp: true)
        say("Crop \(next)")
    }

    /// A fresh seed, and the next framing from the bag: locked and derived,
    /// one each per pair, in a random order - like the judge's arm rotation.
    private func nextRandom() {
        var bytes: UInt64 = 0
        _ = withUnsafeMutableBytes(of: &bytes) { SecRandomCopyBytes(kSecRandomDefault, 8, $0.baseAddress!) }
        if framingBag.isEmpty { framingBag = [true, false].shuffled() }
        let useLocked = framingBag.removeFirst()
        let label = useLocked ? String(lockedIds.randomElement() ?? 1) : "r"
        show(FrameRef(seed: String(bytes), composition: label))
    }

    private var aspect: Double {
        let size = window.contentView?.bounds.size ?? CGSize(width: 16, height: 9)
        return Double(size.width / max(size.height, 1))
    }

    private func verdict(_ v: String) {
        store.record(frame: frame, verdict: v, constitutionVersion: constitution.version, aspect: aspect)
        print(String(format: "%4d judged   %3d kept   %3d%%   seed %@  crop %@  %@",
                     store.judged, store.kept, store.rate, frame.seed, frame.composition, v))
        nextRandom()
    }

    @objc private func keep() {
        guard explorerIsKey else { return }
        // A typed seed is not a draw from the constitution, so it is not
        // evidence about the constitution. Say so rather than record it.
        guard !lookedUp else { say("Typed seed — not judged. Space returns to exploring"); return }
        verdict("keep")
    }

    @objc private func reject() {
        guard explorerIsKey else { return }
        // The same key that means "no" means "back to exploring" while a
        // looked-up seed is on screen; nothing is recorded either way.
        guard !lookedUp else { nextRandom(); return }
        verdict("reject")
    }

    @objc private func undo() {
        guard explorerIsKey, let row = store.undo() else { return }
        print("undone: \(row.seed) \(row.verdict)")
        show(FrameRef(seed: row.seed, composition: row.framing))
        say("Undone — judge again")
    }

    @objc private func togglePause() {
        paused.toggle()
        updateTitle()
    }

    /// Verdict keys count only while the explorer is the window in front. A
    /// key pressed in the archive, or typed into the studio's rail, must not
    /// judge a frame no one is looking at.
    private var explorerIsKey: Bool { window?.isKeyWindow == true }

    // MARK: - The desktop

    @objc private func saveStill() {
        let f = frame, s = style, p = phase
        let stamp = String(Int(Date().timeIntervalSince1970))
        do {
            let url = try files.writeStill(f, style: s, phase: p, width: 5120, height: 2880,
                                           into: "stills", suffix: "-\(stamp)")
            NSWorkspace.shared.activateFileViewerSelecting([url])
            say("Still saved")
            print("saved \(url.path)")
        } catch {
            say("Still failed: \(error)")
        }
    }

    @objc private func setDesktopHere() { setDesktop(all: false) }
    @objc private func setDesktopAll() { setDesktop(all: true) }

    private func setDesktop(all: Bool) {
        let screens = all ? NSScreen.screens : [window.screen ?? NSScreen.main ?? NSScreen.screens[0]]
        do {
            _ = try DesktopPicture.set(frame, style: style, phase: phase, files: files, screens: screens)
            // A still replaces the live desktop, as the phone's system does
            // when a static wallpaper is set over a live one.
            if live.isOn { live.stop() }
            record(frame, kind: "still")
            say(all ? "Desktop picture set on all displays" : "Desktop picture set")
        } catch {
            say("Couldn't set the desktop picture: \(error)")
        }
    }

    @objc private func setLive() {
        live.show(frame)
        record(frame, kind: "live")
        say("Live on the desktop")
    }

    @objc private func stopLive() {
        guard live.isOn else { return }
        live.stop()
        say("Live desktop stopped")
    }

    /// The phone archives a seed when the engine shows it and it is not the
    /// latest already, so setting the same one twice keeps its first date.
    private func record(_ f: FrameRef, kind: String) {
        if let latest = archive.latest, latest.seed == f.seed, latest.kind == kind { return }
        archive.record(f, kind: kind)
        refreshArchive()
    }

    private func liveChanged() {
        updateTitle()
        refreshArchive()
    }

    @objc private func showExplorer() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - Wallpapers you've used

    private final class FlippedView: NSView {
        override var isFlipped: Bool { true }
    }

    private let thumbWidth: CGFloat = 240
    private let gap: CGFloat = 16
    private let columns = 3

    @objc private func showArchive() {
        if archiveWindow == nil {
            let width = CGFloat(columns) * thumbWidth + CGFloat(columns + 1) * gap
            let w = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: width, height: 620),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered, defer: false
            )
            w.title = "Wallpapers you've used"
            w.isReleasedWhenClosed = false
            w.minSize = NSSize(width: width, height: 300)
            w.maxSize = NSSize(width: width, height: 4000)
            let scroll = NSScrollView(frame: w.contentView!.bounds)
            scroll.autoresizingMask = [.width, .height]
            scroll.hasVerticalScroller = true
            scroll.documentView = FlippedView(frame: .zero)
            w.contentView = scroll
            archiveWindow = w
        }
        archiveWindow?.center()
        archiveWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        refreshArchive()
    }

    private func refreshArchive() {
        guard let w = archiveWindow, w.isVisible || w.isKeyWindow,
              let scroll = w.contentView as? NSScrollView,
              let doc = scroll.documentView else { return }
        doc.subviews.forEach { $0.removeFromSuperview() }
        let entries = archive.entries
        let aspect = (NSScreen.main ?? NSScreen.screens[0]).frame.width / (NSScreen.main ?? NSScreen.screens[0]).frame.height
        let thumbHeight = (thumbWidth / aspect).rounded()
        let cellHeight = thumbHeight + 22

        if entries.isEmpty {
            let empty = NSTextField(labelWithString: "Nothing yet. Press W or L in the explorer and the frame lands here.")
            empty.textColor = .secondaryLabelColor
            empty.frame = NSRect(x: gap, y: gap, width: scroll.bounds.width - 2 * gap, height: 20)
            doc.addSubview(empty)
            doc.frame = NSRect(x: 0, y: 0, width: scroll.bounds.width, height: 60)
            return
        }

        for (i, e) in entries.enumerated() {
            let col = i % columns, row = i / columns
            let x = gap + CGFloat(col) * (thumbWidth + gap)
            let y = gap + CGFloat(row) * (cellHeight + gap)
            let button = NSButton(frame: NSRect(x: x, y: y, width: thumbWidth, height: thumbHeight))
            button.isBordered = false
            button.imagePosition = .imageOnly
            button.imageScaling = .scaleProportionallyUpOrDown
            button.title = ""
            button.tag = i
            button.target = self
            button.action = #selector(archiveTapped(_:))
            button.wantsLayer = true
            button.layer?.backgroundColor = NSColor.black.cgColor
            let entryStyle = e.frame.resolveStyle(constitution: constitution)
            button.image = files.thumbnail(e.frame, style: entryStyle, aspect: Double(aspect))
            doc.addSubview(button)

            let caption = NSTextField(labelWithString: archive.caption(for: e, liveSeed: live.frame?.identity))
            caption.font = .systemFont(ofSize: 11)
            caption.textColor = caption.stringValue == "live now" ? .controlAccentColor : .secondaryLabelColor
            caption.frame = NSRect(x: x, y: y + thumbHeight + 4, width: thumbWidth, height: 16)
            doc.addSubview(caption)
        }
        let rows = (entries.count + columns - 1) / columns
        doc.frame = NSRect(x: 0, y: 0, width: scroll.bounds.width,
                           height: gap + CGFloat(rows) * (cellHeight + gap))
    }

    @objc private func archiveTapped(_ sender: NSButton) {
        guard sender.tag < archive.entries.count, let w = archiveWindow else { return }
        let entry = archive.entries[sender.tag]
        let alert = NSAlert()
        alert.messageText = "Seed \(entry.seed) · crop \(entry.composition)"
        alert.informativeText = archive.caption(for: entry, liveSeed: live.frame?.identity)
        alert.addButton(withTitle: "Show in Explorer")
        alert.addButton(withTitle: "Set Live")
        alert.addButton(withTitle: "Set as Desktop Picture")
        alert.addButton(withTitle: "Remove")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: w) { [weak self] response in
            guard let self else { return }
            switch response {
            case .alertFirstButtonReturn:
                self.show(entry.frame)
                self.showExplorer()
            case .alertSecondButtonReturn:
                self.live.show(entry.frame)
                self.record(entry.frame, kind: "live")
            case .alertThirdButtonReturn:
                self.show(entry.frame)
                self.setDesktop(all: true)
            case NSApplication.ModalResponse(rawValue: 1003):
                self.archive.remove(seed: entry.seed)
                self.refreshArchive()
            default:
                break
            }
        }
    }

    // MARK: - Keys

    private func handle(_ event: NSEvent) -> Bool {
        guard explorerIsKey, !event.modifierFlags.contains(.command) else { return false }
        let shift = event.modifierFlags.contains(.shift)
        switch event.keyCode {
        case 40: keep(); return true                              // k
        case 36, 49: reject(); return true                         // return / space
        case 32: undo(); return true                               // u
        case 1: saveStill(); return true                           // s
        case 13: shift ? setDesktopAll() : setDesktopHere(); return true   // w
        case 37: shift ? stopLive() : setLive(); return true       // l
        case 0: showArchive(); return true                         // a
        case 5: goToSeed(); return true                            // g
        case 33: cycleCrop(-1); return true                        // [
        case 30: cycleCrop(1); return true                         // ]
        case 47: togglePause(); return true                        // .
        case 15: phase = 0; return true                            // r
        case 12: NSApp.terminate(nil); return true                 // q
        default: return false
        }
    }

    // MARK: - Title and clock

    private func say(_ text: String) {
        notice = text
        noticeUntil = CFAbsoluteTimeGetCurrent() + 3
        print(text)
        updateTitle()
    }

    private func titleText() -> String {
        var parts = ["\(store.judged) judged · \(store.kept) kept · \(store.rate)%"]
        let pending = store.pending
        if pending > 0 { parts.append("\(pending) to send") }
        if let f = live.frame { parts.append("live: \(f.seed.prefix(6))…") }
        if paused { parts.append("paused") }
        if !notice.isEmpty, CFAbsoluteTimeGetCurrent() < noticeUntil { parts.append(notice) }
        else if lookedUp {
            parts.append("seed \(frame.seed) · crop \(frame.composition)")
            parts.append("[ ] crops · W desktop · L live · space back to exploring")
        }
        else { parts.append("K keep · space = no · U undo · G seed · W desktop · L live · A used") }
        return parts.joined(separator: "   ·   ")
    }

    private func updateTitle() {
        let t = titleText()
        if t != lastTitle {
            lastTitle = t
            window?.title = t
        }
    }

    private func tick() {
        let now = CFAbsoluteTimeGetCurrent()
        let visible = window.isVisible && !window.isMiniaturized && window.occlusionState.contains(.visible)
        guard visible else { lastTick = now; return }
        let delta = min(now - lastTick, 0.05)
        lastTick = now
        if !paused { phase += delta * style.motionSpeed * 6.0 }
        if !notice.isEmpty, now >= noticeUntil { notice = ""; updateTitle() }

        guard !inFlight else { return }
        let scale = window.backingScaleFactor
        let size = window.contentView!.bounds.size
        metalLayer.drawableSize = CGSize(width: size.width * scale, height: size.height * scale)
        guard let drawable = metalLayer.nextDrawable() else { return }
        let surface = Surface(name: "explorer", width: drawable.texture.width, height: drawable.texture.height)
        inFlight = true
        renderer.present(style: style, surface: surface, phase: phase, composition: composition,
                         drawable: drawable) { [weak self] in self?.inFlight = false }
    }
}
