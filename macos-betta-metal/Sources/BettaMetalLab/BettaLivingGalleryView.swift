import AppKit

/// Consumer-facing surface for the Betta app. The Metal renderer remains the
/// hero artwork behind this compact native glass panel; no thumbnails or
/// pre-rendered media are required.
final class BettaLivingGalleryView: NSView {
    var onSelectOriginal: ((Int) -> Void)?
    var onUseOnDesktop: (() -> Void)?
    var onCustomize: (() -> Void)?
    var onRandomize: (() -> Void)?
    var onToggleEvolution: (() -> Void)?
    var onToggleFavorite: (() -> Void)?
    var onLoadFavorite: ((String) -> Void)?

    private let presetStore = BettaUserPresetStore.shared
    private let randomStore = BettaRandomStyleStore.shared

    private var selectedIndex: Int
    private var originalButtons: [NSButton] = []
    private var titleLabel: NSTextField!
    private var detailLabel: NSTextField!
    private var favoritesPopup: NSPopUpButton!
    private var favoriteButton: NSButton!
    private var evolveButton: NSButton!
    private var statusLabel: NSTextField!

    init(initialIndex: Int) {
        selectedIndex = min(7, max(0, initialIndex))
        super.init(frame: .zero)
        build()
        refresh()
    }

    required init?(coder: NSCoder) { nil }

    func selectFish(index: Int) {
        selectedIndex = min(7, max(0, index))
        refresh()
    }

    func refresh(message: String? = nil) {
        let preset = BettaPreset.all[selectedIndex]
        titleLabel?.stringValue = preset.name

        if let style = randomStore.style(for: preset.referenceId), style.seed != 0 {
            detailLabel?.stringValue = "Generated organism · #\(style.shortSeed)"
        } else {
            detailLabel?.stringValue = "Original \(preset.number) · immutable source"
        }

        for (index, button) in originalButtons.enumerated() {
            button.state = index == selectedIndex ? .on : .off
        }

        rebuildFavorites()
        updateFavoriteButton()
        if let message { statusLabel?.stringValue = message }
    }

    func setEvolutionActive(_ active: Bool) {
        evolveButton?.title = active ? "Stop Evolving" : "Evolve"
        evolveButton?.state = active ? .on : .off
    }

    private func build() {
        translatesAutoresizingMaskIntoConstraints = false
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        let eyebrow = NSTextField(labelWithString: "LIVING GALLERY")
        eyebrow.font = .systemFont(ofSize: 10, weight: .semibold)
        eyebrow.textColor = .secondaryLabelColor

        let brand = NSTextField(labelWithString: "BETTA")
        brand.font = .systemFont(ofSize: 25, weight: .semibold)

        let subhead = NSTextField(wrappingLabelWithString: "Living generative art for your Mac")
        subhead.font = .systemFont(ofSize: 12)
        subhead.textColor = .secondaryLabelColor
        subhead.maximumNumberOfLines = 2

        titleLabel = NSTextField(labelWithString: "")
        titleLabel.font = .systemFont(ofSize: 16, weight: .medium)
        titleLabel.lineBreakMode = .byTruncatingTail

        detailLabel = NSTextField(labelWithString: "")
        detailLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        detailLabel.textColor = .tertiaryLabelColor

        let originalsLabel = NSTextField(labelWithString: "Originals")
        originalsLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        originalsLabel.textColor = .secondaryLabelColor

        originalButtons = BettaPreset.all.enumerated().map { index, preset in
            let button = NSButton(title: preset.number, target: self, action: #selector(originalSelected(_:)))
            button.tag = index
            button.setButtonType(.pushOnPushOff)
            button.bezelStyle = .roundRect
            button.font = .monospacedDigitSystemFont(ofSize: 11, weight: .medium)
            button.toolTip = preset.name
            return button
        }

        let rowA = NSStackView(views: Array(originalButtons[0..<4]))
        rowA.orientation = .horizontal
        rowA.distribution = .fillEqually
        rowA.spacing = 6
        let rowB = NSStackView(views: Array(originalButtons[4..<8]))
        rowB.orientation = .horizontal
        rowB.distribution = .fillEqually
        rowB.spacing = 6
        let originals = NSStackView(views: [rowA, rowB])
        originals.orientation = .vertical
        originals.spacing = 6

        let favoritesLabel = NSTextField(labelWithString: "Favorites")
        favoritesLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        favoritesLabel.textColor = .secondaryLabelColor

        favoritesPopup = NSPopUpButton(frame: .zero, pullsDown: false)
        favoritesPopup.target = self
        favoritesPopup.action = #selector(favoriteSelected(_:))

        favoriteButton = NSButton(title: "☆ Favorite", target: self, action: #selector(toggleFavorite(_:)))
        favoriteButton.bezelStyle = .rounded

        let randomButton = NSButton(title: "Random", target: self, action: #selector(randomize(_:)))
        randomButton.bezelStyle = .rounded

        evolveButton = NSButton(title: "Evolve", target: self, action: #selector(toggleEvolution(_:)))
        evolveButton.bezelStyle = .rounded

        let quickActions = NSStackView(views: [favoriteButton, randomButton, evolveButton])
        quickActions.orientation = .horizontal
        quickActions.distribution = .fillEqually
        quickActions.spacing = 7

        let useButton = NSButton(title: "Use on Desktop", target: self, action: #selector(useOnDesktop(_:)))
        useButton.bezelStyle = .rounded
        useButton.controlSize = .large
        useButton.keyEquivalent = "\r"

        let customizeButton = NSButton(title: "Customize in Living Studio", target: self, action: #selector(customize(_:)))
        customizeButton.bezelStyle = .rounded

        statusLabel = NSTextField(labelWithString: "Choose an Original, Favorite, or let it evolve.")
        statusLabel.font = .systemFont(ofSize: 10)
        statusLabel.textColor = .tertiaryLabelColor
        statusLabel.lineBreakMode = .byTruncatingTail

        let stack = NSStackView(views: [
            eyebrow, brand, subhead,
            titleLabel, detailLabel,
            originalsLabel, originals,
            favoritesLabel, favoritesPopup,
            quickActions,
            useButton, customizeButton,
            statusLabel
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 9
        stack.translatesAutoresizingMaskIntoConstraints = false

        let contentHost = NSView(frame: .zero)
        contentHost.translatesAutoresizingMaskIntoConstraints = false
        contentHost.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: contentHost.leadingAnchor, constant: 18),
            stack.trailingAnchor.constraint(equalTo: contentHost.trailingAnchor, constant: -18),
            stack.topAnchor.constraint(equalTo: contentHost.topAnchor, constant: 18),
            stack.bottomAnchor.constraint(equalTo: contentHost.bottomAnchor, constant: -18),
            rowA.widthAnchor.constraint(equalTo: stack.widthAnchor),
            rowB.widthAnchor.constraint(equalTo: stack.widthAnchor),
            favoritesPopup.widthAnchor.constraint(equalTo: stack.widthAnchor),
            quickActions.widthAnchor.constraint(equalTo: stack.widthAnchor),
            useButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
            customizeButton.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])

        let glass = BettaLiquidGlassSurface.make(content: contentHost, cornerRadius: 24)
        addSubview(glass)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 390),
            glass.leadingAnchor.constraint(equalTo: leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: trailingAnchor),
            glass.topAnchor.constraint(equalTo: topAnchor),
            glass.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    private func rebuildFavorites() {
        guard let favoritesPopup else { return }
        let favorites = presetStore.all().filter(\.isFavorite)
        favoritesPopup.removeAllItems()

        if favorites.isEmpty {
            favoritesPopup.addItem(withTitle: "No Favorites yet")
            favoritesPopup.isEnabled = false
            return
        }

        favoritesPopup.isEnabled = true
        favoritesPopup.addItem(withTitle: "Choose a Favorite…")
        favoritesPopup.lastItem?.representedObject = nil
        for preset in favorites {
            favoritesPopup.addItem(withTitle: "★ \(preset.name)")
            favoritesPopup.lastItem?.representedObject = preset.id
        }
        favoritesPopup.selectItem(at: 0)
    }

    private func updateFavoriteButton() {
        let id = BettaPreset.all[selectedIndex].referenceId
        favoriteButton?.title = presetStore.currentMatch(referenceId: id)?.isFavorite == true ? "★ Favorite" : "☆ Favorite"
    }

    @objc private func originalSelected(_ sender: NSButton) {
        selectedIndex = min(7, max(0, sender.tag))
        onSelectOriginal?(selectedIndex)
        refresh(message: "Original selected · cinematic morph")
    }

    @objc private func favoriteSelected(_ sender: NSPopUpButton) {
        guard let id = sender.selectedItem?.representedObject as? String else { return }
        onLoadFavorite?(id)
    }

    @objc private func toggleFavorite(_ sender: Any?) {
        onToggleFavorite?()
    }

    @objc private func randomize(_ sender: Any?) {
        onRandomize?()
    }

    @objc private func toggleEvolution(_ sender: Any?) {
        onToggleEvolution?()
    }

    @objc private func useOnDesktop(_ sender: Any?) {
        onUseOnDesktop?()
    }

    @objc private func customize(_ sender: Any?) {
        onCustomize?()
    }
}
