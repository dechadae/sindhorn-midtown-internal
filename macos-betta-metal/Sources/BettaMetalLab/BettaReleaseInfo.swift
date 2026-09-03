import Foundation

enum BettaReleaseInfo {
    static let productName = "BETTA"
    static let version = "1.1.0"
    static let build = "21"

    // Deliberately retained from the approved 1.0 release so every composition,
    // Favorite, random organism, Imagine design and Studio adjustment remains
    // in the same persistence domain. A future commercial rebrand can migrate
    // this explicitly after signing identity and ownership are finalized.
    static let persistenceBundleIdentifier = "com.sindhornmidtown.BettaMetalLab"
}
