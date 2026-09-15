import Foundation
import MeuFluxDomain

public struct PurchaseCategorizer: PurchaseCategorizing {
    private let generator: any OnDeviceGenerating
    private let fallback: RuleBasedPurchaseCategorizer

    public init(generator: (any OnDeviceGenerating)? = nil) {
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
        self.fallback = RuleBasedPurchaseCategorizer()
    }

    public func suggest(
        merchant: String?,
        source: NotificationImportSource,
        combinedText: String
    ) async -> PurchaseCategorySuggestion {
        let normalized = MerchantNormalizer.normalize(merchant)
        if generator.isAvailable {
            let prompt = """
            Estabelecimento: \(normalized ?? "(desconhecido)")
            Origem: \(source.displayName)
            Texto: \(combinedText)
            """
            if let kind = try? await generator.generateCategory(prompt: prompt) {
                return PurchaseCategorySuggestion(kind: kind, merchant: normalized, usedOnDeviceModel: true)
            }
        }
        return await fallback.suggest(merchant: normalized ?? merchant, source: source, combinedText: combinedText)
    }
}

public struct NotificationParseAssistant: PurchaseParsingAssisting {
    private let generator: any OnDeviceGenerating

    public init(generator: (any OnDeviceGenerating)? = nil) {
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
    }

    public func recoverPurchase(
        title: String,
        subtitle: String,
        body: String,
        sourceApp: String,
        now: Date
    ) async -> ParsedPurchase? {
        guard generator.isAvailable else { return nil }
        let prompt = """
        Título: \(title)
        Subtítulo: \(subtitle)
        Corpo: \(body)
        App: \(sourceApp)
        Hoje: \(InstantDate(from: now).isoString)
        """
        guard let fields = try? await generator.generateParsedFields(prompt: prompt),
              let amount = fields.amount, amount > 0 else {
            return nil
        }
        let source = NotificationImportSource.matching(appName: sourceApp)
        let merchant = MerchantNormalizer.normalize(fields.merchant)
        let purchasedAt: InstantDate
        if let iso = fields.isoDate, let parsed = InstantDate(isoString: iso) {
            purchasedAt = parsed
        } else {
            purchasedAt = InstantDate(from: now)
        }
        return ParsedPurchase(
            amount: Money(amount: amount),
            merchant: merchant,
            purchasedAt: purchasedAt,
            rawTitle: title,
            rawSubtitle: subtitle,
            rawBody: body,
            source: source,
            sourceAppName: sourceApp,
            confidence: 0.5
        )
    }
}
