import Foundation

/// IDUI Test 04 - the generative constitution test, on Metal.
///
/// This target is deliberately separate from `BettaMetalLab`. That app's job is
/// parity with the locked production presets; this one's job is a generator with
/// zero appearance decisions in it. Mixing the two in one module would make both
/// claims unreadable, so they share a package and nothing else.
///
/// Modes:
///   --tier-a [count]     Pure arithmetic over a seed range, no GPU. Exits
///                        non-zero if any seed fails a contract.
///   --dump-seeds [count] Emit each seed's style as CSV, for diffing against the
///                        Kotlin implementation's dump. This is how the frozen
///                        protocol's cross-platform determinism contract is
///                        actually measured rather than asserted.

func loadConstitution() -> Constitution {
    do {
        return try Constitution.loadBundled()
    } catch {
        FileHandle.standardError.write("Failed to load constitution: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
}

func runTierA(count: UInt64) {
    let constitution = loadConstitution()
    var perCategory: [Violation: Int] = [:]
    var styles: [GeneratedStyle] = []
    styles.reserveCapacity(Int(count))

    let started = Date()
    for seed in 0..<count {
        let style = SeedSampler.generate(seed: seed, constitution: constitution)
        styles.append(style)
        let result = Contracts.evaluate(style: style, constitution: constitution)
        for violation in result.violations {
            perCategory[violation, default: 0] += 1
        }
    }
    let collisions = Contracts.findSeedCollisions(styles)
    let elapsed = Date().timeIntervalSince(started)

    let violationTotal = perCategory.values.reduce(0, +)
    print("Tier A - constitution v\(constitution.version)")
    print("  seeds:      \(count)")
    print("  violations: \(violationTotal)")
    print("  collisions: \(collisions.count)")
    print(String(format: "  elapsed:    %.2fs", elapsed))
    if perCategory.isEmpty {
        print("  result:     no violation of any category")
    } else {
        for (violation, occurrences) in perCategory.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            print("  \(violation.rawValue): \(occurrences)")
        }
    }
    if violationTotal > 0 || !collisions.isEmpty {
        exit(1)
    }
}

func dumpSeeds(count: UInt64) {
    let constitution = loadConstitution()
    print("seed,baseHueDeg,accentHueDeg,saturation,lightness0,lightness1,lightness2,lightness3,groundLightnessA,groundLightnessB,motionSpeed,motionAmplitude,turbulence,currentStrength,opacity,transmission,rimStrength,foldHighlight,iridescence,bloom,gradingSaturation,brightness,spread,foldDensity,curl,twist,edgeFlutter,depth,rayCount,rayDefinition,veinStrength,morphMode")
    for seed in 0..<count {
        let s = SeedSampler.generate(seed: seed, constitution: constitution)
        let values: [Double] = [
            s.baseHueDeg, s.accentHueDeg, s.saturation,
            s.lightness0, s.lightness1, s.lightness2, s.lightness3,
            s.groundLightnessA, s.groundLightnessB,
            s.motionSpeed, s.motionAmplitude, s.turbulence, s.currentStrength,
            s.opacity, s.transmission, s.rimStrength, s.foldHighlight,
            s.iridescence, s.bloom, s.gradingSaturation, s.brightness,
            s.spread, s.foldDensity, s.curl, s.twist, s.edgeFlutter, s.depth,
            s.rayCount, s.rayDefinition, s.veinStrength, s.morphMode,
        ]
        // Raw IEEE-754 bit patterns, not decimal text. Java's %g and C's %g
        // differ in trailing-zero and exponent handling, so a decimal diff
        // would report formatting differences as arithmetic divergence. Bits
        // are unambiguous.
        print("\(seed)," + values.map { String(format: "%016llx", $0.bitPattern) }.joined(separator: ","))
    }
}

/// The three surfaces frozen in predictions-20260907-tier-b.md.
let frozenSurfaces = [
    Surface(name: "phone-portrait", width: 1080, height: 2400),
    Surface(name: "mac-landscape", width: 2560, height: 1600),
    Surface(name: "square", width: 1024, height: 1024),
]

/// The five moments frozen in the same file, in seconds on a pinned clock.
let frozenMoments: [Double] = [0, 1.7, 4.1, 9.3, 21.0]

func runNegativeControls() {
    let constitution = loadConstitution()
    let renderer: EngineRenderer
    do {
        renderer = try EngineRenderer()
    } catch {
        FileHandle.standardError.write("Renderer unavailable: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

    var broken: [String] = []

    print("Negative controls - each contract must fire on a case built to violate it")
    for control in NegativeControls.all(constitution: constitution) {
        do {
            let frame = try renderer.render(style: control.style, surface: control.surface, phase: 0)
            let ground = try renderer.render(
                style: control.style, surface: control.surface, phase: 0, includeOrganism: false
            )
            let measurement = FrameChecks.measure(frame: frame, ground: ground, style: control.style)
            let fired = measurement.violations.contains(control.expected)
            let mark = fired ? "fires" : "DID NOT FIRE"
            print("  \(control.name): \(control.expected.rawValue) \(mark)")
            print("      coverage \(String(format: "%.4f", measurement.formCoverage)), separation \(String(format: "%.4f", measurement.figureGroundSeparation)), border \(measurement.touchesBorder)")
            print("      \(control.rationale)")
            if !fired { broken.append(control.name) }
        } catch {
            print("  \(control.name): render failed - \(error)")
            broken.append(control.name)
        }
    }

    // Determinism control: the comparison itself must notice a single changed
    // byte, or R3 would be untestable.
    let base = SeedSampler.generate(seed: 0, constitution: constitution)
    do {
        let frame = try renderer.render(style: base, surface: NegativeControls.neutralSurface, phase: 0)
        var perturbed = frame.pixels
        perturbed[perturbed.count / 2] = perturbed[perturbed.count / 2] &+ 1
        let a = FrameChecks.fingerprint(frame)
        let b = FrameChecks.fingerprint(Frame(width: frame.width, height: frame.height, pixels: perturbed))
        let fired = a != b
        print("  one-byte-perturbation: R3_RENDER_NOT_DETERMINISTIC \(fired ? "fires" : "DID NOT FIRE")")
        if !fired { broken.append("one-byte-perturbation") }
    } catch {
        print("  one-byte-perturbation: render failed - \(error)")
        broken.append("one-byte-perturbation")
    }

    if broken.isEmpty {
        print("\nAll controls fired. The checks are capable of failing.")
    } else {
        print("\nBROKEN CONTRACTS: \(broken.joined(separator: ", "))")
        print("These are reported as broken, not as passes. Tier B results must not be trusted until they fire.")
        exit(1)
    }
}

let arguments = CommandLine.arguments.dropFirst()
// Betta Explorer.app is this binary launched from Finder, which passes no
// mode; the command line keeps its Tier A default.
let mode = arguments.first ?? (Packaged.isApp ? "--explore" : "--tier-a")
let requestedCount = arguments.dropFirst().first.flatMap { UInt64($0) }

switch mode {
case "--tier-a":
    runTierA(count: requestedCount ?? 100_000)
case "--dump-seeds":
    dumpSeeds(count: requestedCount ?? 1_000)
case "--max-fidelity":
    // Everything this machine will comfortably carry: 5120x2880, four times the
    // engine's mesh density, 4x MSAA on the ray tips.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let outPath = arguments.dropFirst(2).first ?? "max-fidelity"
    let howMany = arguments.dropFirst(3).first.flatMap { Int($0) } ?? 6
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath)
        let compositions = try LockedCompositions.load()
        let renderer = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
        let surface = Surface(name: "max", width: 5120, height: 2880)
        let outDir = URL(fileURLWithPath: outPath)
        try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
        let ids = compositions.keys.sorted()
        for i in 0..<howMany {
            let seed = seeds[i % seeds.count]
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            let composition = compositions[ids[i % ids.count]] ?? .neutralLandscape
            let started = Date()
            let frame = try renderer.render(
                style: style, surface: surface, phase: 0, composition: composition
            )
            let name = String(format: "max-%02d.png", i + 1)
            try writePNG(frame, to: outDir.appendingPathComponent(name))
            let parts = style.parts.map(\.primitive.rawValue).joined(separator: "+")
            FileHandle.standardError.write(
                String(format: "%@  seed %llu  membrane+%@  %.1fs\n",
                       name, seed, parts, Date().timeIntervalSince(started))
                    .data(using: .utf8)!
            )
        }
        print("wrote \(howMany) frames at 5120x2880 to \(outDir.path)")
    } catch {
        FileHandle.standardError.write("Max fidelity failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--blind-set":
    // A rating set. Neutral filenames, deterministic shuffle, manifest written
    // but not to be opened by a rater before scoring. Two deliberately degraded
    // frames are mixed in: a rater who scores those well is not discriminating,
    // and the comparison would be void.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let outPath = arguments.dropFirst(2).first ?? "blind-set"
    let total = arguments.dropFirst(3).first.flatMap { Int($0) } ?? 20
    let skip = arguments.dropFirst(4).first.flatMap { Int($0) } ?? 8
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath)
        let compositions = try LockedCompositions.load()
        let ids = compositions.keys.sorted()
        let renderer = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
        let surface = Surface(name: "blind", width: 3840, height: 2160)
        let outDir = URL(fileURLWithPath: outPath)
        try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

        struct Item { let kind: String; let seed: UInt64?; let style: GeneratedStyle
                      let composition: Composition; let note: String? }
        var items: [Item] = []

        // Genuine samples, skipping the seeds already judged.
        let sampleCount = total - 2
        for i in 0..<sampleCount {
            let seed = seeds[(skip + i) % seeds.count]
            items.append(Item(
                kind: "sample", seed: seed,
                style: SeedSampler.generate(seed: seed, constitution: constitution),
                composition: compositions[ids[i % ids.count]] ?? .neutralLandscape,
                note: nil
            ))
        }

        // Two degraded controls.
        let base = SeedSampler.generate(seed: seeds[skip % seeds.count], constitution: constitution)
        var flat = base
        flat.groundSaturation = 0.02
        flat.groundLightnessA = 0.42; flat.groundLightnessB = 0.46
        flat.groundVignette = 0
        flat.opacity = 0.02
        items.append(Item(kind: "control-flat", seed: nil, style: flat,
                          composition: .neutralLandscape,
                          note: "near-empty frame on an almost flat mid grey"))

        var muddy = base
        muddy.saturation = 0.06
        muddy.gradingSaturation = 1.18
        muddy.brightness = 1.64
        muddy.lightness0 = 0.34; muddy.lightness1 = 0.38
        muddy.lightness2 = 0.42; muddy.lightness3 = 0.46
        muddy.groundSaturation = 0.05
        muddy.groundLightnessA = 0.38; muddy.groundLightnessB = 0.45
        items.append(Item(kind: "control-muddy", seed: nil, style: muddy,
                          composition: compositions[ids[0]] ?? .neutralLandscape,
                          note: "desaturated organism on a desaturated mid ground"))

        var rng = SplitMix64(seed: 0xB11D5E7)
        for i in stride(from: items.count - 1, to: 0, by: -1) {
            let j = Int(rng.unit() * Double(i + 1)) % (i + 1)
            items.swapAt(i, j)
        }

        struct Entry: Encodable { let file: String; let kind: String
                                  let seed: UInt64?; let note: String? }
        var manifest: [Entry] = []
        for (index, item) in items.enumerated() {
            let name = String(format: "b-%02d.png", index + 1)
            let frame = try renderer.render(style: item.style, surface: surface,
                                            phase: 0, composition: item.composition)
            try writePNG(frame, to: outDir.appendingPathComponent(name))
            manifest.append(Entry(file: name, kind: item.kind, seed: item.seed, note: item.note))
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(manifest).write(to: outDir.appendingPathComponent("MANIFEST-DO-NOT-OPEN.json"))
        print("wrote \(manifest.count) frames at 3840x2160 to \(outDir.path)")
    } catch {
        FileHandle.standardError.write("Blind set failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--recall":
    // Recover one judged frame from its row. A judgement records the arm, the
    // seed and the framing, and every one of those reproduces exactly - so a
    // frame the owner liked is recoverable months later without having had the
    // presence of mind to press `s` at the time.
    //
    //   --recall <arm> <seed> [composition]
    //
    // `composition` is the id for a locked arm and is ignored for a randomised
    // one, where the framing comes from the seed.
    let args = Array(arguments.dropFirst())
    guard args.count >= 2, let recallSeed = UInt64(args[1]) else {
        FileHandle.standardError.write(
            "usage: --recall <arm> <seed> [composition]\n".data(using: .utf8)!)
        exit(2)
    }
    do {
        let armName = args[0]
        let resolved = try Recall.resolve(
            arm: armName, seed: recallSeed,
            compositionId: args.count >= 3 ? Int(args[2]) : nil
        )
        let recalled = resolved.style
        let composition = resolved.composition
        let framingNote = resolved.framingNote

        print("""
        arm \(armName)   seed \(recallSeed)
        framing: \(framingNote)

          scale      \(String(format: "%8.4f", composition.scale))
          x          \(String(format: "%8.4f", composition.x))
          y          \(String(format: "%8.4f", composition.y))
          z          \(String(format: "%8.4f", composition.z))
          rotationX  \(String(format: "%8.4f", composition.rotationX))
          rotationY  \(String(format: "%8.4f", composition.rotationY))
          rotationZ  \(String(format: "%8.4f", composition.rotationZ))

        organism: membrane + \(recalled.parts.map(\.primitive.rawValue).joined(separator: " + "))
        presence: \(recalled.exitDistance > 0 ? "departed" : "present")   \
        motion speed \(String(format: "%.3f", recalled.motionSpeed))
        """)

        // JSON beside the still, in the same shape as locked-compositions.json
        // so it can be pasted straight into the editor if it earns a slot.
        let json = """
        {
          "arm": "\(armName)",
          "seed": "\(recallSeed)",
          "framing": "\(framingNote)",
          "composition": {
            "scale": \(composition.scale),
            "x": \(composition.x),
            "y": \(composition.y),
            "z": \(composition.z),
            "rotationX": \(composition.rotationX),
            "rotationY": \(composition.rotationY),
            "rotationZ": \(composition.rotationZ)
          }
        }
        """
        let base = "recall-\(recallSeed)"
        try json.write(toFile: "\(base).json", atomically: true, encoding: .utf8)

        let still = try EngineRenderer(rays: 640, segments: 576, sampleCount: 4)
        let frame = try still.render(
            style: recalled,
            surface: Surface(name: "recall", width: 5120, height: 2880),
            phase: 0, composition: composition
        )
        try writePNG(frame, to: URL(fileURLWithPath: "\(base).png"))
        print("\nwrote \(base).png and \(base).json")
    } catch {
        FileHandle.standardError.write("recall failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

case "--keep":
    // Keeps a judged frame's composition as a named candidate.
    //
    //   --keep <arm> <seed> <name> [composition] [note]
    //
    // Writes to kept-compositions.json only. The locked eight are never
    // touched; promoting one of these into that set is the owner's call, made
    // in the composition editor.
    let keepArgs = Array(arguments.dropFirst())
    guard keepArgs.count >= 3, let keptSeed = UInt64(keepArgs[1]) else {
        FileHandle.standardError.write(
            "usage: --keep <arm> <seed> <name> [composition] [note]\n".data(using: .utf8)!)
        exit(2)
    }
    do {
        let compositionId = keepArgs.count >= 4 ? Int(keepArgs[3]) : nil
        let resolved = try Recall.resolve(
            arm: keepArgs[0], seed: keptSeed, compositionId: compositionId
        )
        var store = KeptCompositions.load()
        let existing = store.kept.contains { $0.seed == String(keptSeed) }
        store.add(KeptComposition(
            name: keepArgs[2],
            seed: String(keptSeed),
            arm: keepArgs[0],
            framing: resolved.framingNote,
            keptOn: Recall.today,
            note: keepArgs.count >= 5 ? keepArgs[4] : nil,
            composition: resolved.composition
        ))
        try store.save()
        print("""
        \(existing ? "updated" : "kept") "\(keepArgs[2])"  ·  seed \(keptSeed)  ·  \(resolved.framingNote)
        \(store.kept.count) composition\(store.kept.count == 1 ? "" : "s") in \(KeptCompositions.url.lastPathComponent)
        """)
    } catch {
        FileHandle.standardError.write("keep failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

case "--dump-arm":
    // `name=<IEEE-754 bits>` for every numeric field of a given arm's styles.
    //
    // Keyed by name rather than positional, because the JS port this is checked
    // against builds its object in the initialiser's order while Mirror walks
    // the declaration's - a positional diff would report a field ordering as an
    // arithmetic divergence. Bits, not decimals, for the reason dumpSeeds gives.
    do {
        let dumpArgs = Array(arguments.dropFirst())
        let constitution = try Constitution.loadArm(dumpArgs.first ?? "c")
        let howMany = dumpArgs.count > 1 ? (UInt64(dumpArgs[1]) ?? 200) : 200
        for seed in 0..<howMany {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            var fields: [String] = []
            for child in Mirror(reflecting: style).children {
                guard let label = child.label else { continue }
                if let d = child.value as? Double {
                    fields.append("\(label)=\(String(format: "%016llx", d.bitPattern))")
                }
            }
            // The parts array is a topology decision, so it is checked too.
            for (i, part) in style.parts.enumerated() {
                fields.append("part\(i).primitive=\(part.primitive.rawValue)")
                for (name, value) in [
                    ("scale", part.scale), ("orbitRadius", part.orbitRadius),
                    ("orbitAngleDeg", part.orbitAngleDeg), ("tiltDeg", part.tiltDeg),
                    ("phaseOffset", part.phaseOffset),
                ] {
                    fields.append("part\(i).\(name)=\(String(format: "%016llx", value.bitPattern))")
                }
            }
            print("\(seed) " + fields.sorted().joined(separator: " "))
        }
    } catch {
        FileHandle.standardError.write("dump-arm failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

case "--variety":
    // Keeper rate cannot tell a wide space that lands well apart from a narrow
    // space that only ever makes one picture. This measures the second thing
    // directly: how far apart two frames from the same arm actually are, in
    // the parameter space the shader consumes.
    //
    // Tier A - pure arithmetic, no GPU, no rating. Reported separately from
    // anything rendered, per the protocol.
    do {
        func vector(_ style: GeneratedStyle) -> [Double] {
            Mirror(reflecting: style).children.compactMap { child in
                if let d = child.value as? Double { return d }
                if let f = child.value as? Float { return Double(f) }
                if let i = child.value as? Int { return Double(i) }
                return nil
            }
        }

        let sampleSize = 400
        var vectors: [String: [[Double]]] = [:]
        for name in ["a", "b", "c"] {
            let constitution = try Constitution.loadArm(name)
            var rng = SplitMix64(seed: 0x0AC7_1E70_0000_0001)
            vectors[name] = (0..<sampleSize).map { _ in
                vector(SeedSampler.generate(seed: rng.nextRaw(), constitution: constitution))
            }
        }

        // Normalise each dimension by the widest span ANY arm reaches in it.
        //
        // Normalising by one arm's span is wrong: arm A pins exitDistance at 0,
        // so that dimension had no denominator and C's 7-13 world units entered
        // the distance raw, dwarfing the parameters that live in [0,1]. That
        // alone reported C at 236% of A. Per-dimension max makes every axis a
        // fraction of itself and comparable to every other.
        let width = vectors["a"]!.first!.indices.map { i -> Double in
            let span = ["a", "b", "c"].map { arm -> Double in
                let column = vectors[arm]!.map { $0[i] }
                return (column.max() ?? 0) - (column.min() ?? 0)
            }.max() ?? 0
            return span > 0 ? span : 1
        }

        print("output variety, \(sampleSize) seeds per arm, \(width.count) dimensions\n")
        print("  arm   mean pairwise distance   relative to the widest")
        var reference = 0.0
        for name in ["a", "b", "c"] {
            let v = vectors[name]!
            var total = 0.0, pairs = 0
            for i in 0..<v.count {
                for j in (i + 1)..<v.count {
                    var sum = 0.0
                    for d in v[i].indices {
                        let delta = (v[i][d] - v[j][d]) / width[d]
                        sum += delta * delta
                    }
                    total += sum.squareRoot(); pairs += 1
                }
            }
            let mean = total / Double(pairs)
            if name == "a" { reference = mean }
            print(String(format: "  %@     %18.4f   %20.1f%%",
                         name.uppercased(), mean, mean / reference * 100))
        }
    } catch {
        FileHandle.standardError.write("variety failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

case "--verify-arms":
    // The C pair is only a clean comparison if the organism is identical in
    // both and only the crop moves. Round one shipped a comparison that was
    // measuring something other than what it claimed, so this is checked
    // rather than asserted.
    do {
        let c = try Constitution.loadArm("c")
        var rng = SplitMix64(seed: 0x5EED_0F_A2)
        var styleMismatch = 0, outOfBox = 0, nondeterministic = 0
        let trials = 20_000
        for _ in 0..<trials {
            let seed = rng.nextRaw()
            // Both C arms name the same constitution, so the style must not
            // depend on which framing the arm asked for.
            if SeedSampler.generate(seed: seed, constitution: c)
                != SeedSampler.generate(seed: seed, constitution: c) { styleMismatch += 1 }

            let f = Composition.randomised(seed: seed)
            if Composition.randomised(seed: seed) != f { nondeterministic += 1 }

            let inBox =
                Composition.Envelope.scale.contains(Double(f.scale)) &&
                Composition.Envelope.x.contains(Double(f.x)) &&
                Composition.Envelope.y.contains(Double(f.y)) &&
                Composition.Envelope.z.contains(Double(f.z)) &&
                Composition.Envelope.rotationX.contains(Double(f.rotationX)) &&
                Composition.Envelope.rotationY.contains(Double(f.rotationY)) &&
                Composition.Envelope.rotationZ.contains(Double(f.rotationZ))
            if !inBox { outOfBox += 1 }
        }

        // A locked composition must never be reachable by the randomised arm,
        // or the two C arms would sometimes be the same experiment.
        let locked = try LockedCompositions.load()
        var collisions = 0
        for _ in 0..<trials {
            let f = Composition.randomised(seed: rng.nextRaw())
            if locked.values.contains(f) { collisions += 1 }
        }

        var rotation = ArmRotation([
            JudgeArm(name: "A", constitution: c, framing: .randomised),
            JudgeArm(name: "B", constitution: c, framing: .locked),
            JudgeArm(name: "C-locked", constitution: c, framing: .locked),
            JudgeArm(name: "C-random", constitution: c, framing: .randomised)
        ])
        var counts: [String: Int] = [:]
        var worstBlockSkew = 0
        for block in 0..<50 {
            for _ in 0..<4 { counts[rotation.next()!.name, default: 0] += 1 }
            let expected = block + 1
            worstBlockSkew = max(worstBlockSkew, counts.values.map { abs($0 - expected) }.max() ?? 0)
        }

        print("""
        arm verification, \(trials) trials

          style identical across the C pair      \(styleMismatch == 0 ? "PASS" : "FAIL \(styleMismatch)")
          randomised framing is deterministic    \(nondeterministic == 0 ? "PASS" : "FAIL \(nondeterministic)")
          randomised framing inside the envelope \(outOfBox == 0 ? "PASS" : "FAIL \(outOfBox)")
          randomised never hits a locked crop    \(collisions == 0 ? "PASS" : "FAIL \(collisions)")
          arms level at every block boundary     \(worstBlockSkew == 0 ? "PASS" : "FAIL skew \(worstBlockSkew)")

          after 200 frames: \(counts.sorted { $0.key < $1.key }.map { "\($0.key) \($0.value)" }.joined(separator: "   "))
        """)
        exit(styleMismatch + nondeterministic + outOfBox + collisions + worstBlockSkew == 0 ? 0 : 1)
    } catch {
        FileHandle.standardError.write("verify failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

case "--judge":
    // The product and the instrument are the same thing: randomize, glance,
    // keep or reject. Frames are drawn from the three arms in silent rotation,
    // so the comparison accumulates as a byproduct of ordinary use.
    // Round two. Framing is now a factor rather than a constant, because in
    // round one it was the largest effect in the experiment and nothing was
    // set up to measure it. Each pair of arms differs in exactly one thing:
    //
    //   A         vs  C-random   constitution, framing randomised in both
    //   B         vs  C-locked   allowlist against exclusions, framing locked
    //   C-locked  vs  C-random   framing, constitution held constant
    //
    // A new log: this is a different experimental state and the round-one rows
    // are not comparable to it.
    let logPath = arguments.dropFirst().first ?? "judgements-r2.csv"
    do {
        let a = try Constitution.loadArm("a")
        let b = try Constitution.loadArm("b")
        let c = try Constitution.loadArm("c")
        let arms = [
            JudgeArm(name: "A", constitution: a, framing: .randomised),
            JudgeArm(name: "B", constitution: b, framing: .locked),
            JudgeArm(name: "C-locked", constitution: c, framing: .locked),
            JudgeArm(name: "C-random", constitution: c, framing: .randomised)
        ]
        let judge = try PreviewWindow(
            judgingWith: arms,
            log: URL(fileURLWithPath: logPath),
            constitution: c
        )
        judge.run()
    } catch {
        FileHandle.standardError.write("Judge failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--explore":
    // The phone's explorer on the Mac: randomize, keep or no, and the frame
    // in front becomes the desktop - still or live - with one key. Verdicts
    // go to the same server table as the phone's, device `macos-metal/*`.
    // Arm C only; the judging experiment is closed and its logs are frozen.
    setvbuf(stdout, nil, _IOLBF, 0)
    do {
        let explorer = try Explorer(constitution: try Constitution.loadArm("c"))
        explorer.run()
    } catch {
        FileHandle.standardError.write("Explorer failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--studio":
    // Words translated to numbers, laid over a seed's style, judged by the same
    // contracts and drawn by the same engine. The still goes beside the patch;
    // the window then shows the same style moving.
    //   --studio <patch.json> [seed] [composition] [--still-only]
    setvbuf(stdout, nil, _IOLBF, 0)
    let patchPath = arguments.dropFirst().first ?? "studio.json"
    let seed = arguments.dropFirst(2).first.flatMap { UInt64($0) } ?? 0
    let compArg = arguments.dropFirst(3).first.flatMap { Int($0) }
    let stillOnly = arguments.contains("--still-only")
    let constitution = loadConstitution()
    do {
        let patchURL = URL(fileURLWithPath: patchPath)
        let applied = try Studio.apply(patchAt: patchURL, seed: seed, constitution: constitution)
        let locked = try LockedCompositions.load()
        let composition = compArg.flatMap { locked[$0] } ?? locked[locked.keys.sorted()[0]] ?? .neutralLandscape
        let stillURL = patchURL.deletingPathExtension().appendingPathExtension("png")
        // The window's `s` key saves at 5120x2880; a patch that has earned a
        // wallpaper deserves the same from the command line.
        let big = arguments.contains("--5k")
        try Studio.still(applied, composition: composition, to: stillURL,
                         width: big ? 5120 : 2560, height: big ? 2880 : 1440)
        let parts = applied.style.parts.map(\.primitive.rawValue).joined(separator: "+")
        print("studio   \(applied.name)  over seed \(seed)  composition \(compArg ?? locked.keys.sorted()[0])")
        print("set      \(applied.changed.count) fields  membrane+\(parts)")
        if !applied.unknown.isEmpty { print("unknown  \(applied.unknown.joined(separator: ", "))") }
        print("judge    \(applied.contracts.isValid ? "T1-T6 pass" : applied.contracts.violations.map(\.rawValue).joined(separator: " "))")
        // T4 only says a number left the constitution. The studio is allowed to
        // leave it - the words are the brief, not the sampler - so name every
        // departure and let the owner weigh it.
        let departures = Studio.departures(of: applied.style, from: constitution)
        if !departures.isEmpty {
            print("outside  \(departures.count) of 44 numbers are outside the explorer's constitution:")
            for line in departures { print("         \(line)") }
        }
        if arguments.contains("--values") {
            // What the style holds now, patch-ready. A studio turn starts from
            // these numbers, so they are printed in the shape a patch takes.
            for (name, value) in Studio.values(of: applied.style) {
                let mark = applied.changed.contains(name) ? "*" : " "
                print("  \(mark) \"\(name)\": \(String(format: "%g", value)),")
            }
            let parts = applied.style.parts.map {
                "\($0.primitive.rawValue) scale \(String(format: "%g", $0.scale)) r \(String(format: "%g", $0.orbitRadius)) angle \(String(format: "%g", $0.orbitAngleDeg)) tilt \(String(format: "%g", $0.tiltDeg))"
            }
            for part in parts { print("    part: \(part)") }
        }
        print("still    \(stillURL.path)")
        if arguments.contains("--keep") {
            // The style joins the app: kept by its own numbers, so it can be
            // set live and reopened without this patch file or this command.
            let record = StyleStore.save(
                style: applied.style, seed: String(seed),
                prompt: applied.prompt ?? applied.name,
                constitution: constitution.version,
                patch: (try? String(contentsOf: patchURL, encoding: .utf8)) ?? ""
            )
            print("kept     style \(record.id)  ·  Betta Explorer › Explore › Studio Styles")
            // The file on disk is the record; this is the copy the phone can
            // reach. A style that does not arrive is not lost.
            let waiting = DispatchSemaphore(value: 0)
            StyleStore.upload(record) { ok in
                print(ok ? "synced   betta_styles" : "not synced  (the file is kept; try again later)")
                waiting.signal()
            }
            _ = waiting.wait(timeout: .now() + 25)
        }
        if !stillOnly {
            let window = try StudioWindow(
                applied: applied, compositionId: compArg,
                stillDirectory: patchURL.deletingLastPathComponent(),
                constitution: constitution, seed: seed
            )
            window.run()
        }
    } catch {
        FileHandle.standardError.write("Studio failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--glossary":
    // The model's brief, generated from the constitution so it cannot go
    // stale. Written beside the sources for review; the app builds its own
    // copy at run time.
    //   --glossary [path]
    let constitution = loadConstitution()
    let brief = Glossary.build(constitution: constitution)
    let data = try! JSONSerialization.data(withJSONObject: brief, options: [.prettyPrinted, .sortedKeys])
    if let path = arguments.dropFirst().first, !path.hasPrefix("--") {
        try? data.write(to: URL(fileURLWithPath: path))
        print("glossary v\(constitution.version) · \(Studio.fields.count) fields · \(path)")
    } else {
        print(String(data: data, encoding: .utf8)!)
    }
case "--studio-token":
    // The shared secret the Mac sends to the Edge Function, kept in the
    // Keychain rather than in a file beside the app.
    //   --studio-token <value>     store it
    //   --studio-token --forget    remove it
    //   --studio-token             say whether one is there
    let value = arguments.dropFirst().first
    if value == "--forget" {
        StudioToken.write("")
        print("studio token removed · the room falls back to the local translator")
    } else if let value, !value.isEmpty {
        let ok = StudioToken.write(value)
        print(ok
              ? "studio token stored in the Keychain · the room will use \(StudioToken.endpoint.lastPathComponent)"
              : "could not write to the Keychain")
        if !ok { exit(2) }
    } else {
        print(StudioToken.read() == nil
              ? "no studio token · the room uses the local translator"
              : "studio token present · the room uses \(StudioToken.endpoint.absoluteString)")
    }
case "--studio-ping":
    // One turn through the Edge Function, printed - how the deployment is
    // checked without opening the room.
    //   --studio-ping "<sentence>" [seed]
    let sentence = arguments.dropFirst().first ?? "more translucent"
    let seed = arguments.dropFirst(2).first.flatMap { UInt64($0) } ?? 0
    let constitution = loadConstitution()
    guard let token = StudioToken.read() else {
        print("no studio token · run --studio-token <value> first")
        exit(2)
    }
    let style = SeedSampler.generate(seed: seed, constitution: constitution)
    let remote = RemoteTranslator(endpoint: StudioToken.endpoint, token: token,
                                  glossaryVersion: constitution.version)
    do {
        let started = Date()
        let turn = try remote.translate(prompt: sentence, style: style)
        print("studio   \(String(format: "%.1fs", Date().timeIntervalSince(started)))  \(turn.note)")
        for name in turn.patch.keys.sorted() {
            let was = Studio.fields[name].map { String(format: "%g", style[keyPath: $0]) } ?? "—"
            print("  \(name): \(was) → \(String(format: "%g", turn.patch[name]!))")
        }
        if !turn.unread.isEmpty { print("refused  \(turn.unread.joined(separator: ", "))") }
        let applied = Studio.apply(patch: turn.patch, to: style)
        let result = Contracts.evaluate(style: applied.style, constitution: constitution)
        print("judge    \(result.isValid ? "T1-T6 pass" : result.violations.map(\.rawValue).joined(separator: " "))")
    } catch {
        print("no       \(error.localizedDescription)")
        exit(1)
    }
case "--translate":
    // Words to numbers, printed - the room's first half without the room.
    //   --translate "<sentence>" [seed]
    let sentence = arguments.dropFirst().first ?? ""
    let seed = arguments.dropFirst(2).first.flatMap { UInt64($0) } ?? 0
    let constitution = loadConstitution()
    let style = SeedSampler.generate(seed: seed, constitution: constitution)
    do {
        let turn = try LocalTranslator().translate(prompt: sentence, style: style)
        print("said     \(turn.note)")
        for name in turn.patch.keys.sorted() {
            let was = Studio.fields[name].map { style[keyPath: $0] }
            let from = was.map { String(format: "%g", $0) } ?? "—"
            print("  \(name): \(from) → \(String(format: "%g", turn.patch[name]!))")
        }
        if !turn.unread.isEmpty { print("unread   \(turn.unread.joined(separator: ", "))") }
        let applied = Studio.apply(patch: turn.patch, to: style)
        let result = Contracts.evaluate(style: applied.style, constitution: constitution)
        print("judge    \(result.isValid ? "T1-T6 pass" : result.violations.map(\.rawValue).joined(separator: " "))")
    } catch {
        print("no       \(error.localizedDescription)")
    }
case "--style":
    // A kept style, drawn from the store rather than from a patch: the proof
    // that a studio picture survives without the file that made it.
    //   --style <id> [composition] [--still-only] [--5k]
    setvbuf(stdout, nil, _IOLBF, 0)
    let styleId = arguments.dropFirst().first ?? ""
    let compArg = arguments.dropFirst(2).first.flatMap { Int($0) }
    guard let record = StyleStore.load(id: styleId) else {
        FileHandle.standardError.write("No style \(styleId)\n".data(using: .utf8)!)
        let kept = StyleStore.all()
        if !kept.isEmpty {
            print("kept styles:")
            for r in kept { print("  \(r.id)  \(r.prompt)") }
        }
        exit(2)
    }
    do {
        let locked = try LockedCompositions.load()
        let composition = compArg.flatMap { locked[$0] } ?? locked[8] ?? .neutralLandscape
        let applied = Studio.Applied(
            name: record.id, prompt: record.prompt, style: record.style,
            changed: [], unknown: [],
            contracts: Contracts.evaluate(style: record.style, constitution: loadConstitution())
        )
        let out = URL(fileURLWithPath: arguments.dropFirst(3).first(where: { !$0.hasPrefix("--") })
                      ?? StyleStore.url(for: record.id).deletingPathExtension().appendingPathExtension("png").path)
        let big = arguments.contains("--5k")
        try Studio.still(applied, composition: composition, to: out,
                         width: big ? 5120 : 2560, height: big ? 2880 : 1440)
        print("style    \(record.id)  \(record.prompt)")
        print("from     seed \(record.seed) · constitution v\(record.constitution) · kept \(record.createdAt)")
        print("still    \(out.path)")
        if !arguments.contains("--still-only") {
            let window = try StudioWindow(
                applied: applied, compositionId: compArg,
                stillDirectory: out.deletingLastPathComponent(),
                constitution: loadConstitution(), seed: UInt64(record.seed) ?? 0
            )
            window.run()
        }
    } catch {
        FileHandle.standardError.write("Style failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--review":
    // Judge a fixed seed list in motion, recording verdicts by keystroke.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let outPath = arguments.dropFirst(2).first ?? "verdicts.json"
    let offset = arguments.dropFirst(3).first.flatMap { Int($0) } ?? 27
    let count = arguments.dropFirst(4).first.flatMap { Int($0) } ?? 20
    let constitution = loadConstitution()
    do {
        let all = try TierB.loadSeeds(path: seedsPath)
        let slice = Array(all[offset..<min(offset + count, all.count)])
        let preview = try PreviewWindow(
            reviewing: slice,
            writingTo: URL(fileURLWithPath: outPath),
            constitution: constitution
        )
        preview.run()
    } catch {
        FileHandle.standardError.write("Review failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--predict":
    // The contract's own verdict on each seed, which is the written rule
    // applied mechanically. No taste is involved: R1 fires or it does not.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let offset = arguments.dropFirst(2).first.flatMap { Int($0) } ?? 27
    let count = arguments.dropFirst(3).first.flatMap { Int($0) } ?? 20
    let constitution = loadConstitution()
    do {
        let all = try TierB.loadSeeds(path: seedsPath)
        let slice = Array(all[offset..<min(offset + count, all.count)])
        let compositions = try LockedCompositions.load()
        let ids = compositions.keys.sorted()
        let renderer = try EngineRenderer(rays: 320, segments: 288, sampleCount: 1)
        let surface = Surface(name: "predict", width: 1920, height: 1080)
        print("index,seed,presence,coverage,violations,ruleVerdict")
        for (i, seed) in slice.enumerated() {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            let comp = compositions[ids[i % ids.count]] ?? .neutralLandscape
            let frame = try renderer.render(style: style, surface: surface, phase: 0, composition: comp)
            let bg = try renderer.render(
                style: style, surface: surface, phase: 0, composition: comp, includeOrganism: false
            )
            let m = FrameChecks.measure(frame: frame, ground: bg, style: style)
            let verdict = m.violations.isEmpty ? "keep" : "reject"
            let presence = style.exitDistance > 0 ? "departed" : "present"
            print("\(i + 1),\(seed),\(presence),\(String(format: "%.4f", m.formCoverage)),\(m.violations.map(\.rawValue).joined(separator: "|")),\(verdict)")
        }
    } catch {
        FileHandle.standardError.write("Predict failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--preview":
    // A live window. A still cannot show pacing, breathing or drift, and a
    // score given on a still is a score given on the wrong thing.
    let seedArg = arguments.dropFirst().first.flatMap { UInt64($0) }
    let compArg = arguments.dropFirst(2).first.flatMap { Int($0) }
    let constitution = loadConstitution()
    do {
        let seeds = try? TierB.loadSeeds(
            path: "/Users/Graphic/Documents/sindhorn-midtown-internal-claude/idui-core/evidence/generative/seeds.json"
        )
        let seed = seedArg ?? seeds?.first ?? 0
        let preview = try PreviewWindow(seed: seed, compositionId: compArg, constitution: constitution)
        preview.run()
    } catch {
        FileHandle.standardError.write("Preview failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--calibrate-presence":
    // Measure what presence scale actually produces what coverage, instead of
    // guessing the bands. The first attempt put "timid" at 0.55, which turned
    // out to fill 95% of the frame.
    let constitution = loadConstitution()
    do {
        let renderer = try EngineRenderer(rays: 160, segments: 144, sampleCount: 1)
        let compositions = try LockedCompositions.load()
        let ids = compositions.keys.sorted()
        let surface = Surface(name: "cal", width: 1280, height: 720)
        let seedsPath = "/Users/Graphic/Documents/sindhorn-midtown-internal-claude/idui-core/evidence/generative/seeds.json"
        let seeds = (try? TierB.loadSeeds(path: seedsPath)) ?? [0]
        print("scale   mean coverage across 8 compositions x 4 seeds")
        for step in 0...16 {
            let scale = 0.02 + Double(step) * 0.045
            var total = 0.0, n = 0.0
            for s in seeds.prefix(4) {
                var style = SeedSampler.generate(seed: s, constitution: constitution)
                style.presenceScale = scale
                for id in ids {
                    let comp = compositions[id] ?? .neutralLandscape
                    let frame = try renderer.render(
                        style: style, surface: surface, phase: 0, composition: comp
                    )
                    let bg = try renderer.render(
                        style: style, surface: surface, phase: 0,
                        composition: comp, includeOrganism: false
                    )
                    total += FrameChecks.measure(frame: frame, ground: bg, style: style).formCoverage
                    n += 1
                }
            }
            print(String(format: "%.3f   %.4f", scale, total / n))
        }
    } catch {
        FileHandle.standardError.write("Calibration failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--negative-controls":
    runNegativeControls()
case "--taste-set":
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let outPath = arguments.dropFirst(2).first ?? "taste-set"
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath)
        let compositions = try LockedCompositions.load()
        let renderer = try EngineRenderer()
        let outDir = URL(fileURLWithPath: outPath)
        // Landscape: the eight locked compositions were tuned for a Mac display.
        let surface = Surface(name: "mac-landscape", width: 1600, height: 1000)
        let manifest = try TasteSet.build(
            seeds: seeds,
            constitution: constitution,
            compositions: compositions,
            renderer: renderer,
            surface: surface,
            perComposition: 5,
            outputDirectory: outDir
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(manifest).write(to: outDir.appendingPathComponent("manifest.json"))
        FileHandle.standardError.write(
            "wrote \(manifest.count) frames to \(outDir.path)\n".data(using: .utf8)!
        )
        print("\(manifest.count) frames, manifest at \(outDir.appendingPathComponent("manifest.json").path)")
    } catch {
        FileHandle.standardError.write("Taste set failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--fingerprints":
    // P3 asks for determinism across process restarts, which an in-process
    // double render cannot answer. Run this twice and diff the output.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let limit = arguments.dropFirst(2).first.flatMap { Int($0) } ?? 100
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath).prefix(limit)
        let renderer = try EngineRenderer()
        print("seed,surface,moment,fingerprint")
        for seed in seeds {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            for surface in frozenSurfaces {
                for moment in frozenMoments {
                    let phase = EngineRenderer.phase(for: style, atSeconds: moment)
                    let frame = try renderer.render(style: style, surface: surface, phase: phase)
                    print("\(seed),\(surface.name),\(moment),\(FrameChecks.fingerprint(frame))")
                }
            }
        }
    } catch {
        FileHandle.standardError.write("Fingerprint run failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
case "--tier-b":
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let recordsPath = arguments.dropFirst(2).first
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath)
        let renderer = try EngineRenderer()
        FileHandle.standardError.write(
            "Tier B: \(seeds.count) seeds x \(frozenSurfaces.count) surfaces x \(frozenMoments.count) moments = \(seeds.count * frozenSurfaces.count * frozenMoments.count) frames\n"
                .data(using: .utf8)!
        )
        let summary = try TierB.run(
            seeds: seeds,
            constitution: constitution,
            surfaces: frozenSurfaces,
            moments: frozenMoments,
            renderer: renderer,
            recordsOut: recordsPath.map { URL(fileURLWithPath: $0) }
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        print(String(data: try encoder.encode(summary), encoding: .utf8)!)
    } catch {
        FileHandle.standardError.write("Tier B failed: \(error)\n".data(using: .utf8)!)
        exit(2)
    }
default:
    print("""
    IDUI Test 04 (Metal)

    Usage:
      BettaTest04 --tier-a [count]        run the pure-arithmetic contract pass
      BettaTest04 --dump-seeds [count]    emit styles as CSV for cross-platform diffing
      BettaTest04 --negative-controls     prove each rendered contract can fail
      BettaTest04 --preview [seed] [1-8]  live window; watch the motion
      BettaTest04 --explore               randomize, keep or no, set the desktop still or live
    """)
    exit(64)
}
