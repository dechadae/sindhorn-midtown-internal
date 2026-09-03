import AppKit

if CommandLine.arguments.contains("--self-test") {
    exit(BettaSelfTest.run() ? EXIT_SUCCESS : EXIT_FAILURE)
}

// NSApplication's process entry is the main thread. Make that executor
// relationship explicit for Swift 6 so AppKit/main-actor initialization is
// checked correctly without changing the established synchronous app loop.
MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
