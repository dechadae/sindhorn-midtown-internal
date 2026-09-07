import Foundation

/// SplitMix64 - the same algorithm the production Betta uses on every platform,
/// so a seed means the same thing everywhere.
///
/// One deliberate difference from `BettaRandomStyleStore`'s copy: `unit()` stays
/// in `Double`. That store returns `Float`, and the web engine uses a JS `Number`
/// (a Double). The raw u64 stream is identical either way, but the derived values
/// diverge in the low bits - enough to flip a contract result for a value sitting
/// on a boundary. If one constitution is to be consumed by several platforms, the
/// arithmetic precision it is sampled in belongs to the constitution, not to the
/// implementation. Recorded as a finding rather than silently reconciled.
struct SplitMix64 {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func nextRaw() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// A Double in [0, 1).
    mutating func unit() -> Double {
        Double(nextRaw() >> 11) / 9_007_199_254_740_992.0
    }

    mutating func range(_ lower: Double, _ upper: Double) -> Double {
        lower + (upper - lower) * unit()
    }
}
