import AppKit

final class BettaCompositionEditorPanel: NSVisualEffectView {
    var onSelectFish: ((Int) -> Void)?
    var onSaveAndUse: (() -> Void)?

    private let compositionStore = BettaCompositionStore.shared
    private let advancedStore = BettaAdvancedTuningStore.shared
    private var selectedIndex: Int
    private var selectedCategory = 0
    var selectedFishIndex: Int { selectedIndex }

    private let fishSelector: NSSegmentedControl
    private let categorySelector: NSSegmentedControl
    private let orientationControl: NSSegmentedControl
    private let controlsStack = NSStackView()
    private var valueLabels: [Int: NSTextField] = [:]
    private let fishTitle = NSTextField(labelWithString: "")
    private let statusLabel = NSTextField(labelWithString: "Live preview · not saved")

    init(initialIndex: Int) {
        selectedIndex = min(7, max(0, initialIndex))
        fishSelector = NSSegmentedControl(labels: (1...8).map(String.init), trackingMode: .selectOne, target: nil, action: nil)
        categorySelector = NSSegmentedControl(labels: ["Layout", "Camera", "Form", "Motion", "Optics", "Color", "Detail", "Front", "Back"], trackingMode: .selectOne, target: nil, action: nil)
        orientationControl = NSSegmentedControl(labels: ["90° CCW", "Original", "90° CW"], trackingMode: .selectOne, target: nil, action: nil)
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

    func cycleFish(_ delta: Int) {
        selectFish(index: (selectedIndex + delta + 8) % 8)
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

        categorySelector.target = self
        categorySelector.action = #selector(categoryChanged(_:))
        categorySelector.selectedSegment = selectedCategory
        categorySelector.segmentDistribution = .fillEqually
        categorySelector.controlSize = .small

        orientationControl.target = self
        orientationControl.action = #selector(orientationChanged(_:))
        orientationControl.segmentDistribution = .fillEqually

        let title = NSTextField(labelWithString: "Betta High Detail Studio")
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        let subtitle = NSTextField(wrappingLabelWithString: "Full per-tail camera, form, optics, motion and membrane detail. The production preset is always the reset point.")
        subtitle.font = .systemFont(ofSize: 11)
        subtitle.textColor = .secondaryLabelColor
        subtitle.maximumNumberOfLines = 2

        fishTitle.font = .systemFont(ofSize: 13, weight: .medium)
        fishTitle.lineBreakMode = .byTruncatingTail
        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor

        controlsStack.orientation = .vertical
        controlsStack.alignment = .leading
        controlsStack.spacing = 7
        controlsStack.translatesAutoresizingMaskIntoConstraints = false

        let controlArea = NSView()
        controlArea.translatesAutoresizingMaskIntoConstraints = false
        controlArea.addSubview(controlsStack)
        NSLayoutConstraint.activate([
            controlArea.heightAnchor.constraint(equalToConstant: 326),
            controlsStack.leadingAnchor.constraint(equalTo: controlArea.leadingAnchor),
            controlsStack.trailingAnchor.constraint(equalTo: controlArea.trailingAnchor),
            controlsStack.topAnchor.constraint(equalTo: controlArea.topAnchor)
        ])

        let reset = NSButton(title: "Reset This Tail to Production", target: self, action: #selector(resetCurrent(_:)))
        reset.bezelStyle = .rounded
        let save = NSButton(title: "Save All 8 & Use as Wallpaper", target: self, action: #selector(saveAndUse(_:)))
        save.bezelStyle = .rounded
        save.controlSize = .large
        save.keyEquivalent = "\r"

        let help = NSTextField(wrappingLabelWithString: "All changes preview live. Save persists layout + camera + advanced tail/layer tuning for all eight fish, then returns to the Bangkok live cycle in wallpaper mode. Press D to edit again.")
        help.font = .systemFont(ofSize: 10)
        help.textColor = .tertiaryLabelColor
        help.maximumNumberOfLines = 4

        let stack = NSStackView(views: [title, subtitle, fishSelector, fishTitle, categorySelector, controlArea, statusLabel, reset, save, help])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 9
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 460),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
            fishSelector.widthAnchor.constraint(equalTo: stack.widthAnchor),
            categorySelector.widthAnchor.constraint(equalTo: stack.widthAnchor),
            controlArea.widthAnchor.constraint(equalTo: stack.widthAnchor),
            reset.widthAnchor.constraint(equalTo: stack.widthAnchor),
            save.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    private func loadSelectedFish() {
        let preset = BettaPreset.all[selectedIndex]
        fishTitle.stringValue = "Fish #\(preset.referenceId) · \(preset.name)"
        fishSelector.selectedSegment = selectedIndex
        rebuildControls()
        statusLabel.stringValue = "Live preview · changes apply immediately"
    }

    private func rebuildControls() {
        for view in controlsStack.arrangedSubviews {
            controlsStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        valueLabels.removeAll()

        let preset = BettaPreset.all[selectedIndex]
        let composition = compositionStore.adjustment(for: preset.referenceId)
        let advanced = advancedStore.adjustment(for: preset.referenceId)

        switch selectedCategory {
        case 0:
            addSectionNote("Landscape transform")
            addOrientationRow(composition)
            addSlider(1, "Scale", composition.scale, 0.35, 2.2, "%.2f")
            addSlider(2, "X Position", composition.x, -8, 8, "%.2f")
            addSlider(3, "Y Position", composition.y, -5, 5, "%.2f")
            addSlider(4, "Z Position", composition.z, -4, 4, "%.2f")
        case 1:
            addSectionNote("Per-tail camera · transitions interpolate between saved cameras")
            addSlider(10, "Field of View", advanced.camera.fov, 12, 90, "%.1f°")
            addSlider(11, "Camera X", advanced.camera.x, -10, 10, "%.2f")
            addSlider(12, "Camera Y", advanced.camera.y, -10, 10, "%.2f")
            addSlider(13, "Camera Z", advanced.camera.z, 2, 25, "%.2f")
            addSlider(14, "Pitch", advanced.camera.pitch, -89, 89, "%.1f°")
            addSlider(15, "Yaw", advanced.camera.yaw, -180, 180, "%.1f°")
            addSlider(16, "Roll", advanced.camera.roll, -180, 180, "%.1f°")
        case 2:
            addSectionNote("Large-scale tail structure")
            addSlider(20, "Spread", advanced.tail.spread, 1.2, 4.8, "%.2f")
            addSlider(21, "Ray Count", advanced.tail.rayCount, 24, 160, "%.0f")
            addSlider(22, "Fold Density", advanced.tail.foldDensity, 2, 24, "%.2f")
            addSlider(23, "Curl", advanced.tail.curl, -2, 2, "%.3f")
            addSlider(24, "Twist", advanced.tail.twist, -1.5, 1.5, "%.3f")
            addSlider(25, "Edge Flutter", advanced.tail.edgeFlutter, 0, 0.45, "%.3f")
            addSlider(26, "Depth", advanced.tail.depth, 0.05, 1.5, "%.3f")
            addSlider(27, "Current Strength", advanced.tail.currentStrength, 0, 1, "%.3f")
        case 3:
            addSectionNote("Movement character")
            addSlider(30, "Motion Speed", advanced.tail.motionSpeed, 0.03, 1, "%.3f")
            addSlider(31, "Turbulence", advanced.tail.turbulence, 0, 1, "%.3f")
            addSlider(32, "Motion Amplitude", advanced.tail.motionAmplitude, 0, 1, "%.3f")
        case 4:
            addSectionNote("Translucency and light response")
            addSlider(40, "Opacity", advanced.tail.opacity, 0.05, 1.2, "%.3f")
            addSlider(41, "Transmission", advanced.tail.transmission, 0, 1.3, "%.3f")
            addSlider(42, "Rim Light", advanced.tail.rimStrength, 0, 2.5, "%.2f")
            addSlider(43, "Fold Highlight", advanced.tail.foldHighlight, 0, 2.5, "%.2f")
            addSlider(44, "Iridescence", advanced.tail.iridescence, 0, 1.5, "%.2f")
            addSlider(45, "Bloom", advanced.tail.bloom, 0, 1.5, "%.2f")
        case 5:
            addSectionNote("Color grading over the approved palette")
            addSlider(50, "Saturation", advanced.tail.saturation, 0, 2.5, "%.2f")
            addSlider(51, "Brightness", advanced.tail.brightness, 0.4, 2.5, "%.2f")
            addSlider(52, "Gradient Position", advanced.tail.gradientPosition, -0.5, 0.5, "%.3f")
        case 6:
            addSectionNote("Mac-only microstructure · start near 1.0")
            addSlider(60, "Micro Folds", advanced.tail.microFold, 0, 2.5, "%.2f")
            addSlider(61, "Ray Definition", advanced.tail.rayDefinition, 0, 2.5, "%.2f")
            addSlider(62, "Edge Ruffle", advanced.tail.edgeRuffle, 0, 2.5, "%.2f")
            addSlider(63, "Vein Strength", advanced.tail.veinStrength, 0, 2.5, "%.2f")
            addSlider(64, "Membrane Grain", advanced.tail.membraneGrain, 0, 2.5, "%.2f")
            addSlider(65, "Fine Flutter", advanced.tail.fineFlutter, 0, 2.5, "%.2f")
            addSlider(66, "Normal Detail", advanced.tail.normalDetail, 0, 2.5, "%.2f")
        case 7:
            addSectionNote("Primary membrane layer")
            addLayerControls(advanced.frontLayer, baseTag: 70)
        default:
            addSectionNote("Secondary translucent membrane layer")
            addLayerControls(advanced.backLayer, baseTag: 80)
        }
    }

    private func addOrientationRow(_ adjustment: BettaCompositionAdjustment) {
        let label = NSTextField(labelWithString: "Orientation")
        label.font = .systemFont(ofSize: 11, weight: .medium)
        label.textColor = .secondaryLabelColor
        orientationControl.selectedSegment = adjustment.quarterTurns + 1
        orientationControl.widthAnchor.constraint(equalTo: controlsStack.widthAnchor).isActive = true
        controlsStack.addArrangedSubview(label)
        controlsStack.addArrangedSubview(orientationControl)
    }

    private func addLayerControls(_ layer: BettaLayerTuning, baseTag: Int) {
        addSlider(baseTag, "Layer Scale", layer.scale, 0.25, 1.8, "%.3f")
        addSlider(baseTag + 1, "Layer Alpha", layer.alpha, 0, 1.25, "%.3f")
        addSlider(baseTag + 2, "Offset X", layer.x, -2, 2, "%.3f")
        addSlider(baseTag + 3, "Offset Y", layer.y, -2, 2, "%.3f")
        addSlider(baseTag + 4, "Offset Z", layer.z, -2, 2, "%.3f")
        addSlider(baseTag + 5, "Layer Rotation", layer.rotation, -.pi, .pi, "%.3f")
        addSlider(baseTag + 6, "Motion Phase", layer.phase, -100, 100, "%.2f")
    }

    private func addSectionNote(_ text: String) {
        let label = NSTextField(wrappingLabelWithString: text)
        label.font = .systemFont(ofSize: 10)
        label.textColor = .tertiaryLabelColor
        label.maximumNumberOfLines = 2
        label.widthAnchor.constraint(equalTo: controlsStack.widthAnchor).isActive = true
        controlsStack.addArrangedSubview(label)
    }

    private func addSlider(_ tag: Int, _ title: String, _ value: Float, _ min: Float, _ max: Float, _ format: String) {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 11, weight: .medium)
        label.textColor = .secondaryLabelColor
        let valueLabel = NSTextField(labelWithString: String(format: format, value))
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        valueLabel.alignment = .right
        valueLabel.widthAnchor.constraint(equalToConstant: 64).isActive = true
        valueLabels[tag] = valueLabel

        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        let header = NSStackView(views: [label, spacer, valueLabel])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 6

        let slider = NSSlider(value: Double(value), minValue: Double(min), maxValue: Double(max), target: self, action: #selector(sliderChanged(_:)))
        slider.tag = tag
        slider.isContinuous = true
        slider.toolTip = format

        let row = NSStackView(views: [header, slider])
        row.orientation = .vertical
        row.alignment = .leading
        row.spacing = 2
        row.widthAnchor.constraint(equalTo: controlsStack.widthAnchor).isActive = true
        header.widthAnchor.constraint(equalTo: row.widthAnchor).isActive = true
        slider.widthAnchor.constraint(equalTo: row.widthAnchor).isActive = true
        controlsStack.addArrangedSubview(row)
    }

    @objc private func fishChanged(_ sender: NSSegmentedControl) { selectFish(index: sender.selectedSegment) }

    @objc private func categoryChanged(_ sender: NSSegmentedControl) {
        selectedCategory = sender.selectedSegment
        rebuildControls()
    }

    @objc private func orientationChanged(_ sender: NSSegmentedControl) {
        let preset = BettaPreset.all[selectedIndex]
        var c = compositionStore.adjustment(for: preset.referenceId)
        c.quarterTurns = sender.selectedSegment - 1
        compositionStore.update(referenceId: preset.referenceId, adjustment: c)
        statusLabel.stringValue = "Live preview · unsaved"
    }

    @objc private func sliderChanged(_ sender: NSSlider) {
        let value = sender.floatValue
        if let label = valueLabels[sender.tag] {
            let format = sender.toolTip ?? "%.2f"
            label.stringValue = String(format: format, value)
        }
        applySlider(tag: sender.tag, value: value)
        statusLabel.stringValue = "Live preview · unsaved"
    }

    private func applySlider(tag: Int, value: Float) {
        let preset = BettaPreset.all[selectedIndex]
        let id = preset.referenceId
        if (1...4).contains(tag) {
            var c = compositionStore.adjustment(for: id)
            switch tag {
            case 1: c.scale = value
            case 2: c.x = value
            case 3: c.y = value
            case 4: c.z = value
            default: break
            }
            compositionStore.update(referenceId: id, adjustment: c)
            return
        }

        var a = advancedStore.adjustment(for: id)
        switch tag {
        case 10: a.camera.fov = value
        case 11: a.camera.x = value
        case 12: a.camera.y = value
        case 13: a.camera.z = value
        case 14: a.camera.pitch = value
        case 15: a.camera.yaw = value
        case 16: a.camera.roll = value
        case 20: a.tail.spread = value
        case 21: a.tail.rayCount = value.rounded()
        case 22: a.tail.foldDensity = value
        case 23: a.tail.curl = value
        case 24: a.tail.twist = value
        case 25: a.tail.edgeFlutter = value
        case 26: a.tail.depth = value
        case 27: a.tail.currentStrength = value
        case 30: a.tail.motionSpeed = value
        case 31: a.tail.turbulence = value
        case 32: a.tail.motionAmplitude = value
        case 40: a.tail.opacity = value
        case 41: a.tail.transmission = value
        case 42: a.tail.rimStrength = value
        case 43: a.tail.foldHighlight = value
        case 44: a.tail.iridescence = value
        case 45: a.tail.bloom = value
        case 50: a.tail.saturation = value
        case 51: a.tail.brightness = value
        case 52: a.tail.gradientPosition = value
        case 60: a.tail.microFold = value
        case 61: a.tail.rayDefinition = value
        case 62: a.tail.edgeRuffle = value
        case 63: a.tail.veinStrength = value
        case 64: a.tail.membraneGrain = value
        case 65: a.tail.fineFlutter = value
        case 66: a.tail.normalDetail = value
        case 70...76: a.frontLayer = updatedLayer(a.frontLayer, tag: tag - 70, value: value)
        case 80...86: a.backLayer = updatedLayer(a.backLayer, tag: tag - 80, value: value)
        default: break
        }
        advancedStore.update(referenceId: id, adjustment: a)
    }

    private func updatedLayer(_ layer: BettaLayerTuning, tag: Int, value: Float) -> BettaLayerTuning {
        var l = layer
        switch tag {
        case 0: l.scale = value
        case 1: l.alpha = value
        case 2: l.x = value
        case 3: l.y = value
        case 4: l.z = value
        case 5: l.rotation = value
        case 6: l.phase = value
        default: break
        }
        return l
    }

    @objc private func resetCurrent(_ sender: Any?) {
        let id = BettaPreset.all[selectedIndex].referenceId
        compositionStore.reset(referenceId: id)
        advancedStore.reset(referenceId: id)
        rebuildControls()
        statusLabel.stringValue = "Reset to production + 90° CW landscape default · unsaved"
    }

    @objc private func saveAndUse(_ sender: Any?) {
        let compositionSaved = compositionStore.save()
        let advancedSaved = advancedStore.save()
        let saved = compositionSaved && advancedSaved
        statusLabel.stringValue = saved ? "Saved layout + camera + tail detail for all 8" : "Could not save all settings"
        if saved { onSaveAndUse?() }
    }
}
