import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

enum PNGError: Error, CustomStringConvertible {
    case encodeFailed(String)
    var description: String {
        switch self {
        case .encodeFailed(let m): return "PNG encode failed: \(m)"
        }
    }
}

/// Writes a rendered frame to disk so a person can look at it. The whole point
/// of the taste test is that the judgement happens by eye, not by threshold.
func writePNG(_ frame: Frame, to url: URL) throws {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    // Alpha is 1 everywhere: the pass clears to an opaque ground and blends
    // over it. Skipping the alpha channel avoids any premultiply ambiguity.
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)

    guard let provider = CGDataProvider(data: Data(frame.pixels) as CFData) else {
        throw PNGError.encodeFailed("could not wrap pixel data")
    }
    guard let image = CGImage(
        width: frame.width,
        height: frame.height,
        bitsPerComponent: 8,
        bitsPerPixel: 32,
        bytesPerRow: frame.width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo,
        provider: provider,
        decode: nil,
        shouldInterpolate: false,
        intent: .defaultIntent
    ) else {
        throw PNGError.encodeFailed("could not build CGImage")
    }
    guard let destination = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.png.identifier as CFString, 1, nil
    ) else {
        throw PNGError.encodeFailed("could not open \(url.path)")
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw PNGError.encodeFailed("could not finalize \(url.path)")
    }
}
