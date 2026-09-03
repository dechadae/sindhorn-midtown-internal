import AppKit
import Foundation
import MetalKit
import ServiceManagement

enum BettaEnergyProfile: String, Equatable {
    case full = "Full · 60 fps"
    case balanced = "Balanced · 30 fps"
    case ambient = "Ambient · 15 fps"
    case paused = "Paused"
}

enum BettaEnergyPolicy {
    static func profile(
        desktopMode: Bool,
        windowVisible: Bool,
        occluded: Bool,
        lowPower: Bool,
        thermalState: ProcessInfo.ThermalState
    ) -> BettaEnergyProfile {
        if !desktopMode && (!windowVisible || occluded) { return .paused }

        switch thermalState {
        case .critical, .serious:
            return .ambient
        default:
            break
        }

        if desktopMode {
            if occluded || lowPower { return .ambient }
            return .full
        }

        if lowPower { return .balanced }
        return .full
    }
}

@MainActor
final class BettaEnergyController {
    private weak var view: MTKView?
    private weak var window: BettaDesktopWindow?
    private var timer: Timer?
    private(set) var profile: BettaEnergyProfile = .full

    var statusText: String { "Energy · \(profile.rawValue)" }

    func start(view: MTKView, window: BettaDesktopWindow) {
        self.view = view
        self.window = window
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            self?.evaluate()
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
        evaluate()
    }

    func stop() {
        timer?.invalidate(); timer = nil
    }

    func evaluate() {
        guard let view, let window else { return }
        let isWindowVisible = window.isVisible && !window.isMiniaturized
        let occluded = !window.occlusionState.contains(.visible)
        let next = BettaEnergyPolicy.profile(
            desktopMode: window.desktopMode,
            windowVisible: isWindowVisible,
            occluded: occluded,
            lowPower: ProcessInfo.processInfo.isLowPowerModeEnabled,
            thermalState: ProcessInfo.processInfo.thermalState
        )
        guard next != profile || view.isPaused == (next != .paused) else { return }
        profile = next

        switch next {
        case .full:
            view.preferredFramesPerSecond = 60
            view.isPaused = false
        case .balanced:
            view.preferredFramesPerSecond = 30
            view.isPaused = false
        case .ambient:
            view.preferredFramesPerSecond = 15
            view.isPaused = false
        case .paused:
            view.isPaused = true
        }
    }
}

@MainActor
final class BettaLaunchAtLoginController {
    var isEnabled: Bool {
        if #available(macOS 13.0, *) {
            return SMAppService.mainApp.status == .enabled
        }
        return false
    }

    func setEnabled(_ enabled: Bool) -> Result<Bool, Error> {
        guard #available(macOS 13.0, *) else {
            let error = NSError(domain: "BETTA.LaunchAtLogin", code: 1, userInfo: [NSLocalizedDescriptionKey: "Launch at Login requires macOS 13 or later."])
            return .failure(error)
        }

        do {
            if enabled {
                if SMAppService.mainApp.status != .enabled {
                    try SMAppService.mainApp.register()
                }
            } else if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            }
            return .success(SMAppService.mainApp.status == .enabled)
        } catch {
            return .failure(error)
        }
    }
}
