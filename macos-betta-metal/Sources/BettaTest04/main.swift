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

let arguments = CommandLine.arguments.dropFirst()
let mode = arguments.first ?? "--tier-a"
let requestedCount = arguments.dropFirst().first.flatMap { UInt64($0) }

switch mode {
case "--tier-a":
    runTierA(count: requestedCount ?? 100_000)
case "--dump-seeds":
    dumpSeeds(count: requestedCount ?? 1_000)
default:
    print("""
    IDUI Test 04 (Metal)

    Usage:
      BettaTest04 --tier-a [count]       run the pure-arithmetic contract pass
      BettaTest04 --dump-seeds [count]   emit styles as CSV for cross-platform diffing
    """)
    exit(64)
}
