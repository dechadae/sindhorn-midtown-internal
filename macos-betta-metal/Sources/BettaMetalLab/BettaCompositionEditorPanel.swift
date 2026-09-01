import AppKit

final class BettaCompositionEditorPanel: NSVisualEffectView {
    var onSelectFish: ((Int) -> Void)?
    var onSaveAndUse: (() -> Void)?

    private let store = BettaCompositionStore.shared
    private var selectedIndex: Int

    private let fishSelector: NSSegmentedControl
    private let orientationControl: NSSegmentedControl
    private let scaleSlider: NSSlider
    private let xSlider: NSSlider
    private let ySlider: NSSlider
    private let zSlider: NSSlider
    private let scaleValue = NSTextField(labelWithString: "1.00")
    private let xValue = NSTextField(labelWithString: "0.00")
    private let yValue = NSTextField(labelWithString: "0.00")
    private let zValue = NSTextField(labelWithString: "0.00")
    private let fishTitle = NSTextField(labelWithString: "")
    private let statusLabel = NSTextField(labelWithString: "Live preview · not saved")

    init(initialIndex: Int) {
        selectedIndex = min(7, max(0, initialIndex))
        fishSelector = NSSegmentedControl(labels: (1...8).map(String.init), trackingMode: .selectOne, target: nil, action: nil)
        orientationControl = NSSegmentedControl(labels: ["90° CCW", "Original", "90° CW"], trackingMode: .selectOne, target: nil, action: nil)
        scaleSlider = NSSlider(value: 1, minValue: 0.35, maxValue: 2.2, target: nil, action: nil)
        xSlider = NSSlider(value: 0, minValue: -8, maxValue: 8, target: nil, action: nil)
        ySlider = NSSlider(value: 0, minValue: -5, maxValue: 5, target: nil, action: nil)
        zSlider = NSSlider(value: 0, minValue: -4, maxValue: 4, target: nil, action: nil)
        super.init(frame: .zero)
        configure()
        loadSelectedFish()
    }

    required init?(coder: NSCoder) { nil }

    func selectFish(index: Int, notifyRenderer: Bool = true) {
        selectedIndex = min(7, max(0, index))
        fishSelector.selectedSegment = selectedIndex
        loadSelectedFish()
        if notifyRenderer { onSelectFish?(selectedIndex) }
    }

    private func configure() {
        material = .hudWindow
        blendingMode = .withinWindow
        state = .active
        wantsLayer = true
        layer?.cornerRadius = 16
        layer?.masksToBounds = true
        translatesAutoresizingMaskIntoConstraints = false

        fishSelector.target = self
        fishSelector.action = #selector(fishChanged(_:))
        fishSelector.selectedSegment = selectedIndex
        fishSelector.segmentDistribution = .fillEqually

        orientationControl.target = self
        orientationControl.action = #selector(orientationChanged(_:))
        orientationControl.segmentDistribution = .fillEqually

        for (tag, slider) in [scaleSlider, xSlider, ySlider, zSlider].enumerated() {
            slider.tag = tag
            slider.isContinuous = true
            slider.target = self
            slider.action = #selector(sliderChanged(_:))
        }

        let title = NSTextField(labelWithString: "Landscape Composition")
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        let subtitle = NSTextField(wrappingLabelWithString: "Tune each tail in landscape. The approved fish geometry and shader stay unchanged.")
        subtitle.font = .systemFont(ofSize: 11)
        subtitle.textColor = .secondaryLabelColor
        subtitle.maximumNumberOfLines = 2

        fishTitle.font = .systemFont(ofSize: 13, weight: .medium)
        fishTitle.lineBreakMode = .byTruncatingTail

        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor

        let orientationLabel = NSTextField(labelWithString: "Flip")
        orientationLabel.font = .systemFont(ofSize: 11, weight: .medium)
        orientationLabel.textColor = .secondaryLabelColor

        let reset = NSButton(title: "Reset This Tail", target: self, action: #selector(resetCurrent(_:)))
        reset.bezelStyle = .rounded

        let save = NSButton(title: "Save & Use as Wallpaper", target: self, action: #selector(saveAndUse(_:)))
        save.bezelStyle = .rounded
        save.controlSize = .large
        save.keyEquivalent = "\r"

        let help = NSTextField(wrappingLabelWithString: "Save stores all 8 tail layouts on this Mac, returns to the live Bangkok cycle, and switches to desktop-wallpaper mode. Press D to return to the editor.")
        help.font = .systemFont(ofSize: 10)
        help.textColor = .tertiaryLabelColor
        help.maximumNumberOfLines = 4

        let stack = NSStackView(views: [
            title,
            subtitle,
            spacer(4),
            fishSelector,
            fishTitle,
            spacer(2),
            orientationLabel,
            orientationControl,
            sliderRow(title: "Scale", slider: scaleSlider, value: scaleValue),
            sliderRow(title: "X Position", slider: xSlider, value: xValue),
            sliderRow(title: "Y Position", slider: ySlider, value: yValue),
            sliderRow(title: "Z Position", slider: zSlider, value: zValue),
            statusLabel,
            reset,
            save,
            help
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 340),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
            fishSelector.widthAnchor.constraint(equalTo: stack.widthAnchor),
            orientationControl.widthAnchor.constraint(equalTo: stack.widthAnchor),
            reset.widthAnchor.constraint(equalTo: stack.widthAnchor),
            save.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    private func sliderRow(title: String, slider: NSSlider, value: NSTextField) -> NSView {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 11, weight: .medium)
        label.textColor = .secondaryLabelColor
        value.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        value.alignment = .right
        value.setContentHuggingPriority(.required, for: .horizontal)
        value.widthAnchor.constraint(equalToConstant: 52).isActive = true

        let header = NSStackView(views: [label, flexibleSpacer(), value])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 8

        let row = NSStackView(views: [header, slider])
        row.orientation = .vertical
        row.alignment = .leading
        row.spacing = 4
        slider.widthAnchor.constraint(equalTo: row.widthAnchor).isActive = true
        header.widthAnchor.constraint(equalTo: row.widthAnchor).isActive = true
        return row
    }

    private func loadSelectedFish() {
        let preset = BettaPreset.all[selectedIndex]
        fishTitle.stringValue = "Fish #\(preset.referenceId) · \(preset.name)"
        let adjustment = store.adjustment(for: preset.referenceId)
        orientationControl.selectedSegment = adjustment.quarterTurns + 1
        scaleSlider.floatValue = adjustment.scale
        xSlider.floatValue = adjustment.x
        ySlider.floatValue = adjustment.y
        zSlider.floatValue = adjustment.z
        updateValueLabels(adjustment)
        statusLabel.stringValue = "Live preview · changes apply immediately"
    }

    private func currentAdjustment() -> BettaCompositionAdjustment {
        BettaCompositionAdjustment(
            quarterTurns: orientationControl.selectedSegment - 1,
            scale: scaleSlider.floatValue,
            x: xSlider.floatValue,
            y: ySlider.floatValue,
            z: zSlider.floatValue
        ).normalized
    }

    private func commitLiveAdjustment() {
        let preset = BettaPreset.all[selectedIndex]
        let adjustment = currentAdjustment()
        store.update(referenceId: preset.referenceId, adjustment: adjustment)
        updateValueLabels(adjustment)
        statusLabel.stringValue = "Live preview · unsaved"
    }

    private func updateValueLabels(_ adjustment: BettaCompositionAdjustment) {
        scaleValue.stringValue = String(format: "%.2f", adjustment.scale)
        xValue.stringValue = String(format: "%.2f", adjustment.x)
        yValue.stringValue = String(format: "%.2f", adjustment.y)
        zValue.stringValue = String(format: "%.2f", adjustment.z)
    }

    @objc private func fishChanged(_ sender: NSSegmentedControl) {
        selectFish(index: sender.selectedSegment)
    }

    @objc private func orientationChanged(_ sender: NSSegmentedControl) {
        commitLiveAdjustment()
    }

    @objc private func sliderChanged(_ sender: NSSlider) {
        commitLiveAdjustment()
    }

    @objc private func resetCurrent(_ sender: Any?) {
        let referenceId = BettaPreset.all[selectedIndex].referenceId
        store.reset(referenceId: referenceId)
        loadSelectedFish()
        statusLabel.stringValue = "Reset to 90° CW default · unsaved"
    }

    @objc private func saveAndUse(_ sender: Any?) {
        let saved = store.save()
        statusLabel.stringValue = saved ? "Saved all 8 tail layouts" : "Could not save layouts"
        if saved { onSaveAndUse?() }
    }

    private func spacer(_ height: CGFloat) -> NSView {
        let view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.heightAnchor.constraint(equalToConstant: height).isActive = true
        return view
    }

    private func flexibleSpacer() -> NSView {
        let view = NSView()
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return view
    }
}
