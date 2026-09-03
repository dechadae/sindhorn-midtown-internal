import Foundation

struct BettaMorphFrame {
    let fromIndex: Int
    let toIndex: Int
    let mix: Float
}

final class BettaMorphState {
    private(set) var mode: BettaRunMode = .live
    private(set) var fromIndex: Int
    private(set) var toIndex: Int
    private var transitionStart: TimeInterval = 0
    private var transitionDuration: TimeInterval = 0
    private var previewStart: TimeInterval = 0

    init(now: TimeInterval = ProcessInfo.processInfo.systemUptime, date: Date = Date()) {
        let index = Self.bangkokIndex(for: date)
        fromIndex = index
        toIndex = index
        transitionStart = now
    }

    func setManual(_ index: Int, now: TimeInterval) {
        mode = .manual(max(0, min(7, index)))
        transition(to: max(0, min(7, index)), duration: BettaSettings.manualMorphSeconds, now: now)
    }

    func useLive(now: TimeInterval, date: Date = Date()) {
        mode = .live
        transition(to: Self.bangkokIndex(for: date), duration: BettaSettings.manualMorphSeconds, now: now)
    }

    func usePreview(now: TimeInterval) {
        mode = .preview
        previewStart = now
        transition(to: 0, duration: BettaSettings.previewMorphSeconds, now: now)
    }

    func cycle(direction: Int, now: TimeInterval) {
        let next = (toIndex + (direction >= 0 ? 1 : 7)) % 8
        setManual(next, now: now)
    }

    func frame(now: TimeInterval, date: Date = Date()) -> BettaMorphFrame {
        switch mode {
        case .live:
            let desired = Self.bangkokIndex(for: date)
            if desired != toIndex {
                transition(to: desired, duration: BettaSettings.liveRolloverSeconds, now: now)
            }
        case .manual:
            break
        case .preview:
            let elapsed = (now - previewStart).truncatingRemainder(dividingBy: BettaSettings.previewCycleSeconds)
            let normalized = max(0, elapsed) / BettaSettings.previewCycleSeconds
            let desired = min(7, Int(normalized * 8))
            if desired != toIndex {
                transition(to: desired, duration: BettaSettings.previewMorphSeconds, now: now)
            }
        }

        if fromIndex == toIndex || transitionDuration <= 0 {
            return BettaMorphFrame(fromIndex: toIndex, toIndex: toIndex, mix: 1)
        }
        let raw = Float(max(0, min(1, (now - transitionStart) / transitionDuration)))
        let eased = smootherstep(raw)
        if raw >= 1 {
            fromIndex = toIndex
            transitionDuration = 0
            return BettaMorphFrame(fromIndex: toIndex, toIndex: toIndex, mix: 1)
        }
        return BettaMorphFrame(fromIndex: fromIndex, toIndex: toIndex, mix: eased)
    }

    var modeLabel: String {
        switch mode {
        case .live: return "Live Bangkok"
        case .manual: return "Manual"
        case .preview: return "3-minute preview"
        }
    }

    static func bangkokIndex(for date: Date) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = BettaSettings.bangkokTimeZone
        let hour = calendar.component(.hour, from: date)
        return max(0, min(7, hour / 3))
    }

    private func transition(to index: Int, duration: TimeInterval, now: TimeInterval) {
        guard index != toIndex else { return }
        fromIndex = toIndex
        toIndex = index
        transitionStart = now
        transitionDuration = max(0, duration)
    }
}
