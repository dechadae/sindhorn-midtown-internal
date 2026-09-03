import AppKit

@MainActor
private final class BettaImaginePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func cancelOperation(_ sender: Any?) {
        close()
    }
}

@MainActor
final class BettaImagineWindowController: NSWindowController, NSWindowDelegate {
    var onApplied: ((String) -> Void)?

    private let engine = BettaImagineEngine.shared
    private var referenceId: Int = 1
    private var baseline: BettaImagineSnapshot?
    private var kept = false
    private var isGenerating = false
    private weak var presentingWindow: NSWindow?

    private var fishLabel: NSTextField!
    private var availabilityLabel: NSTextField!
    private var inputView: NSTextView!
    private var noteLabel: NSTextField!
    private var generateButton: NSButton!
    private var keepButton: NSButton!
    private var revertButton: NSButton!

    convenience init() {
        let panel = BettaImaginePanel(
            contentRect: NSRect(x: 0, y: 0, width: 592, height: 580),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.title = "BETTA — Imagine"
        panel.isReleasedWhenClosed = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.animationBehavior = .utilityWindow
        panel.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
        self.init(window: panel)
        panel.delegate = self
        buildContent()
    }

    func show(referenceId: Int) {
        if window?.isVisible == true, self.referenceId != referenceId, !kept {
            baseline?.restore()
            onApplied?("Previous Imagine preview reverted")
        }

        if let candidate = NSApp.keyWindow, candidate !== window {
            presentingWindow = candidate
        }

        self.referenceId = min(8, max(1, referenceId))
        baseline = BettaImagineSnapshot.capture(referenceId: self.referenceId)
        kept = false
        isGenerating = false
        inputView.string = ""
        noteLabel.stringValue = "Describe a tail, color mood, movement, environment, or a change to the current Betta."
        refreshHeader()
        refreshAvailability()
        keepButton.isEnabled = false
        revertButton.isEnabled = false

        positionOverPresentingWindow()
        if let window, let presentingWindow, window.parent == nil {
            presentingWindow.addChildWindow(window, ordered: .above)
        }

        showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(inputView)
    }

    func windowWillClose(_ notification: Notification) {
        if let window, let parent = window.parent {
            parent.removeChildWindow(window)
        }
        guard !kept, let baseline else {
            self.baseline = nil
            presentingWindow = nil
            return
        }
        baseline.restore()
        onApplied?("Imagine preview reverted")
        self.baseline = nil
        presentingWindow = nil
    }

    private func positionOverPresentingWindow() {
        guard let window else { return }
        guard let presentingWindow else {
            window.center()
            return
        }
        let parentFrame = presentingWindow.frame
        let size = window.frame.size
        let origin = NSPoint(
            x: parentFrame.midX - size.width * 0.5,
            y: parentFrame.midY - size.height * 0.5
        )
        window.setFrameOrigin(origin)
    }

    private func buildContent() {
        guard let content = window?.contentView else { return }
        content.wantsLayer = true
        content.layer?.backgroundColor = NSColor.clear.cgColor

        let eyebrow = NSTextField(labelWithString: "IMAGINE")
        eyebrow.font = .systemFont(ofSize: 10, weight: .semibold)
        eyebrow.textColor = .secondaryLabelColor

        let spacer = NSView(frame: .zero)
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let closeButton = NSButton(title: "×", target: self, action: #selector(closePanel(_:)))
        closeButton.isBordered = false
        closeButton.font = .systemFont(ofSize: 20, weight: .regular)
        closeButton.contentTintColor = .secondaryLabelColor
        closeButton.toolTip = "Close Imagine and revert unkept preview"
        closeButton.keyEquivalent = "\u{1b}"

        let topRow = NSStackView(views: [eyebrow, spacer, closeButton])
        topRow.orientation = .horizontal
        topRow.alignment = .centerY
        topRow.spacing = 8

        let title = NSTextField(labelWithString: "Describe your Betta")
        title.font = .systemFont(ofSize: 25, weight: .semibold)

        fishLabel = NSTextField(labelWithString: "")
        fishLabel.font = .systemFont(ofSize: 13, weight: .medium)

        availabilityLabel = NSTextField(labelWithString: "")
        availabilityLabel.font = .systemFont(ofSize: 11)
        availabilityLabel.textColor = .secondaryLabelColor

        let privacy = NSTextField(wrappingLabelWithString: "Apple Intelligence interprets your direction on device. BETTA converts the result into its existing procedural controls; no image is generated.")
        privacy.font = .systemFont(ofSize: 11)
        privacy.textColor = .tertiaryLabelColor
        privacy.maximumNumberOfLines = 3

        let promptLabel = NSTextField(labelWithString: "What should this Betta become?")
        promptLabel.font = .systemFont(ofSize: 12, weight: .semibold)

        inputView = NSTextView(frame: .zero)
        inputView.font = .systemFont(ofSize: 14)
        inputView.textColor = .labelColor
        inputView.backgroundColor = .textBackgroundColor.withAlphaComponent(0.42)
        inputView.isRichText = false
        inputView.isAutomaticQuoteSubstitutionEnabled = false
        inputView.isAutomaticDashSubstitutionEnabled = false
        inputView.textContainerInset = NSSize(width: 9, height: 8)

        let scroll = NSScrollView(frame: .zero)
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.hasVerticalScroller = true
        scroll.borderType = .noBorder
        scroll.drawsBackground = false
        scroll.documentView = inputView
        scroll.heightAnchor.constraint(equalToConstant: 108).isActive = true

        let examples = NSTextField(wrappingLabelWithString: "Try: “Ethereal and goddess-like, translucent pearl silk with a pure luminous white atmosphere.”")
        examples.font = .systemFont(ofSize: 10)
        examples.textColor = .tertiaryLabelColor
        examples.maximumNumberOfLines = 3

        let fuller = quickButton("Fuller", tag: 1)
        let silkier = quickButton("Silkier", tag: 2)
        let transparent = quickButton("More transparent", tag: 3)
        let dramatic = quickButton("More dramatic", tag: 4)
        let quickRow = NSStackView(views: [fuller, silkier, transparent, dramatic])
        quickRow.orientation = .horizontal
        quickRow.distribution = .fillEqually
        quickRow.spacing = 6

        generateButton = NSButton(title: "Imagine", target: self, action: #selector(generate(_:)))
        generateButton.bezelStyle = .rounded
        generateButton.controlSize = .large
        generateButton.keyEquivalent = "\r"

        noteLabel = NSTextField(wrappingLabelWithString: "")
        noteLabel.font = .systemFont(ofSize: 11)
        noteLabel.textColor = .secondaryLabelColor
        noteLabel.maximumNumberOfLines = 3

        keepButton = NSButton(title: "Keep", target: self, action: #selector(keep(_:)))
        keepButton.bezelStyle = .rounded
        keepButton.isEnabled = false

        revertButton = NSButton(title: "Revert", target: self, action: #selector(revert(_:)))
        revertButton.bezelStyle = .rounded
        revertButton.isEnabled = false

        let decisionRow = NSStackView(views: [keepButton, revertButton])
        decisionRow.orientation = .horizontal
        decisionRow.distribution = .fillEqually
        decisionRow.spacing = 8

        let stack = NSStackView(views: [
            topRow, title, fishLabel, availabilityLabel, privacy,
            promptLabel, scroll, examples, quickRow,
            generateButton, noteLabel, decisionRow
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false

        let host = NSView(frame: .zero)
        host.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -22),
            stack.topAnchor.constraint(equalTo: host.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -22),
            topRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            scroll.widthAnchor.constraint(equalTo: stack.widthAnchor),
            quickRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            generateButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
            decisionRow.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])

        let glass = BettaLiquidGlassSurface.make(content: host, cornerRadius: 28)
        content.addSubview(glass)
        NSLayoutConstraint.activate([
            glass.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 8),
            glass.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -8),
            glass.topAnchor.constraint(equalTo: content.topAnchor, constant: 8),
            glass.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -8)
        ])
    }

    private func quickButton(_ title: String, tag: Int) -> NSButton {
        let button = NSButton(title: title, target: self, action: #selector(quickDirection(_:)))
        button.tag = tag
        button.bezelStyle = .roundRect
        button.controlSize = .small
        return button
    }

    private func refreshHeader() {
        guard let preset = BettaPreset.all.first(where: { $0.referenceId == referenceId }) else { return }
        fishLabel.stringValue = "Original \(preset.number) · \(preset.name) · working copy"
    }

    private func refreshAvailability() {
        let availability = engine.availability
        availabilityLabel.stringValue = availability.label
        switch availability {
        case .available:
            availabilityLabel.textColor = .secondaryLabelColor
            generateButton.isEnabled = true
        case .unavailable:
            availabilityLabel.textColor = .systemOrange
            generateButton.isEnabled = false
        }
    }

    @objc private func quickDirection(_ sender: NSButton) {
        let text: String
        switch sender.tag {
        case 1: text = "Keep everything else, but make the tail noticeably fuller and more expansive. Let the background keep supporting the same mood."
        case 2: text = "Keep the color mood, but make the tail silkier, softer, broader, and more elegant with slower movement. Let the background become equally soft and atmospheric."
        case 3: text = "Keep the form and colors, but make the membranes more transparent and glasslike with a clean rim light. Keep the environment clean and luminous if that suits the current mood."
        default: text = "Keep the identity, but make the tail more dramatic with deeper folds, stronger rays, richer dimensional light, and a background with matching emotional intensity."
        }
        inputView.string = text
        generate(nil)
    }

    @objc private func generate(_ sender: Any?) {
        guard !isGenerating, let current = BettaImagineDesign.current(referenceId: referenceId) else { return }
        let direction = inputView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !direction.isEmpty else {
            noteLabel.stringValue = "Describe what you want first."
            return
        }

        isGenerating = true
        generateButton.isEnabled = false
        generateButton.title = "Imagining…"
        noteLabel.stringValue = "Interpreting your art direction on device…"

        Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                self.isGenerating = false
                self.generateButton.title = "Refine"
                self.refreshAvailability()
            }
            do {
                let result = try await self.engine.generate(direction: direction, current: current)
                guard result.design.apply(referenceId: self.referenceId) else {
                    throw NSError(domain: "BETTA.Imagine", code: 10, userInfo: [NSLocalizedDescriptionKey: "BETTA couldn't apply that design."])
                }
                self.keepButton.isEnabled = true
                self.revertButton.isEnabled = true
                self.noteLabel.stringValue = result.note
                self.onApplied?("Imagine preview · \(result.note)")
            } catch {
                self.noteLabel.stringValue = error.localizedDescription
            }
        }
    }

    @objc private func keep(_ sender: Any?) {
        _ = BettaAdvancedTuningStore.shared.save()
        _ = BettaRandomStyleStore.shared.save()
        kept = true
        baseline = nil
        onApplied?("Imagine design kept")
        window?.close()
    }

    @objc private func revert(_ sender: Any?) {
        baseline?.restore()
        kept = true
        baseline = nil
        onApplied?("Imagine changes reverted")
        window?.close()
    }

    @objc private func closePanel(_ sender: Any?) {
        window?.close()
    }
}
