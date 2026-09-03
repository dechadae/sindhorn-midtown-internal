import Foundation

enum BettaReleaseInfo {
    static let productName = "BETTA"
    static let version = "1.0.0"
    static let build = "20"

    // Deliberately retained for the first 1.0 technical release so every
    // composition, Favorite, random organism and Studio adjustment created in
    // 0.3–0.6 remains available without migration risk. A future commercial
    // rebrand may migrate this domain explicitly after product ownership and
    // signing identity are finalized.
    static let persistenceBundleIdentifier = "com.sindhornmidtown.BettaMetalLab"
}
