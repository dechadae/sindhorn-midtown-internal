import AppKit

/// Hosts the editor content inside the real AppKit NSGlassEffectView on macOS 26+.
/// Runtime lookup keeps the Swift package compatible with the older Xcode SDK used by CI.
/// Earlier macOS releases use NSVisualEffectView with the same content/layout contract.
enum BettaLiquidGlassSurface {
    static func make(content: NSView, cornerRadius: CGFloat = 22) -> NSView {
        content.translatesAutoresizingMaskIntoConstraints = false

        if ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26,
           let glassType = NSClassFromString("NSGlassEffectView") as? NSObject.Type {
            let object = glassType.init()
            if let glass = object as? NSView {
                glass.translatesAutoresizingMaskIntoConstraints = false
                glass.wantsLayer = true
                glass.setValue(content, forKey: "contentView")
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
        fallback.addSubview(content)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: fallback.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: fallback.trailingAnchor),
            content.topAnchor.constraint(equalTo: fallback.topAnchor),
            content.bottomAnchor.constraint(equalTo: fallback.bottomAnchor)
        ])
        return fallback
    }
}
