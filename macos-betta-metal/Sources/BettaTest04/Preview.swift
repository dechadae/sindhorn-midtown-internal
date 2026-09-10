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
    /// arms, rotated silently. The arm is never shown - the judgement has to be
    /// on the picture, not on which constitution or framing made it.
    private var judging = false
    private var rotation: ArmRotation?
    private var currentArm = ""
    /// Set only while judging. In the locked arms this is one of the owner's
    /// eight; in a randomised arm it is derived from the seed.
    private var currentComposition: Composition?
    private var currentCompositionLabel = ""
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

    convenience init(judgingWith arms: [JudgeArm], log: URL, constitution: Constitution) throws {
        try self.init(seed: 0, compositionId: nil, constitution: constitution)
        self.judging = true
        self.rotation = ArmRotation(arms)
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

        JUDGING
        k              keep this one
        space  or  ⏎   no - move on (this counts as a reject)
        u              undo the last verdict
        s              save a 5120x2880 still of this frame
        .              pause the motion
        q              quit

        left / right   previous / next seed   (browsing mode)
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
            return "\(judged) judged · \(kept) kept · \(rate)%    —    K keep    ·    space = no    ·    U undo"
        }
        if !reviewSeeds.isEmpty {
            return "\(reviewIndex + 1) / \(reviewSeeds.count)   ·   K keep    X reject   ·   \(presence)  ·  membrane + \(parts)"
        }
        return "seed \(seed)  ·  composition \(compositionIds[compositionIndex])  ·  \(presence)  ·  membrane + \(parts)"
    }

    /// A fresh seed and the next arm in the rotation.
    private func nextRandom() {
        guard let arm = rotation?.next() else { return }
        var bytes: UInt64 = 0
        _ = withUnsafeMutableBytes(of: &bytes) { SecRandomCopyBytes(kSecRandomDefault, 8, $0.baseAddress!) }
        seed = bytes
        currentArm = arm.name
        style = SeedSampler.generate(seed: seed, constitution: arm.constitution)

        switch arm.framing {
        case .locked:
            compositionIndex = Int.random(in: 0..<compositionIds.count)
            let id = compositionIds[compositionIndex]
            currentComposition = compositions[id] ?? .neutralLandscape
            currentCompositionLabel = String(id)
        case .randomised:
            // Derived from the seed, so the row reproduces the frame exactly.
            currentComposition = .randomised(seed: seed)
            currentCompositionLabel = "r"
        }

        phase = 0
        window?.title = titleText()
    }

    /// The composition in force. Judging resolves it per arm; browsing and
    /// review keep walking the locked list.
    private var activeComposition: Composition {
        if let currentComposition, judging { return currentComposition }
        return compositions[compositionIds[compositionIndex]] ?? .neutralLandscape
    }

    /// Removes the last recorded verdict, for the inevitable mis-key.
    private func undoLast() {
        guard let log, judged > 0,
              let text = try? String(contentsOf: log, encoding: .utf8) else { return }
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        while let last = lines.last, last.isEmpty { lines.removeLast() }
        guard lines.count > 1 else { return }
        let removed = lines.removeLast()
        try? (lines.joined(separator: "\n") + "\n").write(to: log, atomically: true, encoding: .utf8)
        judged -= 1
        if removed.hasSuffix(",keep") { kept -= 1 }
        print("undone: \(removed)")
        window?.title = titleText()
    }

    private func appendLog(_ verdict: String) {
        guard let log else { return }
        judged += 1
        if verdict == "keep" { kept += 1 }
        let line = "\(currentArm),\(seed),\(currentCompositionLabel),\(verdict)\n"
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
        case 36, 49:                                          // return / space
            // Moving on IS the verdict. A designer flags the good ones and
            // passes over the rest, so passing over has to count - otherwise
            // only keeps are recorded and every arm scores 100%.
            if judging { appendLog("reject") } else { paused.toggle() }
            return true
        case 32:                                              // u - undo
            if judging { undoLast() }; return true
        case 33:                                             // [
            compositionIndex = (compositionIndex - 1 + compositionIds.count) % compositionIds.count
            window.title = titleText(); return true
        case 30:                                             // ]
            compositionIndex = (compositionIndex + 1) % compositionIds.count
            window.title = titleText(); return true
        case 47: if judging { paused.toggle() }; return true  // . pauses while judging
        case 15: phase = 0; return true                      // r
        case 1: saveStill(); return true                     // s
        case 12: NSApp.terminate(nil); return true           // q
        default: return false
        }
    }

    private func saveStill() {
        let surface = Surface(name: "still", width: 5120, height: 2880)
        let composition = activeComposition
        do {
            let still = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
            let frame = try still.render(
                style: style, surface: surface, phase: phase, composition: composition
            )
            let label = judging ? currentCompositionLabel : String(compositionIds[compositionIndex])
            let name = "seed-\(seed)-comp-\(label).png"
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
        renderer.present(
            style: style, surface: surface, phase: phase,
            composition: activeComposition, drawable: drawable
        )
    }
}
