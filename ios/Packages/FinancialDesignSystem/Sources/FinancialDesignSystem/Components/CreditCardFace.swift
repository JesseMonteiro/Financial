import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public enum CreditCardFaceMetrics {
    public static let size = CGSize(width: 188, height: 118)
    public static let corner: CGFloat = 12
}

public struct CardFaceStyle: Sendable, Equatable {
    public let assetName: String?
    public let gradient: [Color]
    public let productLabel: String

    public init(assetName: String?, gradient: [Color], productLabel: String) {
        self.assetName = assetName
        self.gradient = gradient
        self.productLabel = productLabel
    }
}

enum CardFaceImageLoader {
    static func image(named name: String) -> Image? {
        #if canImport(UIKit)
        if let ui = UIImage(named: name, in: .module, compatibleWith: nil) {
            return Image(uiImage: ui)
        }
        let extensions = ["png", "jpg", "jpeg"]
        let subdirs: [String?] = [nil, "CardFaces", "Resources/CardFaces"]
        for ext in extensions {
            for subdir in subdirs {
                let url: URL?
                if let subdir {
                    url = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: subdir)
                } else {
                    url = Bundle.module.url(forResource: name, withExtension: ext)
                }
                if let url, let ui = UIImage(contentsOfFile: url.path) {
                    return Image(uiImage: ui)
                }
            }
        }
        #endif
        return nil
    }
}

public enum CardFaceCatalog {
    private struct Entry: Sendable {
        let id: String
        let kind: Kind
        let aliases: [String]
        let assetName: String
        let productLabel: String
        let color: UInt32
        let parent: String?

        enum Kind: Equatable { case card, bank }
    }

    /// Same mapping as `src/utils/cardFaces.js` CARD_FACE_FILE.
    private static let entries: [Entry] = [
        .init(id: "santander-unique", kind: .card, aliases: ["santander unique", "unique"], assetName: "santander-unique", productLabel: "Unique", color: 0x9B1B30, parent: "santander"),
        .init(id: "santander-sx", kind: .card, aliases: ["santander sx", "sx"], assetName: "santander", productLabel: "SX", color: 0x111111, parent: "santander"),
        .init(id: "santander-unlimited", kind: .card, aliases: ["santander unlimited", "unlimited"], assetName: "santander", productLabel: "Unlimited", color: 0x1A1A2E, parent: "santander"),
        .init(id: "nubank-ultravioleta", kind: .card, aliases: ["ultravioleta", "nubank ultravioleta"], assetName: "nubank-ultravioleta", productLabel: "Ultravioleta", color: 0x1A0A2E, parent: "nubank"),
        .init(id: "nubank-rewards", kind: .card, aliases: ["nubank rewards"], assetName: "nubank", productLabel: "Rewards", color: 0x5B0A9D, parent: "nubank"),
        .init(id: "itau-personnalite", kind: .card, aliases: ["personnalite", "personnalite itau", "itau personnalite"], assetName: "itau", productLabel: "Personnalité", color: 0x003399, parent: "itau"),
        .init(id: "itau-latam", kind: .card, aliases: ["latam pass", "itau latam"], assetName: "itau", productLabel: "Latam Pass", color: 0xE31837, parent: "itau"),
        .init(id: "itau-click", kind: .card, aliases: ["itau click", "itaú click", "click"], assetName: "itau-click", productLabel: "Click", color: 0xEC7000, parent: "itau"),
        .init(id: "itau-extra", kind: .card, aliases: ["extra itau visa internacional", "extra itau", "cartao extra", "extra"], assetName: "itau-extra", productLabel: "Extra", color: 0x0057B8, parent: "itau"),
        .init(id: "itau-azul", kind: .card, aliases: ["azul itau visa platinum", "azul itau", "itau azul", "azul"], assetName: "itau-azul", productLabel: "Azul", color: 0x0B1F3A, parent: "itau"),
        .init(id: "itau-platinum", kind: .card, aliases: ["itau visa platinum", "platinum"], assetName: "itau-platinum", productLabel: "Platinum", color: 0xEC7000, parent: "itau"),
        .init(id: "inter-gold", kind: .card, aliases: ["inter gold", "gold"], assetName: "inter-gold", productLabel: "Gold", color: 0xFF7A00, parent: "inter"),
        .init(id: "inter-black", kind: .card, aliases: ["inter black", "inter win"], assetName: "inter", productLabel: "Black", color: 0x1A1A1A, parent: "inter"),
        .init(id: "c6-carbon", kind: .card, aliases: ["c6 carbon", "carbon"], assetName: "c6", productLabel: "Carbon", color: 0x111111, parent: "c6"),
        .init(id: "bradesco-elo", kind: .card, aliases: ["bradescard", "bradesco elo"], assetName: "bradesco", productLabel: "Bradescard", color: 0xCC092F, parent: "bradesco"),
        .init(id: "santander", kind: .bank, aliases: ["santander", "banco santander"], assetName: "santander", productLabel: "Santander", color: 0xEC0000, parent: nil),
        .init(id: "nubank", kind: .bank, aliases: ["nubank", "nu pagamentos", "nu bank", "roxinho"], assetName: "nubank", productLabel: "Nubank", color: 0x820AD1, parent: nil),
        .init(id: "itau", kind: .bank, aliases: ["itau", "banco itau", "itaucard"], assetName: "itau", productLabel: "Itaú", color: 0xEC7000, parent: nil),
        .init(id: "inter", kind: .bank, aliases: ["inter", "banco inter"], assetName: "inter", productLabel: "Inter", color: 0xFF7A00, parent: nil),
        .init(id: "bradesco", kind: .bank, aliases: ["bradesco", "banco bradesco"], assetName: "bradesco", productLabel: "Bradesco", color: 0xCC092F, parent: nil),
        .init(id: "c6", kind: .bank, aliases: ["c6", "c6 bank"], assetName: "c6", productLabel: "C6", color: 0x111111, parent: nil),
        .init(id: "mercado-pago", kind: .bank, aliases: ["mercado pago", "mercadopago", "mercado livre"], assetName: "mercado-pago", productLabel: "Mercado Pago", color: 0x00B1EA, parent: nil),
        .init(id: "picpay", kind: .bank, aliases: ["picpay"], assetName: "picpay", productLabel: "PicPay", color: 0x21C25E, parent: nil),
        .init(id: "amazon", kind: .bank, aliases: ["amazon", "amazon brasil"], assetName: "amazon", productLabel: "Amazon", color: 0x232F3E, parent: nil),
        .init(id: "porto-seguro", kind: .bank, aliases: ["porto seguro", "porto bank"], assetName: "porto-seguro", productLabel: "Porto Seguro", color: 0x004B8D, parent: nil),
        .init(id: "magalu", kind: .bank, aliases: ["magalu", "magazine luiza", "luizalabs"], assetName: "magalu", productLabel: "Magalu", color: 0x0086FF, parent: nil),
    ]

    private static let byID: [String: Entry] = Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0) })

    public static func style(
        iconKey: String? = nil,
        name: String,
        institution: String = "",
        marketingName: String = "",
        connectorName: String = ""
    ) -> CardFaceStyle {
        if let iconKey, let entry = byID[iconKey] ?? byID[parentFallback(iconKey)] {
            return makeStyle(entry)
        }
        let blob = normalize([name, institution, marketingName, connectorName].joined(separator: " "))
        if let entry = match(blob, prefer: .card) ?? match(blob, prefer: .bank) {
            return makeStyle(entry)
        }
        return CardFaceStyle(
            assetName: nil,
            gradient: [FinancialColors.primary, FinancialColors.primaryHover],
            productLabel: shortFallback(name)
        )
    }

    public static func style(forName name: String, institution: String = "") -> CardFaceStyle {
        style(name: name, institution: institution)
    }

    private static func parentFallback(_ key: String) -> String {
        if let dash = key.split(separator: "-").first { return String(dash) }
        return key
    }

    private static func makeStyle(_ entry: Entry) -> CardFaceStyle {
        CardFaceStyle(
            assetName: entry.assetName,
            gradient: [
                Color(hex: entry.color),
                Color(hex: entry.color).opacity(0.72),
            ],
            productLabel: entry.productLabel
        )
    }

    private static func shortFallback(_ name: String, bank: String? = nil) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return bank ?? "Cartão" }
        let stripped = trimmed.replacingOccurrences(
            of: "^(Santander|Nubank|Itaú|Itau|Inter|C6|Bradesco)\\s+",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        return stripped.isEmpty ? (bank ?? trimmed) : stripped
    }

    private static func match(_ blob: String, prefer kind: Entry.Kind) -> Entry? {
        let ranked = entries
            .filter { $0.kind == kind }
            .sorted { maxAlias($0) > maxAlias($1) }
        for entry in ranked where entry.aliases.contains(where: { aliasMatches(blob, $0) }) {
            return entry
        }
        return nil
    }

    private static func maxAlias(_ entry: Entry) -> Int {
        entry.aliases.map(\.count).max() ?? 0
    }

    private static func aliasMatches(_ blob: String, _ alias: String) -> Bool {
        let a = normalize(alias)
        guard !a.isEmpty else { return false }
        if blob == a { return true }
        if " \(blob) ".contains(" \(a) ") { return true }
        if a.count >= 6, blob.contains(a) { return true }
        return false
    }

    static func normalize(_ value: String) -> String {
        let folded = value.folding(options: .diacriticInsensitive, locale: Locale(identifier: "en_US_POSIX")).lowercased()
        let mapped = folded.map { ch -> Character in
            ch.isLetter || ch.isNumber ? ch : " "
        }
        return String(mapped).split(separator: " ").joined(separator: " ")
    }
}

public struct CreditCardFaceView: View {
    public enum BillStatus: String, Sendable {
        case paid
        case due
    }

    public let name: String
    public let lastFour: String
    public let amountLabel: String
    public var institutionName: String
    public var marketingName: String
    public var connectorName: String
    public var iconKey: String?
    public var cardFaceURL: URL?
    public var selected: Bool
    public var status: BillStatus?
    public var ownerLabel: String?

    public init(
        name: String,
        lastFour: String,
        amountLabel: String,
        institutionName: String = "",
        marketingName: String = "",
        connectorName: String = "",
        iconKey: String? = nil,
        cardFaceURL: URL? = nil,
        selected: Bool = false,
        status: BillStatus? = nil,
        ownerLabel: String? = nil
    ) {
        self.name = name
        self.lastFour = lastFour
        self.amountLabel = amountLabel
        self.institutionName = institutionName
        self.marketingName = marketingName
        self.connectorName = connectorName
        self.iconKey = iconKey
        self.cardFaceURL = cardFaceURL
        self.selected = selected
        self.status = status
        self.ownerLabel = ownerLabel
    }

    private var style: CardFaceStyle {
        CardFaceCatalog.style(
            iconKey: iconKey,
            name: name,
            institution: institutionName,
            marketingName: marketingName,
            connectorName: connectorName
        )
    }

    public var body: some View {
        let metrics = CreditCardFaceMetrics.size
        ZStack(alignment: .bottom) {
            cardArt(style)
            LinearGradient(
                colors: [Color.black.opacity(0.78), Color.black.opacity(0.28), .clear],
                startPoint: .bottom,
                endPoint: .top
            )
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                Text(style.productLabel)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.7), radius: 2, y: 1)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    Spacer(minLength: 4)
                    if let status {
                        Text(status == .paid ? "Paga" : "A pagar")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(
                                Capsule()
                                    .fill(status == .paid ? FinancialColors.success : FinancialColors.warning)
                            )
                    }
                }
                    .padding(.horizontal, 10)
                    .padding(.top, 10)

                if let ownerLabel, !ownerLabel.isEmpty {
                    Text(ownerLabel)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                        .padding(.horizontal, 10)
                        .padding(.top, 2)
                }

                Spacer(minLength: 0)
                HStack(alignment: .bottom) {
                    Text("Final \(lastFour)")
                    Spacer()
                    Text(amountLabel)
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.55), radius: 1, y: 1)
                .padding(.horizontal, 10)
                .padding(.bottom, 8)
            }
        }
        .frame(width: metrics.width, height: metrics.height)
        .clipShape(RoundedRectangle(cornerRadius: CreditCardFaceMetrics.corner, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: CreditCardFaceMetrics.corner, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(selected ? 0.28 : 0.16), radius: selected ? 8 : 6, y: 3)
        .overlay {
            RoundedRectangle(cornerRadius: CreditCardFaceMetrics.corner, style: .continuous)
                .strokeBorder(selected ? FinancialColors.primary : Color.clear, lineWidth: 2)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(style.productLabel), final \(lastFour), \(amountLabel)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    @ViewBuilder
    private func cardArt(_ style: CardFaceStyle) -> some View {
        let size = CreditCardFaceMetrics.size
        if let cardFaceURL {
            AsyncImage(url: cardFaceURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    catalogArt(style, size: size)
                }
            }
            .frame(width: size.width, height: size.height)
            .clipped()
        } else {
            catalogArt(style, size: size)
        }
    }

    @ViewBuilder
    private func catalogArt(_ style: CardFaceStyle, size: CGSize) -> some View {
        if let assetName = style.assetName, let image = CardFaceImageLoader.image(named: assetName) {
            image
                .resizable()
                .scaledToFill()
                .frame(width: size.width, height: size.height)
                .clipped()
        } else {
            LinearGradient(colors: style.gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                .frame(width: size.width, height: size.height)
        }
    }
}

public struct CreditAllCardsChip: View {
    public let count: Int
    public let totalLabel: String
    public var selected: Bool
    public var action: () -> Void

    public init(count: Int, totalLabel: String, selected: Bool, action: @escaping () -> Void) {
        self.count = count
        self.totalLabel = totalLabel
        self.selected = selected
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "creditcard.fill")
                    .foregroundStyle(selected ? FinancialColors.primary : FinancialColors.textMuted)
                Text("Todos os Cartões")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(selected ? FinancialColors.primary : FinancialColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(count) cartões • \(totalLabel)")
                    .font(.caption2)
                    .foregroundStyle(FinancialColors.textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(12)
            .frame(
                width: CreditCardFaceMetrics.size.width,
                height: CreditCardFaceMetrics.size.height,
                alignment: .leading
            )
            .background(
                selected ? FinancialColors.primary.opacity(0.12) : FinancialColors.bgTertiary,
                in: RoundedRectangle(cornerRadius: CreditCardFaceMetrics.corner, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: CreditCardFaceMetrics.corner, style: .continuous)
                    .strokeBorder(selected ? FinancialColors.primary : FinancialColors.border, lineWidth: selected ? 2 : 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Todos os cartões, \(count) cartões, saldo \(totalLabel)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

public struct CompactKPICell: View {
    public let title: String
    public let value: String
    public let meta: String
    public var accent: Color

    public init(title: String, value: String, meta: String, accent: Color) {
        self.title = title
        self.value = value
        self.meta = meta
        self.accent = accent
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(FinancialColors.textMuted)
            Text(value)
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(FinancialColors.textPrimary)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(meta)
                .font(.caption2)
                .foregroundStyle(FinancialColors.textMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(FinancialColors.bgSecondary)
        .overlay(alignment: .leading) {
            Rectangle().fill(accent).frame(width: 3)
        }
    }
}
