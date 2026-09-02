import AppKit

/// Uses the real AppKit NSGlassEffectView when it is present at runtime (macOS 26+)
/// without raising the package deployment target or requiring an Xcode 26 SDK to compile.
/// Older systems receive the established NSVisualEffectView material fallback.
enum BettaLiquidGlassSurface {
    static func makeBackground(cornerRadius: CGFloat = 22) -> NSView {
        if ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26,
           let glassType = NSClassFromString("NSGlassEffectView") as? NSObject.Type {
            let object = glassType.init()
            if let glass = object as? NSView {
                glass.translatesAutoresizingMaskIntoConstraints = false
                glass.wantsLayer = true
                let samplingContent = NSView(frame: .zero)
                glass.setValue(samplingContent, forKey: "contentView")
                glass.setValue(NSNumber(value: Double(cornerRadius)), forKey: "cornerRadius")
                if glass.responds(to: NSSelectorFromString("setEffectIsInteractive:")) {
                    glass.setValue(true, forKey: "effectIsInteractive")
                }
                return glass
            }
        }

        let fallback = NSVisualEffectView()
        fallback.translatesAutoresizingMaskIntoConstraints = false
        fallback.material = .hudWindow
        fallback.blendingMode = .withinWindow
        fallback.state = .active
        fallback.wantsLayer = true
        fallback.layer?.cornerRadius = cornerRadius
        fallback.layer?.masksToBounds = true
        return fallback
    }
}
