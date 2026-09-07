import AppKit
import Metal
import QuartzCore

/// A live window for judging motion.
///
/// A still cannot show pacing, breathing or drift, and the owner's scores may
/// legitimately differ once the thing is moving. This renders the same
/// generated style through the same production shader, in real time, so the
/// judgement is made on what the wallpaper actually does.
///
/// The layer is `bgra8Unorm`, which is also what BETTA-METAL-PARITY.md records
/// the engine using - so this path is closer to production than the offscreen
/// one, which reads back `rgba8Unorm`.
final class PreviewWindow: NSObject, NSApplicationDelegate {
    private let renderer: EngineRenderer
    private let constitution: Constitution
    private let compositions: [Int: Composition]
    private var compositionIds: [Int]

    private var window: NSWindow!
    private var metalLayer: CAMetalLayer!
    private var timer: CVDisplayLink?

    private var seed: UInt64
    private var compositionIndex: Int
    private var style: GeneratedStyle
    private var paused = false
    private var phase: Double = 0
    private var lastTick = CFAbsoluteTimeGetCurrent()

    init(seed: UInt64, compositionId: Int?, constitution: Constitution) throws {
        self.constitution = constitution
        let loaded = try LockedCompositions.load()
        let ids = loaded.keys.sorted()
        self.compositions = loaded
        self.compositionIds = ids
        self.seed = seed
        self.compositionIndex = compositionId.flatMap { ids.firstIndex(of: $0) } ?? 0
        self.style = SeedSampler.generate(seed: seed, constitution: constitution)
        self.renderer = try EngineRenderer(
            rays: 320, segments: 288, sampleCount: 4, pixelFormat: .bgra8Unorm
        )
        super.init()
    }

    func run() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = self
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 1440, height: 810)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = titleText()

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

        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.handle(event) == true ? nil : event
        }

        Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        print(help)
    }

    private var help: String {
        """

        left / right   previous / next seed
        [ / ]          previous / next composition
        space          pause
        r              reset phase to 0
        s              save a 5120x2880 still of this exact frame
        q              quit

        """
    }

    private func titleText() -> String {
        let parts = style.parts.map(\.primitive.rawValue).joined(separator: " + ")
        return "seed \(seed)  ·  composition \(compositionIds[compositionIndex])  ·  membrane + \(parts)"
    }

    private func reseed(_ delta: Int64) {
        seed = UInt64(bitPattern: Int64(bitPattern: seed) &+ delta)
        style = SeedSampler.generate(seed: seed, constitution: constitution)
        window.title = titleText()
    }

    private func handle(_ event: NSEvent) -> Bool {
        switch event.keyCode {
        case 123: reseed(-1); return true                    // left
        case 124: reseed(1); return true                     // right
        case 33:                                             // [
            compositionIndex = (compositionIndex - 1 + compositionIds.count) % compositionIds.count
            window.title = titleText(); return true
        case 30:                                             // ]
            compositionIndex = (compositionIndex + 1) % compositionIds.count
            window.title = titleText(); return true
        case 49: paused.toggle(); return true                 // space
        case 15: phase = 0; return true                      // r
        case 1: saveStill(); return true                     // s
        case 12: NSApp.terminate(nil); return true           // q
        default: return false
        }
    }

    private func saveStill() {
        let surface = Surface(name: "still", width: 5120, height: 2880)
        let composition = compositions[compositionIds[compositionIndex]] ?? .neutralLandscape
        do {
            let still = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
            let frame = try still.render(
                style: style, surface: surface, phase: phase, composition: composition
            )
            let name = "seed-\(seed)-comp-\(compositionIds[compositionIndex]).png"
            let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .appendingPathComponent(name)
            try writePNG(frame, to: url)
            print("saved \(name)")
        } catch {
            print("save failed: \(error)")
        }
    }

    private func tick() {
        let now = CFAbsoluteTimeGetCurrent()
        // Clamped, as the production render loop clamps its own delta, so a
        // stall advances one plausible frame rather than jumping.
        let delta = min(now - lastTick, 0.05)
        lastTick = now
        if !paused { phase += delta * style.motionSpeed * 6.0 }

        let scale = window.backingScaleFactor
        let size = window.contentView!.bounds.size
        metalLayer.drawableSize = CGSize(width: size.width * scale, height: size.height * scale)

        guard let drawable = metalLayer.nextDrawable() else { return }
        let surface = Surface(
            name: "preview",
            width: drawable.texture.width,
            height: drawable.texture.height
        )
        let composition = compositions[compositionIds[compositionIndex]] ?? .neutralLandscape
        renderer.present(
            style: style, surface: surface, phase: phase,
            composition: composition, drawable: drawable
        )
    }
}
