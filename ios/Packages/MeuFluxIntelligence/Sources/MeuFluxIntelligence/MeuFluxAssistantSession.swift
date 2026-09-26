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

public protocol RemoteChatbotProviding: Sendable {
    func reply(message: String, history: [AssistantChatMessage], snapshot: SiriFinanceSnapshot) async throws -> String
}

public enum MeuFluxAssistantRouter {
    public static func cannedReply(question: String, snapshot: SiriFinanceSnapshot) -> String {
        let q = AssistantFacts.fold(question)

        if isCardSpendQuestion(q) {
            return snapshot.cardSpendDialog
        }
        if isCreditPurchaseQuestion(q) {
            let card = extractCardFilter(q, snapshot: snapshot)
            let month = extractMonthFilter(q)
            let instType = extractInstallmentType(q)
            return AssistantFacts.creditPurchases(snapshot, cardName: card, month: month, installmentType: instType)
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
        Posso falar sobre saldo, cartões, compras à vista ou parceladas por mês, categorias, gastos da semana, faturas e orçamento \
        a partir do resumo salvo neste iPhone. Tente: "quais as compras não parceladas no mês de outubro no meu cartão amazon?"
        """
    }

    public static func isCreditPurchaseQuestion(_ q: String) -> Bool {
        let hasPurchaseWord = matches(q, ["compra", "compras", "lancamento", "lançamento", "gasto", "gastos", "comprei"])
        let hasCardIndicator = matches(q, ["cartao", "cartão", "amazon", "nubank", "inter", "itau", "bradesco", "santander"])
        let hasInstallmentIndicator = matches(q, ["parcelad", "a vista", "à vista", "nao parcelad", "não parcelad", "sem parcela"])
        let hasMonth = !extractMonthFilter(q).isEmpty

        return (hasPurchaseWord && (hasCardIndicator || hasInstallmentIndicator || hasMonth))
            || (hasCardIndicator && (hasInstallmentIndicator || hasMonth))
    }

    public static func extractCardFilter(_ q: String, snapshot: SiriFinanceSnapshot) -> String {
        for card in snapshot.cards {
            if AssistantFacts.matchesCard(itemCardName: card.name, query: q) { return card.name }
            let foldInst = AssistantFacts.fold(card.institutionName)
            if !foldInst.isEmpty && q.contains(foldInst) { return card.name }
        }
        for item in snapshot.creditPurchases {
            if AssistantFacts.matchesCard(itemCardName: item.cardName, query: q) { return item.cardName }
        }
        let known = ["amazon", "nubank", "inter", "itau", "bradesco", "santander", "c6", "neon"]
        for kw in known {
            if q.contains(kw) { return kw }
        }
        return ""
    }

    public static func extractMonthFilter(_ q: String) -> String {
        if let parsed = AssistantFacts.parseMonthQuery(q) {
            return parsed.monthString2Digits
        }
        return ""
    }

    public static func extractInstallmentType(_ q: String) -> String {
        if matches(q, ["nao parcelad", "não parcelad", "a vista", "à vista", "sem parcela"]) {
            return "non_installment"
        }
        if matches(q, ["parcelad", "parcela", "parcelas", "em vezes"]) {
            return "installment"
        }
        return "all"
    }

    public static func isCardSpendQuestion(_ question: String) -> Bool {
        let q = AssistantFacts.fold(question)
        guard isCardQuestion(q) else { return false }
        if extractInstallmentType(q) != "all" || !extractMonthFilter(q).isEmpty {
            return false
        }
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
    private let remoteProvider: (any RemoteChatbotProviding)?
    private let box: AssistantSnapshotBox
    private var chat: (any OnDeviceChatConversing)?
    private var history: [AssistantChatMessage] = []

    public init(
        generator: (any OnDeviceGenerating)? = nil,
        provider: (any AssistantFinanceProviding)? = nil,
        remoteProvider: (any RemoteChatbotProviding)? = nil
    ) {
        let resolved = provider ?? SnapshotAssistantFinanceProvider()
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
        self.remoteProvider = remoteProvider
        self.box = AssistantSnapshotBox(provider: resolved)
    }

    public convenience init(
        generator: (any OnDeviceGenerating)? = nil,
        store: SiriSnapshotStore,
        remoteProvider: (any RemoteChatbotProviding)? = nil
    ) {
        self.init(
            generator: generator,
            provider: SnapshotAssistantFinanceProvider(store: store),
            remoteProvider: remoteProvider
        )
    }

    public func reply(to question: String) async -> String {
        await box.refresh()
        guard let snapshot = await box.current() else {
            return "Ainda não há um resumo financeiro neste iPhone. Abra a Visão Geral uma vez para eu poder responder."
        }

        // 1. Apple Intelligence nativo no aparelho se disponível
        if generator.isAvailable {
            if chat == nil {
                chat = generator.makeChat(instructions: Self.instructions, box: box)
            }
            if let session = chat, let generated = try? await session.respond(to: question) {
                let trimmed = generated.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    history.append(.user(question))
                    history.append(.assistant(trimmed))
                    return trimmed
                }
            }
        }

        // 2. Fallback para Gemini em nuvem segura para iPhones antigos
        if let remote = remoteProvider {
            do {
                let reply = try await remote.reply(message: question, history: history, snapshot: snapshot)
                let trimmed = reply.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    history.append(.user(question))
                    history.append(.assistant(trimmed))
                    return trimmed
                }
            } catch {
                // Fallback silencioso para o router estruturado local
            }
        }

        // 3. Fallback estruturado local (offline e sem dependências)
        let reply = MeuFluxAssistantRouter.cannedReply(question: question, snapshot: snapshot)
        history.append(.user(question))
        history.append(.assistant(reply))
        return reply
    }

    private static let instructions = """
    Você é o assistente privado do MeuFlux. Responda em português do Brasil, curto e direto.
    Use as tools para buscar fatos: overview, cards, accounts, categories, budgets, recent_transactions, credit_card_purchases.
    Para compras de cartão, compras à vista ou parceladas e por mês, utilize credit_card_purchases.
    Ao chamar credit_card_purchases, passe no cardName apenas o nome ou marca do cartão (ex: amazon, nubank, itau), sem a palavra "cartão".
    Use SOMENTE o que as tools devolverem. Não invente números.
    Se a tool credit_card_purchases listar compras, cite cada uma delas com o valor, data e o total.
    Se uma tool disser que falta dado, peça para abrir a tela correspondente uma vez (Início, Cartões ou Contas).
    """
}
