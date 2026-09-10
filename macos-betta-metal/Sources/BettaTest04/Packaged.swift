import Foundation

/// Where this target's files are.
///
/// Under `swift build` they sit in the SwiftPM resource bundle beside the
/// binary and `Bundle.module` finds them. Inside Betta Explorer.app the same
/// files are copied into Contents/Resources, and those are looked up first so
/// the app is whole on its own - it never reaches back into the checkout that
/// built it. Same bytes either way; only the folder differs.
enum Packaged {
    static func url(_ name: String, _ ext: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: ext)
            ?? Bundle.module.url(forResource: name, withExtension: ext)
    }

    /// True when running as the app rather than the command-line binary.
    static var isApp: Bool { Bundle.main.bundleURL.pathExtension == "app" }
}
