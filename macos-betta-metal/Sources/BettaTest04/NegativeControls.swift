import Foundation

/// Negative controls, run before any green Tier B result is believed.
///
/// Each control is a hand-built style engineered to violate one contract. The
/// contract must fire. A contract that has never failed on purpose has not been
/// shown to work - this series already paid for that lesson once, when a token
/// scan proved text was written rather than readable and four declarations sat
/// dead for six releases.
///
/// These styles are constructed directly, not sampled. They deliberately sit
/// outside the constitution's ranges: their job is to break a check, not to be
/// valid output.
enum NegativeControls {
    struct Control {
        let name: String
        let expected: FrameViolation
        let style: GeneratedStyle
        let surface: Surface
        let rationale: String
    }

    /// Square, forgiving: the form fits comfortably, so a control here is
    /// testing the check rather than the framing.
    static let neutralSurface = Surface(name: "control", width: 512, height: 512)

    /// Deliberately narrow. At camera distance 5.5 with a 45° vertical field of
    /// view the visible half-height at z=0 is ~2.28, so the half-width here is
    /// ~0.19 - far inside the form's maximum radius of 1.1. The form provably
    /// cannot fit, so containment must fail.
    ///
    /// This replaces an earlier control that set spread=40 and did not fire.
    /// That control was wrong: spread sweeps the fan angularly and never scales
    /// it, so it produced a fan that wrapped several times inside the same
    /// radius and stayed comfortably in frame. No style parameter can push the
    /// geometry past radius 1.1 - the form's extent is bounded by the primitive,
    /// not by the constitution - so a clipping control has to come from the
    /// surface, not from the style.
    static let narrowSurface = Surface(name: "control-narrow", width: 200, height: 2400)

    /// A style that is valid enough to draw, used as the base for perturbation.
    private static func baseline(constitution: Constitution) -> GeneratedStyle {
        SeedSampler.generate(seed: 0, constitution: constitution)
    }

    static func all(constitution: Constitution) -> [Control] {
        let base = baseline(constitution: constitution)

        // Fully transparent: nothing reaches the frame at all.
        var invisible = base
        invisible.opacity = 0.0
        // A flat ground too, so the frame really is empty. With a gradient
        // ground the difference between "no organism" and "no picture" is the
        // ground itself - which is the point of building it.
        invisible.groundSaturation = 0.0
        invisible.groundLightnessA = 0.02
        invisible.groundLightnessB = 0.02
        invisible.groundVignette = 0.0

        // Form and ground at one lightness, with the shading model tuned to
        // pass the base colour through unchanged.
        //
        // An earlier version of this control set transmission=0 and did not
        // fire. The fragment function computes base * (0.55 + 0.45 *
        // transmission), so at transmission=0 a mid-grey form renders at 0.275
        // against a 0.5 ground - genuinely distinguishable, and the check was
        // right to say so. Camouflage needs transmission=1 so the coefficient
        // sums to 1, and a near-zero depth so the fold term stops adding light.
        // A fragment sized deliberately into the illegal middle band.
        var timid = base
        timid.presenceScale = 0.21   // ~6% coverage on THIS control surface; coverage is not composition-invariant

        var camouflaged = base
        camouflaged.saturation = 0.0
        camouflaged.lightness0 = 0.5
        camouflaged.lightness1 = 0.5
        camouflaged.lightness2 = 0.5
        camouflaged.lightness3 = 0.5
        camouflaged.opacity = 1.0
        camouflaged.transmission = 1.0
        camouflaged.rimStrength = 0.0
        camouflaged.bloom = 0.0
        camouflaged.depth = 0.001
        camouflaged.groundSaturation = 0.0
        camouflaged.groundLightnessA = 0.5
        camouflaged.groundLightnessB = 0.5
        camouflaged.groundVignette = 0.0

        return [
            Control(
                name: "timid-fragment",
                expected: .r1TimidFragment,
                style: timid,
                surface: neutralSurface,
                rationale: "scaled into the gap between absent and dominant - present but small, which is the owner's stated failure"
            ),
            // An empty frame is no longer a violation: the owner accepts a frame
            // the ground carries. The control that used to test emptiness has
            // been retired rather than kept as a check that would now fire on a
            // legal result.
            Control(
                name: "camouflaged-form",
                expected: .r2RenderedFigureGroundCollapse,
                style: camouflaged,
                surface: neutralSurface,
                rationale: "transmission=1 passes the base colour through unchanged onto a ground of the same lightness; rendered separation must fail"
            ),
        ]
    }
}
