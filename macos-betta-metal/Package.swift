// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BettaMetalLab",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "BettaMetalLab", targets: ["BettaMetalLab"])
    ],
    targets: [
        .executableTarget(
            name: "BettaMetalLab",
            path: "Sources/BettaMetalLab",
            resources: [
                .copy("Shaders.metal")
            ]
        )
    ]
)
