// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BettaMetalLab",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "BettaMetalLab", targets: ["BettaMetalLab"]),
        .executable(name: "BettaTest04", targets: ["BettaTest04"])
    ],
    targets: [
        .executableTarget(
            name: "BettaMetalLab",
            path: "Sources/BettaMetalLab",
            resources: [
                .copy("Shaders.metal")
            ]
        ),
        // IDUI Test 04. Separate from BettaMetalLab on purpose: that target is
        // held to parity with the locked production presets, this one must have
        // zero appearance decisions in its generator. They share a package and
        // nothing else - no imports in either direction.
        .executableTarget(
            name: "BettaTest04",
            path: "Sources/BettaTest04",
            resources: [
                .copy("constitution.json"),
                .copy("constitution-a.json"),
                .copy("constitution-b.json"),
                .copy("constitution-c.json"),
                .copy("locked-compositions.json")
            ]
        )
    ]
)
