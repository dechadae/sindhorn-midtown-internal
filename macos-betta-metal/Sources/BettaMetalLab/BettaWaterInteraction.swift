import AppKit
import Foundation
import simd

struct BettaWaterInteractionSample: Equatable {
    var position: SIMD2<Float>
    var velocity: SIMD2<Float>
    var strength: Float
    var age: Float
}

enum BettaWaterInteractionMath {
    /// Spatial calibration for the Metal interaction field. This is a fraction
    /// of total display width, not a pixel count. The shader mirrors this value
    /// so a primary wave reaches the same proportion on 1080p, 4K, 5K and
    /// Retina displays.
    static let primaryRadiusScreenWidthFraction: Float = 0.26
    static let primaryDiameterScreenWidthFraction: Float = primaryRadiusScreenWidthFraction * 2

    static func strength(forNormalizedSpeed speed: Float, impulse: Float = 0) -> Float {
        let s = max(0, min(3, speed))
        return max(0, min(1.18, 0.10 + s * 0.29 + max(0, impulse) * 0.62))
    }

    static func decay(age: Float) -> Float {
        exp(-max(0, age) * 1.55)
    }

    static func clampedVelocity(_ velocity: SIMD2<Float>) -> SIMD2<Float> {
        let length = simd_length(velocity)
        guard length > 3, length > 0.0001 else { return velocity }
        return velocity / length * 3
    }
}

/// Process-wide transient interaction field used only while Display Art is
/// active. Nothing here is persisted to a Betta, Favorite, Original or Studio
/// adjustment. The renderer samples this state and lets it naturally decay.
final class BettaWaterInteractionStore: @unchecked Sendable {
    static let shared = BettaWaterInteractionStore()

    private let lock = NSLock()
    private var enabled = false
    private var position = SIMD2<Float>(8, 8)
    private var velocity = SIMD2<Float>.zero
    private var baseStrength: Float = 0
    private var lastUpdate: TimeInterval = 0

    private init() {}

    func begin() {
        lock.lock()
        enabled = true
        position = SIMD2<Float>(8, 8)
        velocity = .zero
        baseStrength = 0
        lastUpdate = ProcessInfo.processInfo.systemUptime
        lock.unlock()
    }

    func push(positionNDC: SIMD2<Float>, velocity: SIMD2<Float>, impulse: Float = 0) {
        let now = ProcessInfo.processInfo.systemUptime
        let v = BettaWaterInteractionMath.clampedVelocity(velocity)
        let speed = simd_length(v)
        lock.lock()
        enabled = true
        position = SIMD2<Float>(
            max(-1.2, min(1.2, positionNDC.x)),
            max(-1.2, min(1.2, positionNDC.y))
        )
        self.velocity = v
        baseStrength = max(baseStrength * 0.62, BettaWaterInteractionMath.strength(forNormalizedSpeed: speed, impulse: impulse))
        lastUpdate = now
        lock.unlock()
    }

    func end() {
        lock.lock()
        enabled = false
        position = SIMD2<Float>(8, 8)
        velocity = .zero
        baseStrength = 0
        lastUpdate = 0
        lock.unlock()
    }

    func sample(now: TimeInterval = ProcessInfo.processInfo.systemUptime) -> BettaWaterInteractionSample {
        lock.lock()
        let isEnabled = enabled
        let p = position
        let v = velocity
        let strength = baseStrength
        let updated = lastUpdate
        lock.unlock()

        guard isEnabled else {
            return BettaWaterInteractionSample(position: SIMD2<Float>(8, 8), velocity: .zero, strength: 0, age: 99)
        }
        let age = Float(max(0, now - updated))
        let decay = BettaWaterInteractionMath.decay(age: age)
        return BettaWaterInteractionSample(
            position: p,
            velocity: v * decay,
            strength: strength * decay,
            age: age
        )
    }
}

/// A tiny procedural pointer drawn by AppKit. The system arrow is hidden only
/// during Display Art. This view deliberately contains no bitmap or generated
/// image asset; it is a simple water-touch ring that expands subtly with speed.
/// The pointer itself stays intentionally small even though the underwater
/// pressure field now spans roughly half the display width.
@MainActor
final class BettaWaterCursorView: NSView {
    private var speed: CGFloat = 0

    override var isOpaque: Bool { false }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    func update(center: NSPoint, normalizedSpeed: Float) {
        speed = CGFloat(max(0, min(3, normalizedSpeed)))
        let diameter = 24 + speed * 7
        frame = NSRect(x: center.x - diameter / 2, y: center.y - diameter / 2, width: diameter, height: diameter)
        alphaValue = 0.82 + min(0.16, speed * 0.05)
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let outer = bounds.insetBy(dx: 1.5, dy: 1.5)
        let inner = bounds.insetBy(dx: 5.0, dy: 5.0)

        NSColor.black.withAlphaComponent(0.28).setStroke()
        let shadowRing = NSBezierPath(ovalIn: outer)
        shadowRing.lineWidth = 3.5
        shadowRing.stroke()

        NSColor(calibratedRed: 0.84, green: 0.96, blue: 1.0, alpha: 0.94).setStroke()
        let waterRing = NSBezierPath(ovalIn: outer)
        waterRing.lineWidth = 1.35
        waterRing.stroke()

        NSColor.white.withAlphaComponent(0.66).setStroke()
        let innerRing = NSBezierPath(ovalIn: inner)
        innerRing.lineWidth = 0.75
        innerRing.stroke()

        let dotSize: CGFloat = 2.4 + min(2.2, speed)
        NSColor.white.withAlphaComponent(0.88).setFill()
        NSBezierPath(ovalIn: NSRect(x: bounds.midX - dotSize / 2, y: bounds.midY - dotSize / 2, width: dotSize, height: dotSize)).fill()
    }
}
