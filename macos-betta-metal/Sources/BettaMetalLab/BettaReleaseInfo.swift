import Foundation

enum BettaReleaseInfo {
    static let productName = "BETTA"
    static let version = "1.2.1"
    static let build = "27"

    // Deliberately retained from the approved releases so every composition,
    // Favorite, random organism and Studio adjustment remains in the same
    // persistence domain. Display Art interaction is transient and never writes
    // into the user's Betta design state.
    static let persistenceBundleIdentifier = "com.sindhornmidtown.BettaMetalLab"
}
