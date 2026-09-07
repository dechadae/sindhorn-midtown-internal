import Foundation

/// Contracts evaluated on a rendered frame. Diagnostic only - nothing here
/// rejects a seed or asks for another. A failure is a finding about the
/// constitution or the primitives, never a reason to redraw.
enum FrameViolation: String {
    /// The organism must be dominant or effectively absent, never a timid
    /// fragment in between.
    ///
    /// This replaces a containment check that demanded the form be wholly in
    /// frame - which would have rejected all eight of the owner's own locked
    /// compositions, since every one is an editorial crop. The rule is the
    /// owner's: oversized with part off screen is the best state; nearly absent
    /// works when the ground carries the picture; a small fragment that does
    /// neither is the failure.
    ///
    /// Note this contract is non-monotonic. Both extremes pass and the middle
    /// fails, which is why every monotonic metric tried against the owner's
    /// judgement scored at chance.
    case r1TimidFragment = "R1_TIMID_FRAGMENT"
    case r2RenderedFigureGroundCollapse = "R2_RENDERED_FIGURE_GROUND_COLLAPSE"
    case r3RenderNotDeterministic = "R3_RENDER_NOT_DETERMINISTIC"
}

struct FrameMeasurement {
    let formPixelCount: Int
    let totalPixels: Int
    let touchesBorder: Bool
    let medianFormLuminance: Double
    let groundLuminance: Double
    /// Mean colour of the form pixels, for the coverage question (P4). Coverage
    /// is not validity: a generator that always draws the same safe fish passes
    /// every contract here.
    let meanFormColor: (r: Double, g: Double, b: Double)
    let violations: [FrameViolation]

    var formCoverage: Double { Double(formPixelCount) / Double(totalPixels) }
    var figureGroundSeparation: Double { abs(medianFormLuminance - groundLuminance) }
    var isValid: Bool { violations.isEmpty }
}

enum FrameChecks {
    /// A pixel counts as form where the full render differs from a ground-only
    /// render of the same style beyond this.
    ///
    /// The previous method compared each pixel to a single mean ground
    /// luminance, which was adequate while the ground was a flat fill and
    /// became nonsense the moment it became a gradient: almost every pixel
    /// differs from a mean, so ~90% of every frame registered as organism
    /// regardless of what was drawn. Differencing two renders is exact and
    /// indifferent to how complicated the ground gets.
    static let formDetectionEpsilon = 4.0 / 255.0

    /// Below this the organism is effectively absent and the ground is the
    /// picture, which is a legal result.
    static let absentCoverage = 0.02

    /// At or above this the organism is dominant, which is the other legal
    /// result. Between the two is the timid fragment.
    static let dominantCoverage = 0.18

    /// Matches the Tier A ground-separation threshold, so the rendered check
    /// and the parameter check are asking the same question of the same number.
    static let minimumRenderedSeparation = 0.08

    static func measure(
        frame: Frame,
        ground: Frame,
        style: GeneratedStyle
    ) -> FrameMeasurement {
        let groundLuminance = EngineRenderer.groundLuminance(for: style)

        var formLuminances: [Double] = []
        formLuminances.reserveCapacity(frame.width * frame.height / 8)
        var touchesBorder = false
        var sumR = 0.0, sumG = 0.0, sumB = 0.0

        frame.pixels.withUnsafeBufferPointer { buffer in
          ground.pixels.withUnsafeBufferPointer { bg in
            for y in 0..<frame.height {
                let rowStart = y * frame.width * 4
                let onVerticalEdge = (y == 0 || y == frame.height - 1)
                for x in 0..<frame.width {
                    let i = rowStart + x * 4
                    let r = buffer[i], g = buffer[i + 1], b = buffer[i + 2]
                    let l = luminance(r: r, g: g, b: b)
                    // Against the ground-only render at this same pixel.
                    let d = max(abs(Double(r) - Double(bg[i])),
                                max(abs(Double(g) - Double(bg[i + 1])),
                                    abs(Double(b) - Double(bg[i + 2])))) / 255.0
                    guard d > formDetectionEpsilon else { continue }
                    formLuminances.append(l)
                    sumR += Double(r) / 255.0
                    sumG += Double(g) / 255.0
                    sumB += Double(b) / 255.0
                    if onVerticalEdge || x == 0 || x == frame.width - 1 {
                        touchesBorder = true
                    }
                }
            }
          }
        }

        let totalPixels = frame.width * frame.height
        let coverage = Double(formLuminances.count) / Double(totalPixels)
        let median: Double
        if formLuminances.isEmpty {
            median = groundLuminance
        } else {
            formLuminances.sort()
            median = formLuminances[formLuminances.count / 2]
        }

        var violations: [FrameViolation] = []

        // Dominant or absent, never in between. Touching the border is not a
        // fault - it is the intent.
        let absent = coverage <= absentCoverage
        let dominant = coverage >= dominantCoverage
        if !absent && !dominant {
            violations.append(.r1TimidFragment)
        }

        // Only asked of a frame the organism actually carries. When the ground
        // is the picture there is no figure to separate from it.
        if dominant && abs(median - groundLuminance) < minimumRenderedSeparation {
            violations.append(.r2RenderedFigureGroundCollapse)
        }

        let n = Double(Swift.max(formLuminances.count, 1))
        return FrameMeasurement(
            formPixelCount: formLuminances.count,
            totalPixels: totalPixels,
            touchesBorder: touchesBorder,
            medianFormLuminance: median,
            groundLuminance: groundLuminance,
            meanFormColor: (sumR / n, sumG / n, sumB / n),
            violations: violations
        )
    }

    /// FNV-1a over the pixel bytes. Used only to compare two renders of the
    /// same input, so collision resistance is not the property being relied on.
    static func fingerprint(_ frame: Frame) -> UInt64 {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in frame.pixels {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return hash
    }
}
