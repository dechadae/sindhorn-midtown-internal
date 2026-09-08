import AppKit

if CommandLine.arguments.contains("--self-test") {
    exit(BettaSelfTest.run() ? EXIT_SUCCESS : EXIT_FAILURE)
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
