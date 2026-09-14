import SwiftUI
import ImageIO
#if canImport(UIKit)
import UIKit
#endif

/// Plays an animated GIF bundled in the design-system module.
public struct AnimatedGIFView: View {
    public var resourceName: String
    public var maxPixelSize: CGFloat

    public init(resourceName: String = "LogoLoading", maxPixelSize: CGFloat = 480) {
        self.resourceName = resourceName
        self.maxPixelSize = maxPixelSize
    }

    public var body: some View {
        #if canImport(UIKit)
        AnimatedGIFImageView(resourceName: resourceName, maxPixelSize: maxPixelSize)
        #else
        ProgressView()
        #endif
    }
}

#if canImport(UIKit)
private struct AnimatedGIFImageView: UIViewRepresentable {
    let resourceName: String
    let maxPixelSize: CGFloat

    func makeUIView(context: Context) -> UIImageView {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        imageView.backgroundColor = .clear
        imageView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        imageView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        imageView.setContentHuggingPriority(.defaultLow, for: .horizontal)
        imageView.setContentHuggingPriority(.defaultLow, for: .vertical)
        applyAnimation(to: imageView)
        return imageView
    }

    func updateUIView(_ imageView: UIImageView, context: Context) {
        if imageView.animationImages == nil {
            applyAnimation(to: imageView)
        } else if !imageView.isAnimating {
            imageView.startAnimating()
        }
    }

    private func applyAnimation(to imageView: UIImageView) {
        guard let animation = AnimatedGIFLoader.load(
            named: resourceName,
            extension: "gif",
            in: .module,
            maxPixelSize: maxPixelSize
        ) else { return }
        imageView.animationImages = animation.images
        imageView.animationDuration = animation.duration
        imageView.animationRepeatCount = 0
        imageView.startAnimating()
    }
}

enum AnimatedGIFLoader {
    struct Animation {
        let images: [UIImage]
        let duration: TimeInterval
    }

    static func load(
        named name: String,
        extension ext: String,
        in bundle: Bundle,
        maxPixelSize: CGFloat
    ) -> Animation? {
        guard let url = bundle.url(forResource: name, withExtension: ext),
              let data = try? Data(contentsOf: url),
              let source = CGImageSourceCreateWithData(data as CFData, nil)
        else { return nil }

        let count = CGImageSourceGetCount(source)
        guard count > 0 else { return nil }

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]

        var images: [UIImage] = []
        var duration: TimeInterval = 0
        images.reserveCapacity(count)

        for index in 0..<count {
            guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary) else {
                continue
            }
            images.append(UIImage(cgImage: cgImage))
            duration += frameDelay(source: source, index: index)
        }

        guard !images.isEmpty else { return nil }
        if duration <= 0 {
            duration = Double(images.count) * 0.1
        }
        return Animation(images: images, duration: duration)
    }

    private static func frameDelay(source: CGImageSource, index: Int) -> TimeInterval {
        let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
        let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        let delay = (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
            ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double)
            ?? 0.1
        // Browsers clamp very small delays; match that so the loop doesn't spin too fast.
        return delay < 0.02 ? 0.1 : delay
    }
}
#endif

