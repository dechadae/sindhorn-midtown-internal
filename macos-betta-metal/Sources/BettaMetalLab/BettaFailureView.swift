import AppKit

final class BettaFailureView: NSView {
    private let diagnostics: BettaDiagnostics
    private let error: Error
    private let reportView = NSTextView()
    private let noteField = NSTextField()
    private let statusLabel = NSTextField(labelWithString: "")
    private let sendButton = NSButton(title: "Send Bug Report", target: nil, action: nil)

    init(frame frameRect: NSRect, error: Error, diagnostics: BettaDiagnostics = .shared) {
        self.error = error
        self.diagnostics = diagnostics
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        buildUI()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func buildUI() {
        let title = NSTextField(labelWithString: "Betta Metal Lab could not start")
        title.font = .systemFont(ofSize: 24, weight: .semibold)
        title.textColor = .labelColor

        let subtitle = NSTextField(wrappingLabelWithString: "The renderer failed during startup. You can send the diagnostic report directly to the Sindhorn bug-report server, copy it, or save it as a text file.")
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = .secondaryLabelColor

        let errorBox = NSTextField(wrappingLabelWithString: error.localizedDescription)
        errorBox.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        errorBox.textColor = .systemRed
        errorBox.wantsLayer = true
        errorBox.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        errorBox.layer?.cornerRadius = 8
        errorBox.layer?.borderWidth = 1
        errorBox.layer?.borderColor = NSColor.separatorColor.cgColor

        reportView.isEditable = false
        reportView.isSelectable = true
        reportView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        reportView.string = diagnostics.reportText()
        reportView.textContainerInset = NSSize(width: 10, height: 10)
        reportView.drawsBackground = true
        reportView.backgroundColor = .textBackgroundColor

        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        scroll.documentView = reportView

        noteField.placeholderString = "Optional note: what you saw before the app failed"

        statusLabel.font = .systemFont(ofSize: 12, weight: .medium)
        statusLabel.textColor = .secondaryLabelColor

        let copyButton = NSButton(title: "Copy Report", target: self, action: #selector(copyReport))
        let saveButton = NSButton(title: "Save Report…", target: self, action: #selector(saveReport))
        sendButton.target = self
        sendButton.action = #selector(sendReport)
        sendButton.keyEquivalent = "\r"
        let quitButton = NSButton(title: "Quit", target: self, action: #selector(quitApp))

        let buttons = NSStackView(views: [copyButton, saveButton, sendButton, quitButton])
        buttons.orientation = .horizontal
        buttons.spacing = 8
        buttons.alignment = .centerY

        let stack = NSStackView(views: [title, subtitle, errorBox, scroll, noteField, statusLabel, buttons])
        stack.orientation = .vertical
        stack.spacing = 12
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        title.translatesAutoresizingMaskIntoConstraints = false
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        errorBox.translatesAutoresizingMaskIntoConstraints = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        noteField.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        buttons.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 28),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -24),

            title.widthAnchor.constraint(equalTo: stack.widthAnchor),
            subtitle.widthAnchor.constraint(equalTo: stack.widthAnchor),
            errorBox.widthAnchor.constraint(equalTo: stack.widthAnchor),
            errorBox.heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
            scroll.widthAnchor.constraint(equalTo: stack.widthAnchor),
            scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 300),
            noteField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            statusLabel.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    @objc private func copyReport() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(diagnostics.reportText(), forType: .string)
        statusLabel.stringValue = "Report copied to clipboard."
        statusLabel.textColor = .secondaryLabelColor
    }

    @objc private func saveReport() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.plainText]
        panel.nameFieldStringValue = "Betta-Bug-Report.txt"
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try diagnostics.saveReport(to: url)
            statusLabel.stringValue = "Saved: \(url.lastPathComponent)"
            statusLabel.textColor = .secondaryLabelColor
        } catch {
            statusLabel.stringValue = "Could not save report: \(error.localizedDescription)"
            statusLabel.textColor = .systemRed
        }
    }

    @objc private func sendReport() {
        sendButton.isEnabled = false
        statusLabel.stringValue = "Sending diagnostic report…"
        statusLabel.textColor = .secondaryLabelColor

        diagnostics.send(userNote: noteField.stringValue) { [weak self] result in
            guard let self else { return }
            self.sendButton.isEnabled = true
            switch result {
            case .success(let reportID):
                self.statusLabel.stringValue = "Sent successfully — Report ID: \(reportID)"
                self.statusLabel.textColor = .systemGreen
                self.sendButton.title = "Send Again"
            case .failure(let error):
                self.statusLabel.stringValue = "Send failed: \(error.localizedDescription)"
                self.statusLabel.textColor = .systemRed
            }
        }
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }
}
