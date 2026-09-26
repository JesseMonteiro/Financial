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

public protocol OnDeviceChatConversing: AnyObject, Sendable {
    func respond(to prompt: String) async throws -> String
}

public protocol OnDeviceGenerating: Sendable {
    var isAvailable: Bool { get }
    func generateText(instructions: String, prompt: String) async throws -> String
    func generateCategory(prompt: String) async throws -> ExpenseCategoryKind?
    func generateParsedFields(prompt: String) async throws -> OnDeviceParsedFields?
    func makeChat(instructions: String, box: AssistantSnapshotBox) -> (any OnDeviceChatConversing)?
}

public extension OnDeviceGenerating {
    func makeChat(instructions: String, box: AssistantSnapshotBox) -> (any OnDeviceChatConversing)? {
        _ = instructions
        _ = box
        return nil
    }
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

    public func makeChat(instructions: String, box: AssistantSnapshotBox) -> (any OnDeviceChatConversing)? {
        _ = instructions
        _ = box
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

@Generable
struct AssistantToolFilter {
    @Guide(description: "Optional name filter for a card, account, category or merchant. Empty to list all.")
    var filter: String?
}

struct AssistantOverviewTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "overview" }
    var description: String {
        "Resumo financeiro do MeuFlux: saldo, patrimônio, receita, despesa, gastos da semana e total de faturas."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        _ = arguments
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.overview(snapshot)
    }
}

struct AssistantCardsTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "cards" }
    var description: String {
        "Lista cartões de crédito com fatura aberta e outstanding. Use para saber qual cartão tem mais gastos."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.cards(snapshot, filter: arguments.filter ?? "")
    }
}

struct AssistantAccountsTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "accounts" }
    var description: String {
        "Lista contas bancárias e saldos no MeuFlux (não a Carteira da Apple)."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.accounts(snapshot, filter: arguments.filter ?? "")
    }
}

struct AssistantCategoriesTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "categories" }
    var description: String {
        "Gastos do mês por categoria. Use para perguntas como onde gastei mais."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.categories(snapshot, filter: arguments.filter ?? "")
    }
}

struct AssistantBudgetsTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "budgets" }
    var description: String {
        "Uso das verbas/orçamento do mês."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.budgets(snapshot, filter: arguments.filter ?? "")
    }
}

struct AssistantTransactionsTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "recent_transactions" }
    var description: String {
        "Transações recentes do resumo local, com descrição, categoria e valor."
    }

    func call(arguments: AssistantToolFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.recentTransactions(snapshot, filter: arguments.filter ?? "")
    }
}

@Generable
struct AssistantCreditPurchasesFilter {
    @Guide(description: "Filtro opcional por nome do cartão (ex: amazon, nubank, itau). Deixe vazio para todos.")
    var cardName: String?

    @Guide(description: "Filtro opcional por mês (ex: outubro, 10, 2026-10). Deixe vazio para qualquer mês.")
    var month: String?

    @Guide(description: "Tipo de parcelamento: 'non_installment' para compras não parceladas (à vista), 'installment' para compras parceladas, ou 'all' para todas.")
    var installmentType: String?
}

struct AssistantCreditPurchasesTool: Tool {
    let box: AssistantSnapshotBox
    var name: String { "credit_card_purchases" }
    var description: String {
        "Consulta compras de cartão de crédito no MeuFlux por cartão (ex: amazon), mês (ex: outubro) e se é compra não parcelada (à vista) ou parcelada."
    }

    func call(arguments: AssistantCreditPurchasesFilter) async throws -> String {
        guard let snapshot = await box.current() else { return "Sem resumo local." }
        return AssistantFacts.creditPurchases(
            snapshot,
            cardName: arguments.cardName ?? "",
            month: arguments.month ?? "",
            installmentType: arguments.installmentType ?? "all"
        )
    }
}

final class FoundationChatSession: OnDeviceChatConversing, @unchecked Sendable {
    private let session: LanguageModelSession

    init(instructions: String, box: AssistantSnapshotBox) {
        self.session = LanguageModelSession(
            tools: [
                AssistantOverviewTool(box: box),
                AssistantCardsTool(box: box),
                AssistantAccountsTool(box: box),
                AssistantCategoriesTool(box: box),
                AssistantBudgetsTool(box: box),
                AssistantTransactionsTool(box: box),
                AssistantCreditPurchasesTool(box: box),
            ],
            instructions: instructions
        )
    }

    func respond(to prompt: String) async throws -> String {
        let response = try await session.respond(to: prompt)
        return response.content
    }
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

    public func makeChat(instructions: String, box: AssistantSnapshotBox) -> (any OnDeviceChatConversing)? {
        guard isAvailable else { return nil }
        return FoundationChatSession(instructions: instructions, box: box)
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
