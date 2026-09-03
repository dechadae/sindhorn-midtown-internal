import Foundation

enum BettaReleaseInfo {
    static let productName = "BETTA"
    static let version = "1.1.1"
    static let build = "22"

    // Deliberately retained from the approved 1.0/1.1 releases so every
    // composition, Favorite, random organism, Imagine design and Studio
    // adjustment remains in the same persistence domain.
    static let persistenceBundleIdentifier = "com.sindhornmidtown.BettaMetalLab"
}
