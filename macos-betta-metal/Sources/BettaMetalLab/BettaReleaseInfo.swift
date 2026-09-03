import Foundation

enum BettaReleaseInfo {
    static let productName = "BETTA"
    static let version = "1.1.4"
    static let build = "25"

    // Deliberately retained from the approved releases so every composition,
    // Favorite, random organism and Studio adjustment remains in the same
    // persistence domain. Removing Imagine does not remove any Betta artwork.
    static let persistenceBundleIdentifier = "com.sindhornmidtown.BettaMetalLab"
}
