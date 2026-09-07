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
    print("seed,baseHueDeg,accentHueDeg,baseSaturation,baseLightness,accentLightness,backgroundLightness,motionSpeed,motionAmplitude,turbulence,currentStrength,opacity,transmission,rimStrength,bloom,spread,foldDensity,curl,twist,edgeFlutter,depth")
    for seed in 0..<count {
        let s = SeedSampler.generate(seed: seed, constitution: constitution)
        let values: [Double] = [
            s.baseHueDeg, s.accentHueDeg, s.baseSaturation, s.baseLightness, s.accentLightness,
            s.backgroundLightness, s.motionSpeed, s.motionAmplitude, s.turbulence, s.currentStrength,
            s.opacity, s.transmission, s.rimStrength, s.bloom, s.spread, s.foldDensity, s.curl,
            s.twist, s.edgeFlutter, s.depth,
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
    let renderer: OffscreenRenderer
    do {
        renderer = try OffscreenRenderer()
    } catch {
        FileHandle.standardError.write("Renderer unavailable: \(error)\n".data(using: .utf8)!)
        exit(2)
    }

    var broken: [String] = []

    print("Negative controls - each contract must fire on a case built to violate it")
    for control in NegativeControls.all(constitution: constitution) {
        do {
            let frame = try renderer.render(style: control.style, surface: control.surface, phase: 0)
            let measurement = FrameChecks.measure(frame: frame, style: control.style)
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
case "--negative-controls":
    runNegativeControls()
case "--fingerprints":
    // P3 asks for determinism across process restarts, which an in-process
    // double render cannot answer. Run this twice and diff the output.
    let seedsPath = arguments.dropFirst().first ?? "seeds.json"
    let limit = arguments.dropFirst(2).first.flatMap { Int($0) } ?? 100
    let constitution = loadConstitution()
    do {
        let seeds = try TierB.loadSeeds(path: seedsPath).prefix(limit)
        let renderer = try OffscreenRenderer()
        print("seed,surface,moment,fingerprint")
        for seed in seeds {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            for surface in frozenSurfaces {
                for moment in frozenMoments {
                    let phase = OffscreenRenderer.phase(for: style, atSeconds: moment)
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
        let renderer = try OffscreenRenderer()
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
    """)
    exit(64)
}
