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
let mode = arguments.first ?? "--tier-a"
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
case "--judge":
    // The product and the instrument are the same thing: randomize, glance,
    // keep or reject. Frames are drawn from the three arms in silent rotation,
    // so the comparison accumulates as a byproduct of ordinary use.
    let logPath = arguments.dropFirst().first ?? "judgements.csv"
    do {
        let arms = try ["a", "b", "c"].map { try Constitution.loadArm($0) }
        let judge = try PreviewWindow(
            judgingWith: arms,
            log: URL(fileURLWithPath: logPath),
            constitution: arms[0]
        )
        judge.run()
    } catch {
        FileHandle.standardError.write("Judge failed: \(error)\n".data(using: .utf8)!)
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
    """)
    exit(64)
}
