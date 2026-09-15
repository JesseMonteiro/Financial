import Foundation
import MeuFluxDomain

#if canImport(FoundationModels)
import FoundationModels
#endif

public enum AppleIntelligenceAvailability: Sendable {
    public static var isAvailable: Bool {
        #if canImport(FoundationModels)
        SystemLanguageModel.default.availability == .available
        #else
        false
        #endif
    }

    public static var unavailableReason: String? {
        #if canImport(FoundationModels)
        switch SystemLanguageModel.default.availability {
        case .available:
            return nil
        case .unavailable(let reason):
            return String(describing: reason)
        @unknown default:
            return "Apple Intelligence indisponível."
        }
        #else
        return "Foundation Models não está neste SDK."
        #endif
    }
}

public protocol OnDeviceGenerating: Sendable {
    var isAvailable: Bool { get }
    func generateText(instructions: String, prompt: String) async throws -> String
    func generateCategory(prompt: String) async throws -> ExpenseCategoryKind?
    func generateParsedFields(prompt: String) async throws -> OnDeviceParsedFields?
}

public struct OnDeviceParsedFields: Sendable {
    public var amount: Decimal?
    public var merchant: String?
    public var isoDate: String?

    public init(amount: Decimal?, merchant: String?, isoDate: String?) {
        self.amount = amount
        self.merchant = merchant
        self.isoDate = isoDate
    }
}

public struct UnavailableOnDeviceGenerator: OnDeviceGenerating {
    public init() {}
    public var isAvailable: Bool { false }
    public func generateText(instructions: String, prompt: String) async throws -> String {
        _ = instructions
        _ = prompt
        throw OnDeviceGenerationError.unavailable
    }
    public func generateCategory(prompt: String) async throws -> ExpenseCategoryKind? {
        _ = prompt
        return nil
    }
    public func generateParsedFields(prompt: String) async throws -> OnDeviceParsedFields? {
        _ = prompt
        return nil
    }
}

public enum OnDeviceGenerationError: Error {
    case unavailable
}

#if canImport(FoundationModels)
@Generable
struct GenerableCategoryChoice {
    @Guide(description: "One of: Food, Groceries, Rent, Utilities, Transport, Entertainment, Health, Education, Other")
    var category: String
}

@Generable
struct GenerableParsedPurchase {
    var amount: String
    var merchant: String
    var isoDate: String
}

public struct FoundationOnDeviceGenerator: OnDeviceGenerating {
    public init() {}

    public var isAvailable: Bool { AppleIntelligenceAvailability.isAvailable }

    public func generateText(instructions: String, prompt: String) async throws -> String {
        guard isAvailable else { throw OnDeviceGenerationError.unavailable }
        let session = LanguageModelSession(instructions: instructions)
        let response = try await session.respond(to: prompt)
        return response.content
    }

    public func generateCategory(prompt: String) async throws -> ExpenseCategoryKind? {
        guard isAvailable else { return nil }
        let session = LanguageModelSession(
            instructions: """
            Você classifica compras brasileiras em exatamente uma categoria.
            Responda só com o identificador inglês: Food, Groceries, Rent, Utilities, Transport, Entertainment, Health, Education, Other.
            """
        )
        let response = try await session.respond(to: prompt, generating: GenerableCategoryChoice.self)
        return ExpenseCategoryKind(rawValue: response.content.category)
            ?? ExpenseCategoryKind.fromStorage(response.content.category)
    }

    public func generateParsedFields(prompt: String) async throws -> OnDeviceParsedFields? {
        guard isAvailable else { return nil }
        let session = LanguageModelSession(
            instructions: """
            Extraia valor em reais, estabelecimento e data ISO (YYYY-MM-DD) de um texto de notificação de compra.
            Se um campo não existir, deixe vazio. Não invente valores.
            """
        )
        let response = try await session.respond(to: prompt, generating: GenerableParsedPurchase.self)
        let content = response.content
        let amount = Self.parseAmount(content.amount)
        let merchant = content.merchant.trimmingCharacters(in: .whitespacesAndNewlines)
        let iso = content.isoDate.trimmingCharacters(in: .whitespacesAndNewlines)
        return OnDeviceParsedFields(
            amount: amount,
            merchant: merchant.isEmpty ? nil : merchant,
            isoDate: iso.isEmpty ? nil : iso
        )
    }

    private static func parseAmount(_ raw: String) -> Decimal? {
        let cleaned = raw
            .replacingOccurrences(of: "R$", with: "")
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return Decimal(string: cleaned)
    }
}
#endif

public enum OnDeviceGeneratorFactory {
    public static func make() -> any OnDeviceGenerating {
        #if canImport(FoundationModels)
        FoundationOnDeviceGenerator()
        #else
        UnavailableOnDeviceGenerator()
        #endif
    }
}
