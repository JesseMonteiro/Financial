import Foundation
import MeuFluxCore

public struct AssistantChatMessage: Identifiable, Sendable, Hashable {
    public enum Role: String, Sendable {
        case user
        case assistant
    }

    public var id: UUID
    public var role: Role
    public var text: String

    public init(id: UUID = UUID(), role: Role, text: String) {
        self.id = id
        self.role = role
        self.text = text
    }

    public static func user(_ text: String) -> AssistantChatMessage {
        AssistantChatMessage(role: .user, text: text)
    }

    public static func assistant(_ text: String) -> AssistantChatMessage {
        AssistantChatMessage(role: .assistant, text: text)
    }
}

public enum MeuFluxAssistantRouter {
    public static func cannedReply(question: String, snapshot: SiriFinanceSnapshot) -> String {
        let q = AssistantFacts.fold(question)

        if isCardSpendQuestion(q) {
            return snapshot.cardSpendDialog
        }
        if matches(q, ["semana", "7 dias", "sete dias", "recap"]) {
            return snapshot.weeklySpendDialog
        }
        if isCategoryQuestion(q) {
            return snapshot.categorySpendDialog
        }
        if matches(q, ["saldo"]) || (matches(q, ["conta"]) && !isCardQuestion(q)) {
            return snapshot.balanceDialog
        }
        if isCardQuestion(q) || matches(q, ["fatura", "bill"]) {
            return snapshot.openBillsDialog
        }
        if matches(q, ["orcamento", "orçamento", "budget", "verba"]) {
            return snapshot.budgetDialog
        }
        if matches(q, ["insight", "dica", "o que mudou"]) {
            return snapshot.insightsDialog
        }
        if let hit = snapshot.recentTransactions.first(where: { tx in
            q.contains(AssistantFacts.fold(tx.description))
                || q.contains(AssistantFacts.fold(tx.category))
        }) {
            let sign = hit.isCredit ? "+" : "−"
            return "\(hit.description) (\(hit.category)): \(sign)\(hit.amountLabel) · \(hit.dateRelative)."
        }
        return """
        Posso falar sobre saldo, cartões, categorias do mês, gastos da semana, faturas, orçamento e transações recentes \
        a partir do resumo salvo neste iPhone. Tente: "qual cartão tem mais gastos?"
        """
    }

    public static func isCardSpendQuestion(_ question: String) -> Bool {
        let q = AssistantFacts.fold(question)
        guard isCardQuestion(q) else { return false }
        return matches(q, ["gasto", "gastei", "gastos", "mais", "maior"])
    }

    private static func isCardQuestion(_ q: String) -> Bool {
        matches(q, ["cartao", "cartão"])
    }

    private static func isCategoryQuestion(_ q: String) -> Bool {
        matches(q, ["categoria", "onde gastei", "gastos do mes", "gastos do mês"])
    }

    private static func matches(_ hay: String, _ needles: [String]) -> Bool {
        needles.contains { hay.contains(AssistantFacts.fold($0)) }
    }
}

public final class MeuFluxAssistantSession: @unchecked Sendable {
    private let generator: any OnDeviceGenerating
    private let box: AssistantSnapshotBox
    private var chat: (any OnDeviceChatConversing)?

    public init(
        generator: (any OnDeviceGenerating)? = nil,
        provider: (any AssistantFinanceProviding)? = nil
    ) {
        let resolved = provider ?? SnapshotAssistantFinanceProvider()
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
        self.box = AssistantSnapshotBox(provider: resolved)
    }

    public convenience init(
        generator: (any OnDeviceGenerating)? = nil,
        store: SiriSnapshotStore
    ) {
        self.init(generator: generator, provider: SnapshotAssistantFinanceProvider(store: store))
    }

    public func reply(to question: String) async -> String {
        await box.refresh()
        guard let snapshot = await box.current() else {
            return "Ainda não há um resumo financeiro neste iPhone. Abra a Visão Geral uma vez para eu poder responder."
        }
        if generator.isAvailable {
            if chat == nil {
                chat = generator.makeChat(instructions: Self.instructions, box: box)
            }
            if let session = chat, let generated = try? await session.respond(to: question) {
                let trimmed = generated.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    return trimmed
                }
            }
        }
        return MeuFluxAssistantRouter.cannedReply(question: question, snapshot: snapshot)
    }

    private static let instructions = """
    Você é o assistente privado do MeuFlux. Responda em português do Brasil, curto e direto.
    Use as tools para buscar fatos: overview, cards, accounts, categories, budgets, recent_transactions.
    Use SOMENTE o que as tools devolverem. Não invente números.
    Se uma tool disser que falta dado, peça para abrir a tela correspondente uma vez (Início, Cartões ou Contas).
    """
}
