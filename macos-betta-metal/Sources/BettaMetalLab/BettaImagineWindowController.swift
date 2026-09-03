import AppKit

/// Imagine is intentionally an in-window overlay rather than a second NSWindow
/// or NSPanel. This keeps Apple Intelligence editing visually inside Living
/// Gallery with no macOS title bar, traffic lights, window border or floating
/// panel chrome around the Liquid Glass surface.
@MainActor
final class BettaImagineOverlayView: NSView {
    var onApplied: ((String) -> Void)?

    private let engine = BettaImagineEngine.shared
    private var referenceId: Int = 1
    private var baseline: BettaImagineSnapshot?
    private var kept = false
    private var isGenerating = false

    private var fishLabel: NSTextField!
    private var availabilityLabel: NSTextField!
    private var inputView: NSTextView!
    private var noteLabel: NSTextField!
    private var generateButton: NSButton!
    private var keepButton: NSButton!
    private var revertButton: NSButton!

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        translatesAutoresizingMaskIntoConstraints = false
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
        buildContent()
        isHidden = true
    }

    convenience init() {
        self.init(frame: .zero)
    }

    required init?(coder: NSCoder) { nil }

    func present(referenceId: Int) {
        if !isHidden, self.referenceId != referenceId, !kept {
            baseline?.restore()
            onApplied?("Previous Imagine preview reverted")
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
        isHidden = false

        window?.makeFirstResponder(inputView)
    }

    /// Used when Living Gallery itself is hidden through another app surface.
    /// Any unkept preview remains non-destructive.
    func dismissAndRevertIfNeeded(notify: Bool = true) {
        guard !isHidden else { return }
        if !kept, let baseline {
            baseline.restore()
            if notify { onApplied?("Imagine preview reverted") }
        }
        self.baseline = nil
        kept = false
        isGenerating = false
        isHidden = true
    }

    private func finishAndHide() {
        isGenerating = false
        isHidden = true
        window?.makeFirstResponder(nil)
    }

    private func buildContent() {
        let eyebrow = NSTextField(labelWithString: "IMAGINE")
        eyebrow.font = .systemFont(ofSize: 10, weight: .semibold)
        eyebrow.textColor = .secondaryLabelColor

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
        inputView.backgroundColor = .textBackgroundColor.withAlphaComponent(0.48)
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

        let examples = NSTextField(wrappingLabelWithString: "Try: “Candy-unicorn pop culture: bubblegum pink, electric cyan, lavender and lemon with a playful luminous environment.”")
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
            eyebrow, title, fishLabel, availabilityLabel, privacy,
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

        let closeButton = NSButton(title: "×", target: self, action: #selector(closeOverlay(_:)))
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.isBordered = false
        closeButton.font = .systemFont(ofSize: 17, weight: .regular)
        closeButton.contentTintColor = .secondaryLabelColor
        closeButton.toolTip = "Close and revert unkept changes"
        host.addSubview(closeButton)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -22),
            stack.topAnchor.constraint(equalTo: host.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -22),
            scroll.widthAnchor.constraint(equalTo: stack.widthAnchor),
            quickRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            generateButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
            decisionRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            closeButton.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -17),
            closeButton.topAnchor.constraint(equalTo: host.topAnchor, constant: 13),
            closeButton.widthAnchor.constraint(equalToConstant: 24),
            closeButton.heightAnchor.constraint(equalToConstant: 24)
        ])

        let glass = BettaLiquidGlassSurface.make(content: host, cornerRadius: 28)
        addSubview(glass)
        NSLayoutConstraint.activate([
            glass.centerXAnchor.constraint(equalTo: centerXAnchor),
            glass.centerYAnchor.constraint(equalTo: centerYAnchor),
            glass.widthAnchor.constraint(equalToConstant: 592),
            glass.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
            glass.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -24),
            glass.topAnchor.constraint(greaterThanOrEqualTo: topAnchor, constant: 24),
            glass.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -24)
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
            generateButton.isEnabled = !isGenerating
        case .unavailable:
            availabilityLabel.textColor = .systemOrange
            generateButton.isEnabled = false
        }
    }

    @objc private func closeOverlay(_ sender: Any?) {
        dismissAndRevertIfNeeded()
    }

    @objc private func quickDirection(_ sender: NSButton) {
        let text: String
        switch sender.tag {
        case 1: text = "Keep everything else, but make the tail noticeably fuller and more expansive."
        case 2: text = "Keep the color mood, but make the tail silkier, softer, broader, and more elegant with slower movement."
        case 3: text = "Keep the form and colors, but make the membranes more transparent and glasslike with a clean rim light."
        default: text = "Keep the identity, but make the tail more dramatic with deeper folds, stronger rays, and richer dimensional light."
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
        finishAndHide()
    }

    @objc private func revert(_ sender: Any?) {
        baseline?.restore()
        kept = true
        baseline = nil
        onApplied?("Imagine changes reverted")
        finishAndHide()
    }
}
