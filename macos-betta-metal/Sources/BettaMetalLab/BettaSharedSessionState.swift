import Foundation

enum BettaSharedPresentationMode: Equatable {
    case live
    case manual(Int)
    case preview
}

/// Process-wide presentation intent shared by the primary renderer, mirrored
/// desktop renderers and Ambient Screen surfaces. Artistic state itself remains
/// in the existing canonical composition/advanced/random stores.
final class BettaSharedSessionState {
    static let shared = BettaSharedSessionState()

    private let lock = NSLock()
    private var _mode: BettaSharedPresentationMode = .live
    private var _revision: UInt64 = 0

    private init() {}

    var snapshot: (mode: BettaSharedPresentationMode, revision: UInt64) {
        lock.lock(); defer { lock.unlock() }
        return (_mode, _revision)
    }

    func set(_ mode: BettaSharedPresentationMode) {
        lock.lock(); defer { lock.unlock() }
        guard mode != _mode else { return }
        _mode = mode
        _revision &+= 1
    }
}
