import Foundation

struct BettaSelfTest {
    static func run() -> Bool {
        var failures: [String] = []
        func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
            if !condition() { failures.append(message) }
        }

        expect(BettaPreset.all.count == 8, "Expected exactly eight canonical Betta presets")
        expect(BettaGeometry.rays == 160, "Mac high-detail topology must use 160 circumferential samples")
        expect(BettaGeometry.radialSegments == 144, "Mac high-detail topology must use 144 radial samples")
        for preset in BettaPreset.all {
            expect(preset.layers.count == 2, "Fish #\(preset.referenceId) must keep two membrane layers")
            expect(preset.palette.count == 4, "Fish #\(preset.referenceId) must keep four palette stops")
            expect(preset.background.count == 3, "Fish #\(preset.referenceId) must keep three background gradient stops")
            let advanced = BettaAdvancedAdjustment.canonical(preset)
            expect(abs(advanced.tail.rayCount - Float(preset.params.rayCount)) < 0.001, "Fish #\(preset.referenceId) ray detail must start at canonical count")
            expect(abs(advanced.tail.microFold - 1) < 0.001, "Fish #\(preset.referenceId) micro detail must start neutral")
            expect(abs(advanced.camera.fov - 32) < 0.001 && abs(advanced.camera.z - 9) < 0.001, "Camera defaults must preserve production framing")
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = BettaSettings.bangkokTimeZone
        for index in 0..<8 {
            var parts = DateComponents()
            parts.calendar = calendar
            parts.timeZone = BettaSettings.bangkokTimeZone
            parts.year = 2026; parts.month = 9; parts.day = 1
            parts.hour = index * 3 + 1; parts.minute = 0
            if let date = calendar.date(from: parts) {
                expect(BettaMorphState.bangkokIndex(for: date) == index, "Bangkok 3-hour slot \(index) maps incorrectly")
            } else {
                failures.append("Could not create test date for slot \(index)")
            }
        }

        let source = SIMD3<Float>(1.88, -0.80, 0.10)
        let portrait = BettaLandscapeMapper.map(position: source, aspect: 9.0 / 16.0, referenceId: 1, camera: .canonical)
        expect(abs(portrait.position.x - source.x) < 0.0001, "Portrait mapping must remain identity")
        let landscape = BettaLandscapeMapper.map(position: source, aspect: 16.0 / 9.0, referenceId: 1, camera: .canonical)
        expect(landscape.position.x > source.x, "Landscape mapper must keep right-edge entry intent")
        expect(abs(landscape.position.y - source.y) < 0.0001, "Landscape mapper must preserve vertical art direction")

        expect(abs(cubicOut(0) - 0) < 0.0001, "Cubic easing must start at zero")
        expect(abs(cubicOut(1) - 1) < 0.0001, "Cubic easing must finish at one")

        if failures.isEmpty {
            print("Betta Metal Lab self-test: PASS")
            print("8 presets · 160×144 high-detail topology · 2 layers · full per-tail camera/detail controls · Bangkok schedule")
            return true
        }
        print("Betta Metal Lab self-test: FAIL")
        failures.forEach { print("- \($0)") }
        return false
    }
}
