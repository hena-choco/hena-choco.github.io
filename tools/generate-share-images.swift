import AppKit
import Foundation

func color(_ hex: String) -> NSColor {
    let value = Int(hex.dropFirst(), radix: 16) ?? 0
    return NSColor(
        red: CGFloat((value >> 16) & 255) / 255,
        green: CGFloat((value >> 8) & 255) / 255,
        blue: CGFloat(value & 255) / 255,
        alpha: 1
    )
}

func draw(_ text: String, x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat,
          font: NSFont, foreground: NSColor, alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: foreground,
        .paragraphStyle: paragraph
    ]
    (text as NSString).draw(in: NSRect(x: x, y: 630 - top - height, width: width, height: height), withAttributes: attributes)
}

func drawImage(_ image: NSImage, x: CGFloat, top: CGFloat, size: CGFloat) {
    image.draw(in: NSRect(x: x, y: 630 - top - size, width: size, height: size),
               from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
}

let siteRoot = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "outputs", isDirectory: true)
let indexHTML = try String(contentsOf: siteRoot.appendingPathComponent("index.html"), encoding: .utf8)
let brandMarkURL = siteRoot.appendingPathComponent("share-images/brand-mark.png")
guard let brandMark = NSImage(contentsOf: brandMarkURL) else {
    fatalError("share-images/brand-mark.png が読み込めません")
}
let colorPattern = #"<!--\s*(\d{4})年\s*-->[\s\S]*?--movie-color:\s*(#[0-9A-Fa-f]{6})"#
let regex = try NSRegularExpression(pattern: colorPattern)
let range = NSRange(indexHTML.startIndex..., in: indexHTML)
var colors: [Int: String] = [:]
for match in regex.matches(in: indexHTML, range: range) {
    guard let yearRange = Range(match.range(at: 1), in: indexHTML),
          let colorRange = Range(match.range(at: 2), in: indexHTML),
          let year = Int(indexHTML[yearRange]) else { continue }
    colors[year] = String(indexHTML[colorRange]).uppercased()
}
guard !colors.isEmpty else { fatalError("年別テーマカラーを index.html から読み取れませんでした") }
let output = siteRoot.appendingPathComponent("share-images", isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

for (year, hex) in colors.sorted(by: { $0.key < $1.key }) {
    let size = NSSize(width: 1200, height: 630)
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size.width),
        pixelsHigh: Int(size.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high

    let tint = color(hex)
    let textColor = color("#333333")
    let background = color("#F4F7F9")
    background.setFill()
    NSRect(origin: .zero, size: size).fill()

    // A cropped matte color disc echoes the year's accent without a frame.
    let disc = NSBezierPath(ovalIn: NSRect(x: 760, y: -98, width: 720, height: 760))
    tint.setFill()
    disc.fill()

    drawImage(brandMark, x: 92, top: 322, size: 54)
    draw("ドラえもん検定", x: 162, top: 322, width: 650, height: 58,
         font: .systemFont(ofSize: 42, weight: .medium), foreground: textColor)

    // Place the year low and left aligned, leaving generous negative space.
    draw(String(year), x: 82, top: 350, width: 730, height: 205,
         font: .systemFont(ofSize: 170, weight: .light), foreground: textColor)
    NSGraphicsContext.restoreGraphicsState()
    let data = bitmap.representation(using: .png, properties: [:])!
    try data.write(to: output.appendingPathComponent("doraemon-kentei-\(year).png"), options: .atomic)
}
