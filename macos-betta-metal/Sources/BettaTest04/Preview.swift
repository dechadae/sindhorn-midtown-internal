import AppKit
import Security
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
    /// When reviewing, the arrow keys walk this list rather than incrementing,
    /// so the frames judged are exactly the frames predicted against.
    private var reviewSeeds: [UInt64] = []
    /// Judging mode: each frame is a fresh random seed drawn from one of the
    /// three arms, rotated silently. The arm is never shown - the judgement has
    /// to be on the picture, not on which constitution made it.
    private var judging = false
    private var arms: [Constitution] = []
    private var currentArm = ""
    private var judged = 0
    private var kept = 0
    private var log: URL?
    private var reviewIndex = 0
    private var verdicts: [(UInt64, String)] = []
    private var verdictPath: URL?
    private var style: GeneratedStyle
    private var paused = false
    private var phase: Double = 0
    private var lastTick = CFAbsoluteTimeGetCurrent()

    convenience init(
        reviewing seeds: [UInt64],
        writingTo path: URL,
        constitution: Constitution
    ) throws {
        try self.init(seed: seeds.first ?? 0, compositionId: nil, constitution: constitution)
        self.reviewSeeds = seeds
        self.verdictPath = path
    }

    convenience init(judgingWith arms: [Constitution], log: URL, constitution: Constitution) throws {
        try self.init(seed: 0, compositionId: nil, constitution: constitution)
        self.judging = true
        self.arms = arms
        self.log = log
        nextRandom()
    }

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

        k / x          keep / reject, and advance   (review mode)
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
        let presence = style.exitDistance > 0 ? "departed" : "present"
        if judging {
            // Deliberately silent about the arm.
            let rate = judged > 0 ? Int(Double(kept) / Double(judged) * 100) : 0
            return "\(judged) judged · \(kept) kept · \(rate)%    —    K keep    X reject    ⏎ skip"
        }
        if !reviewSeeds.isEmpty {
            return "\(reviewIndex + 1) / \(reviewSeeds.count)   ·   K keep    X reject   ·   \(presence)  ·  membrane + \(parts)"
        }
        return "seed \(seed)  ·  composition \(compositionIds[compositionIndex])  ·  \(presence)  ·  membrane + \(parts)"
    }

    /// A fresh seed from a randomly chosen arm.
    private func nextRandom() {
        guard !arms.isEmpty else { return }
        var bytes: UInt64 = 0
        _ = withUnsafeMutableBytes(of: &bytes) { SecRandomCopyBytes(kSecRandomDefault, 8, $0.baseAddress!) }
        seed = bytes
        let arm = arms[Int.random(in: 0..<arms.count)]
        currentArm = arm.armName
        style = SeedSampler.generate(seed: seed, constitution: arm)
        compositionIndex = Int.random(in: 0..<compositionIds.count)
        phase = 0
        window?.title = titleText()
    }

    private func appendLog(_ verdict: String) {
        guard let log else { return }
        judged += 1
        if verdict == "keep" { kept += 1 }
        let line = "\(currentArm),\(seed),\(compositionIds[compositionIndex]),\(verdict)\n"
        if let handle = try? FileHandle(forWritingTo: log) {
            handle.seekToEndOfFile()
            handle.write(line.data(using: .utf8)!)
            try? handle.close()
        } else {
            try? ("arm,seed,composition,verdict\n" + line).write(to: log, atomically: true, encoding: .utf8)
        }
        let rate = judged > 0 ? Double(kept) / Double(judged) * 100 : 0
        print(String(format: "%4d judged   %3d kept   %.0f%%", judged, kept, rate))
        nextRandom()
    }

    private func showReview(at index: Int) {
        guard !reviewSeeds.isEmpty else { return }
        reviewIndex = max(0, min(reviewSeeds.count - 1, index))
        seed = reviewSeeds[reviewIndex]
        style = SeedSampler.generate(seed: seed, constitution: constitution)
        // Each frame keeps the composition it was predicted against.
        compositionIndex = reviewIndex % compositionIds.count
        phase = 0
        window.title = titleText()
    }

    private func record(_ verdict: String) {
        guard !reviewSeeds.isEmpty else { return }
        verdicts.removeAll { $0.0 == seed }
        verdicts.append((seed, verdict))
        print("\(reviewIndex + 1)/\(reviewSeeds.count)  seed \(seed)  \(verdict)")
        writeVerdicts()
        if reviewIndex + 1 < reviewSeeds.count {
            showReview(at: reviewIndex + 1)
        } else {
            print("\nall \(reviewSeeds.count) judged — written to \(verdictPath?.path ?? "")")
        }
    }

    private func writeVerdicts() {
        guard let verdictPath else { return }
        let rejected = verdicts.filter { $0.1 == "reject" }.map { String($0.0) }
        let kept = verdicts.filter { $0.1 == "keep" }.map { String($0.0) }
        let json = """
        {
          "rater": "owner",
          "judged": "in motion, live preview",
          "count": \(verdicts.count),
          "rejected": [\(rejected.map { "\"\($0)\"" }.joined(separator: ", "))],
          "kept": [\(kept.map { "\"\($0)\"" }.joined(separator: ", "))]
        }
        """
        try? json.write(to: verdictPath, atomically: true, encoding: .utf8)
    }

    private func reseed(_ delta: Int64) {
        seed = UInt64(bitPattern: Int64(bitPattern: seed) &+ delta)
        style = SeedSampler.generate(seed: seed, constitution: constitution)
        window.title = titleText()
    }

    private func handle(_ event: NSEvent) -> Bool {
        switch event.keyCode {
        case 123:                                            // left
            if reviewSeeds.isEmpty { reseed(-1) } else { showReview(at: reviewIndex - 1) }
            return true
        case 124:                                            // right
            if reviewSeeds.isEmpty { reseed(1) } else { showReview(at: reviewIndex + 1) }
            return true
        case 40:                                              // k
            judging ? appendLog("keep") : record("keep"); return true
        case 7:                                               // x
            judging ? appendLog("reject") : record("reject"); return true
        case 36:                                              // return - skip
            if judging { nextRandom() }; return true
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
