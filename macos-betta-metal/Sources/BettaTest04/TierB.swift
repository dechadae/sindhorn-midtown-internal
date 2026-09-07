import Foundation

/// Tier B: rendered, sampled. Reported separately from Tier A, always - the two
/// numbers must never be merged, and the strong one must never lend its
/// credibility to the weak one.
///
/// Runs the sample frozen in predictions-20260907-tier-b.md. Nothing here
/// rejects a seed: a failure is counted and reported, never redrawn.
enum TierB {
    struct SeedRecord: Encodable {
        let seed: UInt64
        let surface: String
        let momentSeconds: Double
        let violations: [String]
        let formCoverage: Double
        let figureGroundSeparation: Double
        let touchesBorder: Bool
    }

    struct Summary: Encodable {
        let framesRendered: Int
        let framesWithViolation: Int
        let violationsByCategory: [String: Int]
        let violationsBySurface: [String: Int]
        let seedsWithAnyViolation: Int
        let seedsSampled: Int
        let luminanceP05: Double
        let luminanceP95: Double
        let luminanceSpan: Double
        let hueBucketsOccupied: Int
        let hueBucketCount: Int
        let determinismSeedsChecked: Int
        let determinismMismatches: Int
        let elapsedSeconds: Double
    }

    static func loadSeeds(path: String) throws -> [UInt64] {
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let seeds = object["seeds"] as? [Any] else {
            throw NSError(domain: "BettaTest04", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "seeds.json has no 'seeds' array"
            ])
        }
        return seeds.compactMap { value in
            if let n = value as? UInt64 { return n }
            if let n = value as? Int { return UInt64(bitPattern: Int64(n)) }
            if let n = value as? NSNumber { return n.uint64Value }
            return nil
        }
    }

    static func run(
        seeds: [UInt64],
        constitution: Constitution,
        surfaces: [Surface],
        moments: [Double],
        renderer: EngineRenderer,
        recordsOut: URL?
    ) throws -> Summary {
        let started = Date()
        var framesRendered = 0
        var framesWithViolation = 0
        var byCategory: [String: Int] = [:]
        var bySurface: [String: Int] = [:]
        var seedsWithViolation = Set<UInt64>()
        var records: [SeedRecord] = []

        // Coverage sample: one surface, one moment, so the distribution
        // describes the seeds rather than the sampling grid.
        var coverageLuminance: [Double] = []
        var hueBuckets = Set<Int>()
        let hueBucketCount = 36

        for seed in seeds {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            for surface in surfaces {
                for moment in moments {
                    let phase = EngineRenderer.phase(for: style, atSeconds: moment)
                    let frame = try renderer.render(style: style, surface: surface, phase: phase)
                    let ground = try renderer.render(
                        style: style, surface: surface, phase: phase, includeOrganism: false
                    )
                    let measurement = FrameChecks.measure(frame: frame, ground: ground, style: style)
                    framesRendered += 1

                    if !measurement.violations.isEmpty {
                        framesWithViolation += 1
                        seedsWithViolation.insert(seed)
                        bySurface[surface.name, default: 0] += 1
                        for violation in measurement.violations {
                            byCategory[violation.rawValue, default: 0] += 1
                        }
                        records.append(SeedRecord(
                            seed: seed,
                            surface: surface.name,
                            momentSeconds: moment,
                            violations: measurement.violations.map(\.rawValue),
                            formCoverage: measurement.formCoverage,
                            figureGroundSeparation: measurement.figureGroundSeparation,
                            touchesBorder: measurement.touchesBorder
                        ))
                    }

                    if surface.name == "square" && moment == 0 {
                        coverageLuminance.append(measurement.medianFormLuminance)
                        let c = measurement.meanFormColor
                        hueBuckets.insert(hueBucket(r: c.r, g: c.g, b: c.b, buckets: hueBucketCount))
                    }
                }
            }
        }

        // P3: same seed, same phase, same surface, rendered again. Fingerprints
        // must match. A subset, because this doubles render cost.
        var determinismMismatches = 0
        let determinismSeeds = Array(seeds.prefix(100))
        for seed in determinismSeeds {
            let style = SeedSampler.generate(seed: seed, constitution: constitution)
            let surface = surfaces[0]
            let phase = EngineRenderer.phase(for: style, atSeconds: moments[0])
            let a = FrameChecks.fingerprint(try renderer.render(style: style, surface: surface, phase: phase))
            let b = FrameChecks.fingerprint(try renderer.render(style: style, surface: surface, phase: phase))
            if a != b { determinismMismatches += 1 }
        }

        coverageLuminance.sort()
        let p05 = percentile(coverageLuminance, 0.05)
        let p95 = percentile(coverageLuminance, 0.95)

        if let recordsOut {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(records).write(to: recordsOut)
        }

        return Summary(
            framesRendered: framesRendered,
            framesWithViolation: framesWithViolation,
            violationsByCategory: byCategory,
            violationsBySurface: bySurface,
            seedsWithAnyViolation: seedsWithViolation.count,
            seedsSampled: seeds.count,
            luminanceP05: p05,
            luminanceP95: p95,
            luminanceSpan: p95 - p05,
            hueBucketsOccupied: hueBuckets.count,
            hueBucketCount: hueBucketCount,
            determinismSeedsChecked: determinismSeeds.count,
            determinismMismatches: determinismMismatches,
            elapsedSeconds: Date().timeIntervalSince(started)
        )
    }

    private static func percentile(_ sorted: [Double], _ q: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let index = Int((Double(sorted.count - 1) * q).rounded())
        return sorted[Swift.max(0, Swift.min(sorted.count - 1, index))]
    }

    private static func hueBucket(r: Double, g: Double, b: Double, buckets: Int) -> Int {
        let maxV = Swift.max(r, Swift.max(g, b))
        let minV = Swift.min(r, Swift.min(g, b))
        let delta = maxV - minV
        guard delta > 1e-9 else { return 0 }
        var hue: Double
        if maxV == r {
            hue = 60 * (((g - b) / delta).truncatingRemainder(dividingBy: 6))
        } else if maxV == g {
            hue = 60 * (((b - r) / delta) + 2)
        } else {
            hue = 60 * (((r - g) / delta) + 4)
        }
        if hue < 0 { hue += 360 }
        return Swift.min(buckets - 1, Int(hue / (360.0 / Double(buckets))))
    }
}
