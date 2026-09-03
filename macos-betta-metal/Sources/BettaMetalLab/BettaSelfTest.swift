import Foundation

struct BettaSelfTest {
    static func run() -> Bool {
        var failures: [String] = []
        func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
            if !condition() { failures.append(message) }
        }

        expect(BettaReleaseInfo.productName == "BETTA", "Release product name must be BETTA")
        expect(BettaReleaseInfo.version == "1.1.1", "Release semantic version must be 1.1.1")
        expect(BettaReleaseInfo.build == "22", "Release build number must be 22")
        expect(BettaReleaseInfo.persistenceBundleIdentifier == "com.sindhornmidtown.BettaMetalLab", "1.1.1 must preserve the existing persistence bundle identifier")

        expect(BettaPreset.all.count == 8, "Expected exactly eight canonical Betta presets")
        expect(BettaGeometry.rays == 160, "Mac high-detail topology must use 160 circumferential samples")
        expect(BettaGeometry.radialSegments == 144, "Mac high-detail topology must use 144 radial samples")
        expect(abs(BettaCompositionAdjustment.landscapeDefault.rotationZ - 90) < 0.001, "Landscape default must preserve the approved 90° CW composition")

        expect(abs(BettaSettings.manualMorphSeconds - 18) < 0.001, "Manual/original preset morph must use premium 18-second pacing")
        expect(abs(BettaSettings.liveRolloverSeconds - 90) < 0.001, "Live Bangkok rollover must use premium 90-second pacing")
        expect(abs(BettaSettings.previewMorphSeconds - 12) < 0.001, "Compressed preview morph must use 12-second pacing")
        expect(abs(smootherstep(0)) < 0.0001 && abs(smootherstep(1) - 1) < 0.0001, "Smootherstep easing must preserve exact endpoints")
        expect(abs(smootherstep(0.5) - 0.5) < 0.0001, "Smootherstep easing must be symmetric at the midpoint")
        expect(smootherstep(0.1) < cubicOut(0.1), "Premium easing must start more gently than the legacy cubic-out morph")

        let atmosphereMetrics = BettaAtmosphereMetrics(
            infraredLuma: 0.72,
            infraredContrast: 0.12,
            vaporLuma: 0.64,
            vaporContrast: 0.10,
            trueColorLuma: 0.44,
            trueColorRGB: SIMD3<Float>(0.28, 0.36, 0.52),
            motionStrength: 0.22,
            motion: SIMD2<Float>(0.18, -0.11),
            fingerprint: SIMD3<Float>(0.61, 0.54, 0.68)
        )
        let atmosphereState = BettaAtmosphereMath.makeState(metrics: atmosphereMetrics)
        expect(atmosphereState.cloud > 0.6, "Bright infrared cloud structure must raise the Himawari cloud mood")
        expect(atmosphereState.vapor > 0.6, "Water-vapor signal must influence the atmosphere state")
        expect(atmosphereState.motion.x > 0 && atmosphereState.motion.y < 0, "Satellite motion direction must survive normalized mood mapping")
        expect(atmosphereState.color.z > atmosphereState.color.x, "Cool Bangkok satellite color should remain blue-biased after artistic clamping")
        expect(BettaSettings.neutralSatelliteBaseline == BettaEnvironmentStore.shared.current, "Environment store must boot from the exact deterministic neutral baseline")

        expect(
            BettaEnergyPolicy.profile(desktopMode: false, windowVisible: false, occluded: true, lowPower: false, thermalState: .nominal) == .paused,
            "Hidden non-desktop rendering must pause"
        )
        expect(
            BettaEnergyPolicy.profile(desktopMode: false, windowVisible: true, occluded: false, lowPower: true, thermalState: .nominal) == .balanced,
            "Visible Low Power Mode rendering must use the balanced 30 fps profile"
        )
        expect(
            BettaEnergyPolicy.profile(desktopMode: true, windowVisible: true, occluded: true, lowPower: false, thermalState: .nominal) == .ambient,
            "Fully occluded desktop rendering must drop to the ambient profile"
        )
        expect(
            BettaEnergyPolicy.profile(desktopMode: true, windowVisible: true, occluded: false, lowPower: false, thermalState: .nominal) == .full,
            "Visible healthy desktop rendering must retain full 60 fps quality"
        )

        for preset in BettaPreset.all {
            expect(preset.layers.count == 2, "Fish #\(preset.referenceId) must keep two canonical membrane endpoints")
            expect(preset.palette.count == 4, "Fish #\(preset.referenceId) must keep four palette stops")
            expect(preset.background.count == 3, "Fish #\(preset.referenceId) must keep three background gradient stops")
            let advanced = BettaAdvancedAdjustment.canonical(preset)
            expect(advanced.membraneCount == 2, "Fish #\(preset.referenceId) must start with two rendered membranes")
            expect(abs(advanced.tail.rayCount - Float(preset.params.rayCount)) < 0.001, "Fish #\(preset.referenceId) ray detail must start at canonical count")
            expect(abs(advanced.tail.microFold - 1) < 0.001, "Fish #\(preset.referenceId) micro detail must start neutral")
            expect(abs(advanced.camera.fov - 32) < 0.001 && abs(advanced.camera.z - 9) < 0.001, "Camera defaults must preserve production framing")

            var highMembrane = advanced
            highMembrane.membraneCount = 99
            expect(highMembrane.normalized.membraneCount == 6, "Membrane count must clamp to the supported maximum of six")
            highMembrane.membraneCount = 0
            expect(highMembrane.normalized.membraneCount == 1, "Membrane count must clamp to at least one")
        }

        let mustard = BettaPreset.all[4]
        let immutableMustardStyle = BettaRandomStyleStore.originalStyle(for: mustard, seed: 0xBEE5)
        expect(immutableMustardStyle.resolvedPalette == mustard.palette, "Mustard Galaxy Koi original palette must remain immutable and recoverable")
        expect(immutableMustardStyle.resolvedBackground == mustard.background, "Mustard Galaxy Koi original background must remain immutable and recoverable")
        expect(immutableMustardStyle.seed == 0xBEE5, "Original-color restore must preserve the supplied organism seed metadata")

        let referenceId = BettaPreset.all[0].referenceId
        let originalSnapshot = BettaImagineSnapshot.capture(referenceId: referenceId)
        let currentAdvanced = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
        let currentComposition = BettaCompositionStore.shared.adjustment(for: referenceId)
        if let generation = BettaRandomStyleStore.shared.makeGeneration(referenceId: referenceId) {
            expect(generation.style.resolvedPalette?.count == 4, "Random generation must create four palette stops")
            expect(generation.style.resolvedBackground?.count == 3, "Random generation must create three matching background stops")
            expect(generation.adjustment.camera == currentAdvanced.camera, "Random generation must preserve the user's camera")
            expect(generation.adjustment.membraneCount == currentAdvanced.membraneCount, "Random generation must preserve the user's membrane count")
        } else {
            failures.append("Random Betta generator could not create an evolution target")
        }

        _ = BettaRandomStyleStore.shared.restoreOriginalColors(referenceId: referenceId)
        expect(BettaAdvancedTuningStore.shared.adjustment(for: referenceId) == currentAdvanced, "Restoring original colors must not modify tail/camera/membrane settings")
        expect(BettaCompositionStore.shared.adjustment(for: referenceId) == currentComposition, "Restoring original colors must not modify scale/position/XYZ rotation")

        // Imagine's deterministic contract is tested without invoking Apple
        // Intelligence: model output may only enter this constrained apply path.
        if var design = BettaImagineDesign.current(referenceId: referenceId) {
            let beforeImagine = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
            let beforeComposition = BettaCompositionStore.shared.adjustment(for: referenceId)
            design.spread = 999
            design.rayCount = 999
            design.membraneCount = 99
            design.palette = [
                BettaImagineColor(r: 1.2, g: -0.1, b: 0.4),
                BettaImagineColor(r: 0.2, g: 0.8, b: 1.4),
                BettaImagineColor(r: 0.9, g: 0.3, b: 0.2),
                BettaImagineColor(r: 1.0, g: 0.9, b: 0.1)
            ]
            design.background = [
                BettaImagineColor(r: 1.0, g: 0.99, b: 0.96),
                BettaImagineColor(r: 0.94, g: 0.97, b: 1.0),
                BettaImagineColor(r: 0.78, g: 0.88, b: 0.96)
            ]
            expect(design.apply(referenceId: referenceId), "Imagine structured design must apply through the constrained state bridge")
            let afterImagine = BettaAdvancedTuningStore.shared.adjustment(for: referenceId)
            expect(abs(afterImagine.tail.spread - 4.8) < 0.001, "Imagine tail spread must pass through existing production clamps")
            expect(abs(afterImagine.tail.rayCount - 160) < 0.001, "Imagine ray count must pass through existing production clamps")
            expect(afterImagine.membraneCount == 6, "Imagine membrane count must clamp to six")
            expect(afterImagine.camera == beforeImagine.camera, "Imagine must never change the camera")
            expect(afterImagine.frontLayer == beforeImagine.frontLayer && afterImagine.backLayer == beforeImagine.backLayer, "Imagine must never change membrane endpoint placement")
            expect(BettaCompositionStore.shared.adjustment(for: referenceId) == beforeComposition, "Imagine must never change scale/position/XYZ rotation")
            if let style = BettaRandomStyleStore.shared.style(for: referenceId),
               let colors = style.resolvedPalette,
               let background = style.resolvedBackground {
                expect(colors.count == 4 && background.count == 3, "Imagine must produce exactly four palette and three background stops")
                expect(colors.allSatisfy { $0.x >= 0 && $0.x <= 1 && $0.y >= 0 && $0.y <= 1 && $0.z >= 0 && $0.z <= 1 }, "Imagine palette colors must be normalized")
                expect(background.allSatisfy { $0.x >= 0 && $0.x <= 1 && $0.y >= 0 && $0.y <= 1 && $0.z >= 0 && $0.z <= 1 }, "Imagine background colors must use the full normalized RGB range")
                expect(background[0].x > 0.95 && background[0].y > 0.95 && background[0].z > 0.90, "Imagine must preserve luminous near-white backgrounds instead of forcing them dark")
            } else {
                failures.append("Imagine structured design did not store a valid palette/background")
            }
            expect(!design.promptJSON.isEmpty && design.promptJSON != "{}", "Imagine must serialize the current organism for conversational refinement")
        } else {
            failures.append("Imagine could not snapshot the current organism")
        }
        originalSnapshot?.restore()

        let pureWhite = BettaImagineColor(r: 1, g: 1, b: 1).backgroundSIMD
        expect(abs(pureWhite.x - 1) < 0.0001 && abs(pureWhite.y - 1) < 0.0001 && abs(pureWhite.z - 1) < 0.0001, "Imagine backgrounds must permit clean white")

        expect(abs(BettaEvolutionController.defaultSegmentDuration - 45) < 0.001, "Continuous Evolution target duration must remain 45 seconds")

        expect(
            !BettaDiagnostics.representsIncompleteLaunch(completed: false, lastStage: "random.generated", log: ["startup.complete", "random.generated"]),
            "A healthy launch followed by Random Betta activity must never become a recovery failure"
        )
        expect(
            !BettaDiagnostics.representsIncompleteLaunch(completed: false, lastStage: "evolution.started", log: ["window.visible", "startup.complete", "evolution.started"]),
            "A healthy launch followed by Continuous Evolution must remain completed"
        )
        expect(
            BettaDiagnostics.representsIncompleteLaunch(completed: false, lastStage: "renderer.init.begin", log: ["diagnostics.begin", "renderer.init.begin"]),
            "A true startup interruption before startup.complete must still trigger recovery"
        )

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
        expect(abs(portrait.rotationXOffset) < 0.0001 && abs(portrait.rotationYOffset) < 0.0001 && abs(portrait.rotationZOffset) < 0.0001, "Portrait mapping must not apply landscape rotation")

        let landscape = BettaLandscapeMapper.map(position: source, aspect: 16.0 / 9.0, referenceId: 1, camera: .canonical)
        expect(landscape.position.x > source.x, "Landscape mapper must keep right-edge entry intent")
        expect(abs(landscape.position.y - source.y) < 0.0001, "Landscape mapper must preserve vertical art direction")
        expect(abs(landscape.rotationZOffset) > 1.0, "Landscape mapper must apply the saved full-axis Z rotation")

        expect(abs(cubicOut(0) - 0) < 0.0001, "Legacy cubic easing helper must start at zero")
        expect(abs(cubicOut(1) - 1) < 0.0001, "Legacy cubic easing helper must finish at one")

        if failures.isEmpty {
            print("BETTA \(BettaReleaseInfo.version) (\(BettaReleaseInfo.build)) self-test: PASS")
            print("Imagine frameless glass direction · full-range mood backgrounds · camera/composition isolation · 8 immutable originals · premium morph pacing · live Himawari mood mapping · adaptive energy policy · multi-display release shell · 160×144 topology · 1–6 membranes · presets/favorites · continuous evolution · recovery regression")
            return true
        }
        print("BETTA \(BettaReleaseInfo.version) self-test: FAIL")
        failures.forEach { print("- \($0)") }
        return false
    }
}
