import Foundation

/// One arm of the judging experiment: a constitution plus a source of framing.
///
/// The first run held the composition constant - every arm drew from the
/// owner's eight locked crops - which made the largest effect in the experiment
/// unmeasurable. Across 244 judgements the arm explained a 5-point spread
/// (p = 0.79) and the composition explained 42 (p < 0.0001). The framing was
/// doing the work and nothing was set up to see it.
///
/// So framing becomes a factor. `locked` picks one of the owner's eight;
/// `randomised` draws seven floats from the box those eight occupy. The locked
/// compositions themselves are never written to, only read.
struct JudgeArm {
    let name: String
    let constitution: Constitution
    let framing: Framing

    enum Framing {
        /// One of the owner's eight, chosen uniformly.
        case locked
        /// Seven floats from the envelope of those eight.
        case randomised
    }
}

extension Composition {
    /// The box the eight locked compositions occupy, component by component.
    ///
    /// Deliberately the tightest honest baseline: it holds "framing of roughly
    /// this kind" constant so the comparison isolates the hand-tuning rather
    /// than the region. Note that eight points in seven dimensions occupy
    /// almost none of their own bounding box, so a uniform draw here is not a
    /// draw *near* a locked composition - most land nowhere any of the eight
    /// sit. The arm asks whether the region is enough, not whether a nearby
    /// crop is as good.
    enum Envelope {
        static let scale = Bounds(min: 1.25, max: 1.90)
        static let x = Bounds(min: -6.69, max: 8.00)
        static let y = Bounds(min: -2.85, max: 3.84)
        static let z = Bounds(min: -1.75, max: 0.19)
        static let rotationX = Bounds(min: -56.85, max: 26.84)
        static let rotationY = Bounds(min: -30.49, max: 165.00)
        static let rotationZ = Bounds(min: -90.00, max: 90.00)
    }

    /// A framing derived from `seed`, on its own random stream.
    ///
    /// The stream is offset from the seed so that it never draws from the one
    /// `SeedSampler` uses. That is what makes the two C arms a clean pair: for
    /// a given seed the organism is bit-identical in both, and only the crop
    /// differs. If this shared a stream with the style, changing the framing
    /// would silently change the fish as well and the comparison would be
    /// measuring two things at once.
    static func randomised(seed: UInt64) -> Composition {
        var rng = SplitMix64(seed: seed ^ 0xC0FF_EE00_1DEA_5EED)
        return Composition(
            scale: Float(Envelope.scale.sample(&rng)),
            x: Float(Envelope.x.sample(&rng)),
            y: Float(Envelope.y.sample(&rng)),
            z: Float(Envelope.z.sample(&rng)),
            rotationX: Float(Envelope.rotationX.sample(&rng)),
            rotationY: Float(Envelope.rotationY.sample(&rng)),
            rotationZ: Float(Envelope.rotationZ.sample(&rng))
        )
    }
}

/// Hands out arms in shuffled blocks rather than independently at random.
///
/// The first run assigned each frame independently and finished 83/89/72 - and
/// an unbalanced split is the lesser problem. The real risk over a session of
/// 200 judgements is that the owner's standard drifts as his eye tunes; with
/// independent assignment any drift lands unevenly on the arms and shows up as
/// an arm effect. A block containing one of each arm, shuffled within itself,
/// keeps the arms level through every stretch of the session.
struct ArmRotation {
    private let arms: [JudgeArm]
    private var bag: [JudgeArm] = []

    init(_ arms: [JudgeArm]) {
        self.arms = arms
    }

    mutating func next() -> JudgeArm? {
        guard !arms.isEmpty else { return nil }
        if bag.isEmpty { bag = arms.shuffled() }
        return bag.removeLast()
    }
}
