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

/// The same frame as JPEG bytes, for sending rather than keeping.
///
/// The studio's eyes: small enough that a turn stays a turn - a wallpaper is
/// judged at a glance, and a glance does not need five thousand pixels - and
/// lossy because nothing downstream measures it. Nothing on disk.
func jpegData(_ frame: Frame, maxWidth: Int = 768, quality: Double = 0.7) -> Data? {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
    guard let provider = CGDataProvider(data: Data(frame.pixels) as CFData),
          let image = CGImage(
              width: frame.width, height: frame.height,
              bitsPerComponent: 8, bitsPerPixel: 32,
              bytesPerRow: frame.width * 4,
              space: colorSpace, bitmapInfo: bitmapInfo,
              provider: provider, decode: nil,
              shouldInterpolate: true, intent: .defaultIntent
          ) else { return nil }

    var source = image
    if frame.width > maxWidth {
        let height = max(1, Int((Double(maxWidth) / Double(frame.width) * Double(frame.height)).rounded()))
        if let context = CGContext(
            data: nil, width: maxWidth, height: height,
            bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) {
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: maxWidth, height: height))
            if let scaled = context.makeImage() { source = scaled }
        }
    }

    let out = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(
        out, UTType.jpeg.identifier as CFString, 1, nil
    ) else { return nil }
    CGImageDestinationAddImage(destination, source, [
        kCGImageDestinationLossyCompressionQuality: quality
    ] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { return nil }
    return out as Data
}
