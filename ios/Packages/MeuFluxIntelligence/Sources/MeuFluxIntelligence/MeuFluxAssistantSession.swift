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
        let q = question.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))

        if matches(q, ["semana", "7 dias", "sete dias", "recap"]) {
            var text = "Nos últimos 7 dias você gastou \(snapshot.weeklySpendLabel)."
            let sign = snapshot.weeklyDeltaPct > 0 ? "+" : ""
            text += " Isso é \(sign)\(Int(snapshot.weeklyDeltaPct.rounded()))% vs a semana anterior."
            if let top = snapshot.weeklyTopCategory {
                text += " Maior categoria: \(top)."
            }
            return text
        }
        if matches(q, ["saldo", "conta"]) {
            return "Seu saldo em contas é \(snapshot.bankBalanceLabel). Patrimônio líquido: \(snapshot.netWorthLabel)."
        }
        if matches(q, ["fatura", "cartao", "cartão", "bill"]) {
            let n = snapshot.creditCount
            return "Há \(n) cartão(ões) com fatura aberta de \(snapshot.openBillsLabel)."
        }
        if matches(q, ["orcamento", "orçamento", "budget", "verba"]) {
            if snapshot.budgets.isEmpty {
                return "Não há categorias de orçamento no resumo deste mês."
            }
            let lines = snapshot.budgets.prefix(5).map {
                "\($0.category): \($0.spentLabel) de \($0.limitLabel) (\($0.percent)%)."
            }
            return lines.joined(separator: " ")
        }
        if matches(q, ["insight", "dica", "o que mudou"]) {
            if snapshot.insights.isEmpty {
                return "Ainda não há insights no resumo local."
            }
            return snapshot.insights.prefix(3).map(\.text).joined(separator: " ")
        }
        if let hit = snapshot.recentTransactions.first(where: { tx in
            q.contains(tx.description.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR")))
                || q.contains(tx.category.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR")))
        }) {
            let sign = hit.isCredit ? "+" : "−"
            return "\(hit.description) (\(hit.category)): \(sign)\(hit.amountLabel) · \(hit.dateRelative)."
        }
        return """
        Posso falar sobre saldo, gastos da semana, faturas abertas, orçamento e transações recentes \
        a partir do resumo salvo neste iPhone. Tente: "quanto gastei esta semana?"
        """
    }

    private static func matches(_ hay: String, _ needles: [String]) -> Bool {
        needles.contains { hay.contains($0) }
    }
}

public struct MeuFluxAssistantSession: Sendable {
    private let generator: any OnDeviceGenerating
    private let store: SiriSnapshotStore

    public init(
        generator: (any OnDeviceGenerating)? = nil,
        store: SiriSnapshotStore = SiriSnapshotStore()
    ) {
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
        self.store = store
    }

    public func reply(to question: String) async -> String {
        guard let snapshot = store.load() else {
            return "Ainda não há um resumo financeiro neste iPhone. Abra a Visão Geral uma vez para eu poder responder."
        }
        if generator.isAvailable {
            if let generated = try? await generateWithTools(question: question, snapshot: snapshot) {
                return generated
            }
        }
        return MeuFluxAssistantRouter.cannedReply(question: question, snapshot: snapshot)
    }

    private func generateWithTools(question: String, snapshot: SiriFinanceSnapshot) async throws -> String {
        let context = Self.contextBlock(snapshot)
        let instructions = """
        Você é o assistente privado do MeuFlux. Responda em português do Brasil.
        Use SOMENTE os fatos abaixo. Não invente números. Se a pergunta sair do resumo, diga que não tem esse dado.
        \(context)
        """
        return try await generator.generateText(instructions: instructions, prompt: question)
    }

    public static func contextBlock(_ snapshot: SiriFinanceSnapshot) -> String {
        var lines: [String] = [
            "Saldo em contas: \(snapshot.bankBalanceLabel)",
            "Patrimônio: \(snapshot.netWorthLabel)",
            "Gastos 7 dias: \(snapshot.weeklySpendLabel) (Δ \(Int(snapshot.weeklyDeltaPct.rounded()))%)",
            "Faturas abertas: \(snapshot.openBillsLabel) em \(snapshot.creditCount) cartão(ões)",
        ]
        if let top = snapshot.weeklyTopCategory {
            lines.append("Top categoria da semana: \(top)")
        }
        if !snapshot.insights.isEmpty {
            lines.append("Insights:")
            lines.append(contentsOf: snapshot.insights.prefix(4).map { "- \($0.text)" })
        }
        if !snapshot.budgets.isEmpty {
            lines.append("Orçamento:")
            lines.append(contentsOf: snapshot.budgets.prefix(8).map {
                "- \($0.category): \($0.spentLabel)/\($0.limitLabel) (\($0.percent)%)"
            })
        }
        if !snapshot.recentTransactions.isEmpty {
            lines.append("Transações recentes:")
            lines.append(contentsOf: snapshot.recentTransactions.prefix(12).map {
                let sign = $0.isCredit ? "+" : "−"
                return "- \($0.description) [\($0.category)] \(sign)\($0.amountLabel) (\($0.dateRelative))"
            })
        }
        return lines.joined(separator: "\n")
    }
}
