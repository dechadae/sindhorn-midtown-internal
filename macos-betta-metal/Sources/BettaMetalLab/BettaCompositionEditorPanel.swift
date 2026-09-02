import AppKit

final class BettaCompositionEditorPanel: NSVisualEffectView {
    var onSelectFish: ((Int) -> Void)?
    var onSaveAndUse: (() -> Void)?

    private final class SliderRow: NSView {
        let label = NSTextField(labelWithString: "")
        let valueLabel = NSTextField(labelWithString: "")
        let slider = NSSlider(value: 0, minValue: 0, maxValue: 1, target: nil, action: nil)

        override init(frame frameRect: NSRect) {
            super.init(frame: frameRect)
            translatesAutoresizingMaskIntoConstraints = false

            label.font = .systemFont(ofSize: 11, weight: .medium)
            label.textColor = .secondaryLabelColor

            valueLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            valueLabel.alignment = .right
            valueLabel.setContentHuggingPriority(.required, for: .horizontal)
            valueLabel.widthAnchor.constraint(equalToConstant: 72).isActive = true

            let spacer = NSView()
            spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
            let header = NSStackView(views: [label, spacer, valueLabel])
            header.orientation = .horizontal
            header.alignment = .centerY
            header.spacing = 6
            header.translatesAutoresizingMaskIntoConstraints = false

            slider.translatesAutoresizingMaskIntoConstraints = false
            slider.isContinuous = true

            addSubview(header)
            addSubview(slider)
            NSLayoutConstraint.activate([
                header.leadingAnchor.constraint(equalTo: leadingAnchor),
                header.trailingAnchor.constraint(equalTo: trailingAnchor),
                header.topAnchor.constraint(equalTo: topAnchor),
                slider.leadingAnchor.constraint(equalTo: leadingAnchor),
                slider.trailingAnchor.constraint(equalTo: trailingAnchor),
                slider.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 2),
                slider.bottomAnchor.constraint(equalTo: bottomAnchor),
                heightAnchor.constraint(equalToConstant: 34)
            ])
        }

        required init?(coder: NSCoder) { nil }

        func configure(tag: Int, title: String, value: Float, min: Float, max: Float, format: String, target: AnyObject, action: Selector) {
            isHidden = false
            label.stringValue = title
            slider.tag = tag
            slider.minValue = Double(min)
            slider.maxValue = Double(max)
            slider.doubleValue = Swift.min(Double(max), Swift.max(Double(min), Double(value)))
            slider.target = target
            slider.action = action
            slider.toolTip = format
            valueLabel.stringValue = String(format: format, Double(value))
        }

        func clear() {
            isHidden = true
            slider.target = nil
            slider.action = nil
        }
    }

    private let compositionStore = BettaCompositionStore.shared
    private let advancedStore = BettaAdvancedTuningStore.shared
    private var selectedIndex: Int
    private var selectedCategory = 0
    var selectedFishIndex: Int { selectedIndex }

    private var fishSelector: NSSegmentedControl!
    private var categoryPopup: NSPopUpButton!
    private var orientationControl: NSSegmentedControl!
    private var orientationContainer: NSStackView!
    private var sectionNote: NSTextField!
    private var fishTitle: NSTextField!
    private var statusLabel: NSTextField!
    private var sliderRows: [SliderRow] = []

    private let categories = ["Layout", "Camera", "Form", "Motion", "Optics", "Color", "Detail", "Front Layer", "Back Layer"]

    init(initialIndex: Int) {
        selectedIndex = min(7, max(0, initialIndex))
        super.init(frame: .zero)

        BettaDiagnostics.shared.checkpoint("editor.super.complete")
        buildFixedControls()
        BettaDiagnostics.shared.checkpoint("editor.controls.created")
        configurePanel()
        BettaDiagnostics.shared.checkpoint("editor.layout.complete")
        loadSelectedFish()
        BettaDiagnostics.shared.checkpoint("editor.initial-state.complete", detail: "fish-index=\(selectedIndex)")
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

    private func buildFixedControls() {
        fishSelector = NSSegmentedControl(labels: (1...8).map(String.init), trackingMode: .selectOne, target: self, action: #selector(fishChanged(_:)))
        fishSelector.selectedSegment = selectedIndex
        fishSelector.segmentDistribution = .fillEqually

        categoryPopup = NSPopUpButton(frame: .zero, pullsDown: false)
        categoryPopup.addItems(withTitles: categories)
        categoryPopup.selectItem(at: selectedCategory)
        categoryPopup.target = self
        categoryPopup.action = #selector(categoryChanged(_:))

        orientationControl = NSSegmentedControl(labels: ["90° CCW", "Original", "90° CW"], trackingMode: .selectOne, target: self, action: #selector(orientationChanged(_:)))
        orientationControl.segmentDistribution = .fillEqually

        let orientationLabel = NSTextField(labelWithString: "Orientation")
        orientationLabel.font = .systemFont(ofSize: 11, weight: .medium)
        orientationLabel.textColor = .secondaryLabelColor
        orientationContainer = NSStackView(views: [orientationLabel, orientationControl])
        orientationContainer.orientation = .vertical
        orientationContainer.alignment = .leading
        orientationContainer.spacing = 4

        sectionNote = NSTextField(wrappingLabelWithString: "")
        sectionNote.font = .systemFont(ofSize: 10)
        sectionNote.textColor = .tertiaryLabelColor
        sectionNote.maximumNumberOfLines = 2

        fishTitle = NSTextField(labelWithString: "")
        fishTitle.font = .systemFont(ofSize: 13, weight: .medium)
        fishTitle.lineBreakMode = .byTruncatingTail

        statusLabel = NSTextField(labelWithString: "Live preview · not saved")
        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor

        sliderRows = (0..<8).map { _ in SliderRow(frame: .zero) }
    }

    private func configurePanel() {
        material = .hudWindow
        blendingMode = .withinWindow
        state = .active
        wantsLayer = true
        layer?.cornerRadius = 16
        layer?.masksToBounds = true
        translatesAutoresizingMaskIntoConstraints = false

        let title = NSTextField(labelWithString: "Betta High Detail Studio")
        title.font = .systemFont(ofSize: 18, weight: .semibold)

        let subtitle = NSTextField(wrappingLabelWithString: "Full per-tail camera, form, optics, motion and membrane detail. Controls are reusable and loaded one section at a time.")
        subtitle.font = .systemFont(ofSize: 11)
        subtitle.textColor = .secondaryLabelColor
        subtitle.maximumNumberOfLines = 2

        let categoryLabel = NSTextField(labelWithString: "Controls")
        categoryLabel.font = .systemFont(ofSize: 11, weight: .medium)
        categoryLabel.textColor = .secondaryLabelColor
        let categoryHeader = NSStackView(views: [categoryLabel, categoryPopup])
        categoryHeader.orientation = .horizontal
        categoryHeader.alignment = .centerY
        categoryHeader.spacing = 8

        let rowsStack = NSStackView(views: sliderRows)
        rowsStack.orientation = .vertical
        rowsStack.alignment = .leading
        rowsStack.spacing = 5
        rowsStack.translatesAutoresizingMaskIntoConstraints = false

        let controlArea = NSView()
        controlArea.translatesAutoresizingMaskIntoConstraints = false
        controlArea.addSubview(sectionNote)
        controlArea.addSubview(orientationContainer)
        controlArea.addSubview(rowsStack)
        sectionNote.translatesAutoresizingMaskIntoConstraints = false
        orientationContainer.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            controlArea.heightAnchor.constraint(equalToConstant: 366),
            sectionNote.leadingAnchor.constraint(equalTo: controlArea.leadingAnchor),
            sectionNote.trailingAnchor.constraint(equalTo: controlArea.trailingAnchor),
            sectionNote.topAnchor.constraint(equalTo: controlArea.topAnchor),
            orientationContainer.leadingAnchor.constraint(equalTo: controlArea.leadingAnchor),
            orientationContainer.trailingAnchor.constraint(equalTo: controlArea.trailingAnchor),
            orientationContainer.topAnchor.constraint(equalTo: sectionNote.bottomAnchor, constant: 7),
            orientationControl.widthAnchor.constraint(equalTo: orientationContainer.widthAnchor),
            rowsStack.leadingAnchor.constraint(equalTo: controlArea.leadingAnchor),
            rowsStack.trailingAnchor.constraint(equalTo: controlArea.trailingAnchor),
            rowsStack.topAnchor.constraint(equalTo: orientationContainer.bottomAnchor, constant: 7)
        ])
        for row in sliderRows {
            row.widthAnchor.constraint(equalTo: rowsStack.widthAnchor).isActive = true
        }

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

        let stack = NSStackView(views: [title, subtitle, fishSelector, fishTitle, categoryHeader, controlArea, statusLabel, reset, save, help])
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
            categoryHeader.widthAnchor.constraint(equalTo: stack.widthAnchor),
            categoryPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 190),
            controlArea.widthAnchor.constraint(equalTo: stack.widthAnchor),
            reset.widthAnchor.constraint(equalTo: stack.widthAnchor),
            save.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    private func loadSelectedFish() {
        let preset = BettaPreset.all[selectedIndex]
        fishTitle.stringValue = "Fish #\(preset.referenceId) · \(preset.name)"
        fishSelector.selectedSegment = selectedIndex
        refreshCategory()
        statusLabel.stringValue = "Live preview · changes apply immediately"
    }

    private func refreshCategory() {
        sliderRows.forEach { $0.clear() }
        orientationContainer.isHidden = true

        let preset = BettaPreset.all[selectedIndex]
        let composition = compositionStore.adjustment(for: preset.referenceId)
        let advanced = advancedStore.adjustment(for: preset.referenceId)

        switch selectedCategory {
        case 0:
            sectionNote.stringValue = "Landscape transform"
            orientationContainer.isHidden = false
            orientationControl.selectedSegment = composition.quarterTurns + 1
            configureRows([
                (1, "Scale", composition.scale, 0.35, 2.2, "%.2f"),
                (2, "X Position", composition.x, -8, 8, "%.2f"),
                (3, "Y Position", composition.y, -5, 5, "%.2f"),
                (4, "Z Position", composition.z, -4, 4, "%.2f")
            ])
        case 1:
            sectionNote.stringValue = "Per-tail camera · transitions interpolate between saved cameras"
            configureRows([
                (10, "Field of View", advanced.camera.fov, 12, 90, "%.1f°"),
                (11, "Camera X", advanced.camera.x, -10, 10, "%.2f"),
                (12, "Camera Y", advanced.camera.y, -10, 10, "%.2f"),
                (13, "Camera Z", advanced.camera.z, 2, 25, "%.2f"),
                (14, "Pitch", advanced.camera.pitch, -89, 89, "%.1f°"),
                (15, "Yaw", advanced.camera.yaw, -180, 180, "%.1f°"),
                (16, "Roll", advanced.camera.roll, -180, 180, "%.1f°")
            ])
        case 2:
            sectionNote.stringValue = "Large-scale tail structure"
            configureRows([
                (20, "Spread", advanced.tail.spread, 1.2, 4.8, "%.2f"),
                (21, "Ray Count", advanced.tail.rayCount, 24, 160, "%.0f"),
                (22, "Fold Density", advanced.tail.foldDensity, 2, 24, "%.2f"),
                (23, "Curl", advanced.tail.curl, -2, 2, "%.3f"),
                (24, "Twist", advanced.tail.twist, -1.5, 1.5, "%.3f"),
                (25, "Edge Flutter", advanced.tail.edgeFlutter, 0, 0.45, "%.3f"),
                (26, "Depth", advanced.tail.depth, 0.05, 1.5, "%.3f"),
                (27, "Current Strength", advanced.tail.currentStrength, 0, 1, "%.3f")
            ])
        case 3:
            sectionNote.stringValue = "Movement character"
            configureRows([
                (30, "Motion Speed", advanced.tail.motionSpeed, 0.03, 1, "%.3f"),
                (31, "Turbulence", advanced.tail.turbulence, 0, 1, "%.3f"),
                (32, "Motion Amplitude", advanced.tail.motionAmplitude, 0, 1, "%.3f")
            ])
        case 4:
            sectionNote.stringValue = "Translucency and light response"
            configureRows([
                (40, "Opacity", advanced.tail.opacity, 0.05, 1.2, "%.3f"),
                (41, "Transmission", advanced.tail.transmission, 0, 1.3, "%.3f"),
                (42, "Rim Light", advanced.tail.rimStrength, 0, 2.5, "%.2f"),
                (43, "Fold Highlight", advanced.tail.foldHighlight, 0, 2.5, "%.2f"),
                (44, "Iridescence", advanced.tail.iridescence, 0, 1.5, "%.2f"),
                (45, "Bloom", advanced.tail.bloom, 0, 1.5, "%.2f")
            ])
        case 5:
            sectionNote.stringValue = "Color grading over the approved palette"
            configureRows([
                (50, "Saturation", advanced.tail.saturation, 0, 2.5, "%.2f"),
                (51, "Brightness", advanced.tail.brightness, 0.4, 2.5, "%.2f"),
                (52, "Gradient Position", advanced.tail.gradientPosition, -0.5, 0.5, "%.3f")
            ])
        case 6:
            sectionNote.stringValue = "Mac-only microstructure · start near 1.0"
            configureRows([
                (60, "Micro Folds", advanced.tail.microFold, 0, 2.5, "%.2f"),
                (61, "Ray Definition", advanced.tail.rayDefinition, 0, 2.5, "%.2f"),
                (62, "Edge Ruffle", advanced.tail.edgeRuffle, 0, 2.5, "%.2f"),
                (63, "Vein Strength", advanced.tail.veinStrength, 0, 2.5, "%.2f"),
                (64, "Membrane Grain", advanced.tail.membraneGrain, 0, 2.5, "%.2f"),
                (65, "Fine Flutter", advanced.tail.fineFlutter, 0, 2.5, "%.2f"),
                (66, "Normal Detail", advanced.tail.normalDetail, 0, 2.5, "%.2f")
            ])
        case 7:
            sectionNote.stringValue = "Primary membrane layer"
            configureLayer(advanced.frontLayer, baseTag: 70)
        default:
            sectionNote.stringValue = "Secondary translucent membrane layer"
            configureLayer(advanced.backLayer, baseTag: 80)
        }
    }

    private func configureLayer(_ layer: BettaLayerTuning, baseTag: Int) {
        configureRows([
            (baseTag, "Layer Scale", layer.scale, 0.25, 1.8, "%.3f"),
            (baseTag + 1, "Layer Alpha", layer.alpha, 0, 1.25, "%.3f"),
            (baseTag + 2, "Offset X", layer.x, -2, 2, "%.3f"),
            (baseTag + 3, "Offset Y", layer.y, -2, 2, "%.3f"),
            (baseTag + 4, "Offset Z", layer.z, -2, 2, "%.3f"),
            (baseTag + 5, "Layer Rotation", layer.rotation, -.pi, .pi, "%.3f"),
            (baseTag + 6, "Motion Phase", layer.phase, -100, 100, "%.2f")
        ])
    }

    private func configureRows(_ values: [(Int, String, Float, Float, Float, String)]) {
        for (index, item) in values.enumerated() where index < sliderRows.count {
            sliderRows[index].configure(tag: item.0, title: item.1, value: item.2, min: item.3, max: item.4, format: item.5, target: self, action: #selector(sliderChanged(_:)))
        }
    }

    @objc private func fishChanged(_ sender: NSSegmentedControl) {
        selectFish(index: sender.selectedSegment)
    }

    @objc private func categoryChanged(_ sender: NSPopUpButton) {
        selectedCategory = min(categories.count - 1, max(0, sender.indexOfSelectedItem))
        refreshCategory()
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
        if let row = sliderRows.first(where: { $0.slider === sender }) {
            row.valueLabel.stringValue = String(format: sender.toolTip ?? "%.2f", Double(value))
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
        refreshCategory()
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
