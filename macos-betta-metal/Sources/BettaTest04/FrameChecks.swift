import Foundation

/// Contracts evaluated on a rendered frame. Diagnostic only - nothing here
/// rejects a seed or asks for another. A failure is a finding about the
/// constitution or the primitives, never a reason to redraw.
enum FrameViolation: String {
    /// Containment and non-emptiness are one condition on purpose. An empty
    /// frame is trivially "not clipped", so a containment check on its own
    /// would pass on a blank screen - a contract passing for the wrong reason.
    case r1FormNotWhollyVisible = "R1_FORM_NOT_WHOLLY_VISIBLE"
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
    /// A pixel counts as form if it differs from the ground beyond this. Sits
    /// above 8-bit quantisation and dithering noise without being so high that
    /// a faint membrane edge is discarded.
    static let formDetectionEpsilon = 3.0 / 255.0

    /// The form must cover at least this fraction of the frame to count as
    /// drawn at all.
    static let minimumFormCoverage = 0.005

    /// Matches the Tier A ground-separation threshold, so the rendered check
    /// and the parameter check are asking the same question of the same number.
    static let minimumRenderedSeparation = 0.08

    static func measure(frame: Frame, style: GeneratedStyle) -> FrameMeasurement {
        let groundLuminance = EngineRenderer.groundLuminance(for: style)

        var formLuminances: [Double] = []
        formLuminances.reserveCapacity(frame.width * frame.height / 8)
        var touchesBorder = false
        var sumR = 0.0, sumG = 0.0, sumB = 0.0

        frame.pixels.withUnsafeBufferPointer { buffer in
            for y in 0..<frame.height {
                let rowStart = y * frame.width * 4
                let onVerticalEdge = (y == 0 || y == frame.height - 1)
                for x in 0..<frame.width {
                    let i = rowStart + x * 4
                    let r = buffer[i], g = buffer[i + 1], b = buffer[i + 2]
                    let l = luminance(r: r, g: g, b: b)
                    guard abs(l - groundLuminance) > formDetectionEpsilon else { continue }
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

        // One condition, evaluated together: the form must be drawn AND wholly
        // inside the frame. Either failing is the same finding.
        let drawn = coverage >= minimumFormCoverage
        if !drawn || touchesBorder {
            violations.append(.r1FormNotWhollyVisible)
        }

        // Only meaningful if something was actually drawn; an empty frame is
        // already reported by R1 and would otherwise report a second, bogus
        // violation for the same underlying fact.
        if drawn && abs(median - groundLuminance) < minimumRenderedSeparation {
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
