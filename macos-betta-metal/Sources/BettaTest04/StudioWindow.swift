import AppKit
import Foundation
import QuartzCore

/// The room: the style moving, and a rail to talk to it.
///
/// The explorer is a place to judge what the constitution drew. This is a
/// place to ask for something. A sentence goes to a `Translator`, comes back
/// as numbers, is laid over the style on screen, judged by the same contracts
/// and drawn by the same engine - and every turn stays on the rail, so going
/// back is picking an earlier turn rather than undoing a step.
///
/// Nothing here is a model. The translator behind the rail is `LocalTranslator`
/// until the Edge Function exists; the room cannot tell the difference, which
/// is the point of the seam.
final class StudioWindow: NSObject, NSApplicationDelegate, NSTextFieldDelegate {
    // MARK: - State

    /// One point in the conversation: the words, and the style they produced.
    private struct Step {
        let label: String
        let detail: String
        let style: GeneratedStyle
        let contracts: ContractResult
    }

    private let constitution: Constitution
    private let translator: Translator
    private let renderer: EngineRenderer
    private let locked: [Int: Composition]
    private let lockedIds: [Int]
    private let stillDirectory: URL
    private let seed: String
    private let openingPrompt: String?

    private var steps: [Step] = []
    private var at = 0
    private var compositionIndex: Int

    private var window: NSWindow!
    private var metalLayer: CAMetalLayer!
    private var stage: NSView!
    private var rail: NSView!
    private var transcript: NSStackView!
    private var scroller: NSScrollView!
    private var input: NSTextField!
    private var footer: NSTextField!

    private var phase: Double = 0
    private var paused = false
    /// Whether the studio is shown the frame as well as told about it. Off by
    /// default: a picture costs more than a sentence, and the difference is
    /// the owner's to spend. Remembered between sittings.
    private var seeing = UserDefaults.standard.bool(forKey: "studio.seeing")
    private var lastTick = CFAbsoluteTimeGetCurrent()
    private var inFlight = false

    private var current: Step { steps[at] }

    /// The model when the owner has put a token in the Keychain, the local
    /// parser when not. The room cannot tell which it has beyond the name it
    /// prints, which is the whole point of the seam.
    static func translator(constitution: Constitution) -> Translator {
        guard let token = StudioToken.read() else { return LocalTranslator() }
        return RemoteTranslator(endpoint: StudioToken.endpoint, token: token,
                                glossaryVersion: constitution.version)
    }

    init(applied: Studio.Applied, compositionId: Int?, stillDirectory: URL,
         constitution: Constitution, seed: UInt64,
         translator: Translator? = nil) throws {
        self.constitution = constitution
        self.translator = translator ?? Self.translator(constitution: constitution)
        self.stillDirectory = stillDirectory
        self.seed = String(seed)
        self.openingPrompt = applied.prompt
        let loaded = try LockedCompositions.load()
        let ids = loaded.keys.sorted()
        locked = loaded
        lockedIds = ids
        compositionIndex = compositionId.flatMap { ids.firstIndex(of: $0) } ?? 0
        renderer = try EngineRenderer(rays: 320, segments: 288, sampleCount: 4, pixelFormat: .bgra8Unorm)
        super.init()
        steps = [Step(
            label: applied.prompt ?? applied.name,
            detail: applied.changed.isEmpty ? "the seed, unpatched" : "\(applied.changed.count) fields",
            style: applied.style, contracts: applied.contracts
        )]
    }

    /// Told when a style is kept, so the explorer can jump to it and put it
    /// on the desktop without the owner going looking.
    var onKeep: ((StyleRecord) -> Void)?

    /// Runs the studio as the whole application - the command line's path.
    func run() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = self
        app.run()
    }

    /// Opens the studio inside an app that is already running - the explorer's
    /// path. Same window, same keys; it simply does not own the process.
    func present() {
        build()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        window.makeFirstResponder(input)
    }

    private var composition: Composition {
        locked[lockedIds[compositionIndex]] ?? .neutralLandscape
    }

    // MARK: - Building the room

    func applicationDidFinishLaunching(_ notification: Notification) {
        present()
    }

    private func build() {
        let rect = NSRect(x: 0, y: 0, width: 1500, height: 760)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered, defer: false
        )
        window.minSize = NSSize(width: 900, height: 520)
        window.center()

        let root = RoomView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

        stage = NSView()
        stage.wantsLayer = true
        metalLayer = CAMetalLayer()
        metalLayer.device = renderer.device
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true
        stage.layer = metalLayer

        rail = buildRail()
        root.stage = stage
        root.rail = rail
        root.addSubview(stage)
        root.addSubview(rail)
        window.contentView = root

        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.handle(event) == true ? nil : event
        }
        Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        refresh()
        print("""

        STUDIO  \(openingPrompt ?? seed)   ·   translator: \(translator.name)
        Type into the rail: "more translucent", "slower", or a field by name - "opacity .42".
        Click any earlier turn to go back to it.
        ⌘[ ⌘]  crops   ⌘K  keep   ⌘S  5K still   ⌘I  let it see the frame   ⌘.  pause

        """)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    /// Stage on the left at 16:9, rail pinned right - laid out by hand because
    /// the stage's aspect is the wallpaper's aspect and must not stretch.
    private final class RoomView: NSView {
        var stage: NSView?
        var rail: NSView?
        static let railWidth: CGFloat = 360

        override func layout() {
            super.layout()
            guard let stage, let rail else { return }
            let railX = bounds.width - Self.railWidth
            rail.frame = NSRect(x: railX, y: 0, width: Self.railWidth, height: bounds.height)
            let area = NSRect(x: 0, y: 0, width: railX, height: bounds.height).insetBy(dx: 16, dy: 16)
            let side = min(area.width, area.height * 16 / 9)
            let size = NSSize(width: side, height: (side * 9 / 16).rounded())
            stage.frame = NSRect(
                x: area.minX + ((area.width - size.width) / 2).rounded(),
                y: area.minY + ((area.height - size.height) / 2).rounded(),
                width: size.width, height: size.height
            )
        }
    }

    private func buildRail() -> NSView {
        let rail = NSView()
        rail.wantsLayer = true
        rail.layer?.backgroundColor = NSColor.underPageBackgroundColor.cgColor

        transcript = NSStackView()
        transcript.orientation = .vertical
        transcript.alignment = .leading
        transcript.spacing = 6
        transcript.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        transcript.translatesAutoresizingMaskIntoConstraints = false

        scroller = NSScrollView()
        scroller.hasVerticalScroller = true
        scroller.drawsBackground = false
        scroller.documentView = transcript
        scroller.translatesAutoresizingMaskIntoConstraints = false

        input = NSTextField()
        input.placeholderString = "more translucent, slower…"
        input.delegate = self
        input.target = self
        input.action = #selector(send)
        input.translatesAutoresizingMaskIntoConstraints = false

        footer = NSTextField(labelWithString: "")
        footer.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        footer.textColor = .secondaryLabelColor
        footer.lineBreakMode = .byWordWrapping
        footer.maximumNumberOfLines = 4
        footer.translatesAutoresizingMaskIntoConstraints = false

        rail.addSubview(scroller)
        rail.addSubview(input)
        rail.addSubview(footer)
        NSLayoutConstraint.activate([
            scroller.topAnchor.constraint(equalTo: rail.topAnchor),
            scroller.leadingAnchor.constraint(equalTo: rail.leadingAnchor),
            scroller.trailingAnchor.constraint(equalTo: rail.trailingAnchor),
            scroller.bottomAnchor.constraint(equalTo: input.topAnchor, constant: -10),

            input.leadingAnchor.constraint(equalTo: rail.leadingAnchor, constant: 12),
            input.trailingAnchor.constraint(equalTo: rail.trailingAnchor, constant: -12),
            input.bottomAnchor.constraint(equalTo: footer.topAnchor, constant: -10),

            footer.leadingAnchor.constraint(equalTo: rail.leadingAnchor, constant: 12),
            footer.trailingAnchor.constraint(equalTo: rail.trailingAnchor, constant: -12),
            footer.bottomAnchor.constraint(equalTo: rail.bottomAnchor, constant: -12),

            transcript.widthAnchor.constraint(equalTo: scroller.widthAnchor),
        ])
        return rail
    }

    // MARK: - Turns

    @objc private func send() {
        let prompt = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        input.stringValue = ""

        // A turn always starts from what is on screen, so going back to an
        // earlier turn and asking again branches from there.
        do {
            let turn = try translator.translate(prompt: prompt, style: current.style,
                                                frame: currentFrameImage())
            let applied = Studio.apply(patch: turn.patch, to: current.style)
            let contracts = Contracts.evaluate(style: applied.style, constitution: constitution)
            var detail = "\(applied.changed.count) field\(applied.changed.count == 1 ? "" : "s") · \(turn.note)"
            if !applied.unknown.isEmpty { detail += " · not mine: \(applied.unknown.joined(separator: ", "))" }
            if !turn.unread.isEmpty { detail += " · unread: \(turn.unread.joined(separator: ", "))" }
            // A branch drops the turns that came after the one we are on: the
            // rail is what led to this picture, not everything ever tried.
            if at < steps.count - 1 { steps.removeSubrange((at + 1)...) }
            steps.append(Step(label: prompt, detail: detail, style: applied.style, contracts: contracts))
            at = steps.count - 1
            refresh()
        } catch {
            // A model that fails does not silently become the local parser:
            // the fallback is offered, and taken only if it can read the words.
            if translator.name != "local",
               let fallback = try? LocalTranslator().translate(prompt: prompt, style: current.style) {
                let applied = Studio.apply(patch: fallback.patch, to: current.style)
                steps.append(Step(
                    label: prompt,
                    detail: "read locally — \(error.localizedDescription)",
                    style: applied.style,
                    contracts: Contracts.evaluate(style: applied.style, constitution: constitution)
                ))
                at = steps.count - 1
                refresh()
                return
            }
            note(error.localizedDescription)
        }
    }

    private func go(to index: Int) {
        guard steps.indices.contains(index) else { return }
        at = index
        phase = 0
        refresh()
    }

    @objc private func turnClicked(_ sender: NSButton) { go(to: sender.tag) }

    // MARK: - Showing where we are

    private func refresh() {
        for view in transcript.arrangedSubviews { transcript.removeArrangedSubview(view); view.removeFromSuperview() }
        for (i, step) in steps.enumerated() {
            let button = NSButton(title: "", target: self, action: #selector(turnClicked(_:)))
            button.tag = i
            button.isBordered = false
            button.alignment = .left
            button.lineBreakMode = .byWordWrapping
            button.setButtonType(.momentaryChange)

            let title = NSMutableAttributedString(
                string: "\(i == 0 ? "start" : "turn \(i)")  \(step.label)\n",
                attributes: [
                    .font: NSFont.systemFont(ofSize: 12, weight: i == at ? .semibold : .regular),
                    .foregroundColor: i == at ? NSColor.labelColor : NSColor.secondaryLabelColor,
                ]
            )
            title.append(NSAttributedString(
                string: step.detail,
                attributes: [
                    .font: NSFont.systemFont(ofSize: 10.5),
                    .foregroundColor: NSColor.tertiaryLabelColor,
                ]
            ))
            button.attributedTitle = title
            transcript.addArrangedSubview(button)
            button.widthAnchor.constraint(equalTo: transcript.widthAnchor, constant: -24).isActive = true
        }
        transcript.layoutSubtreeIfNeeded()
        scroller.documentView?.scroll(NSPoint(x: 0, y: 0))
        updateFooter()
        updateTitle()
    }

    private func updateFooter() {
        let contracts = current.contracts.isValid
            ? "T1–T6 pass"
            : current.contracts.violations.map(\.rawValue).joined(separator: " ")
        let departures = Studio.departures(of: current.style, from: constitution)
        let outside = departures.isEmpty
            ? "inside the constitution"
            : "\(departures.count) of 44 numbers outside the constitution"
        footer.stringValue = "\(contracts)   ·   \(outside)   ·   crop \(lockedIds[compositionIndex])   ·   seed \(seed)"
    }

    private func note(_ text: String) {
        footer.stringValue = text
        NSSound.beep()
    }

    private func updateTitle() {
        let parts = current.style.parts.map(\.primitive.rawValue).joined(separator: " + ")
        let eye = seeing && translator.canSee ? " · seeing" : ""
        window.title = "studio · \(current.label) · membrane + \(parts)\(eye)"
    }

    // MARK: - Keys

    private func handle(_ event: NSEvent) -> Bool {
        // The rail owns plain typing; the room's keys all take command, so a
        // sentence with the letter s in it does not save a still. And they
        // only count while the room is the window in front: the explorer is
        // listening for its own keys in the same process.
        guard window?.isKeyWindow == true, event.modifierFlags.contains(.command) else { return false }
        switch event.charactersIgnoringModifiers {
        case "[":
            compositionIndex = (compositionIndex + lockedIds.count - 1) % lockedIds.count
            updateFooter(); return true
        case "]":
            compositionIndex = (compositionIndex + 1) % lockedIds.count
            updateFooter(); return true
        case ".": paused.toggle(); return true
        case "r": phase = 0; return true
        case "s": saveStill(); return true
        case "k": keepStyle(); return true
        case "i": toggleSeeing(); return true
        default: return false
        }
    }

    /// Lets the studio look at the frame, or stops it.
    private func toggleSeeing() {
        guard translator.canSee else {
            note("The local translator reads words, not pictures.")
            return
        }
        seeing.toggle()
        UserDefaults.standard.set(seeing, forKey: "studio.seeing")
        footer.stringValue = seeing
            ? "the studio can see the frame — costs more per turn (⌘I)"
            : "the studio is told, not shown (⌘I)"
        updateTitle()
    }

    /// The frame as the owner sees it: same style, same crop, same moment.
    /// Rendered fresh rather than reusing the drawable, because the drawable
    /// belongs to the screen and a JPEG of it would be a screenshot of a
    /// window rather than a picture of the work.
    private func currentFrameImage() -> Data? {
        guard seeing, translator.canSee else { return nil }
        do {
            let shot = try EngineRenderer(rays: 320, segments: 288, sampleCount: 4)
            let rendered = try shot.render(
                style: current.style,
                surface: Surface(name: "studio-eye", width: 1280, height: 720),
                phase: phase, composition: composition
            )
            return jpegData(rendered)
        } catch {
            return nil
        }
    }

    /// Writes the style on screen into the store, so it appears in Betta
    /// Explorer › Explore › Studio Styles and can be set live from there.
    private func keepStyle() {
        let record = StyleStore.save(
            style: current.style, seed: seed, prompt: current.label,
            constitution: constitution.version,
            patch: transcriptText()
        )
        footer.stringValue = "kept as \(record.id) · Betta Explorer › Explore › Studio Styles"
        print("kept style \(record.id)  \(record.prompt)")
        onKeep?(record)
        StyleStore.upload(record) { [weak self] ok in
            DispatchQueue.main.async {
            guard let self else { return }
            self.footer.stringValue = ok
                ? "kept as \(record.id) · synced · Betta Explorer › Explore › Studio Styles"
                : "kept as \(record.id) · not synced, the file is kept"
            }
        }
    }

    /// The conversation as it stands, kept beside the numbers as provenance.
    private func transcriptText() -> String {
        steps.prefix(at + 1).enumerated()
            .map { "\($0.offset == 0 ? "start" : "turn \($0.offset)"): \($0.element.label) — \($0.element.detail)" }
            .joined(separator: "\n")
    }

    private func saveStill() {
        let name = "studio-\(StyleStore.identify(current.style))-comp-\(lockedIds[compositionIndex])-5k.png"
        let url = stillDirectory.appendingPathComponent(name)
        do {
            let still = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
            let frame = try still.render(
                style: current.style, surface: Surface(name: "studio-5k", width: 5120, height: 2880),
                phase: phase, composition: composition
            )
            try writePNG(frame, to: url)
            footer.stringValue = "still saved · \(url.lastPathComponent)"
            print("saved \(url.path)")
        } catch {
            note("still failed: \(error)")
        }
    }

    // MARK: - Drawing

    private func tick() {
        let now = CFAbsoluteTimeGetCurrent()
        let delta = min(now - lastTick, 0.05)
        lastTick = now
        if !paused { phase += delta * current.style.motionSpeed * 6.0 }
        guard !inFlight, window.isVisible, stage.bounds.width > 1 else { return }
        let scale = window.backingScaleFactor
        metalLayer.drawableSize = CGSize(width: stage.bounds.width * scale, height: stage.bounds.height * scale)
        guard let drawable = metalLayer.nextDrawable() else { return }
        let surface = Surface(name: "studio", width: drawable.texture.width, height: drawable.texture.height)
        inFlight = true
        renderer.present(style: current.style, surface: surface, phase: phase,
                         composition: composition, drawable: drawable) { [weak self] in
            self?.inFlight = false
        }
    }
}
