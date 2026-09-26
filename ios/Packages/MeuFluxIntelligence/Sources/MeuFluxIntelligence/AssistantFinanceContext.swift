import Foundation
import MeuFluxCore

public protocol AssistantFinanceProviding: Sendable {
    func currentSnapshot() async -> SiriFinanceSnapshot?
}

public struct SnapshotAssistantFinanceProvider: AssistantFinanceProviding {
    private let store: SiriSnapshotStore

    public init(store: SiriSnapshotStore = SiriSnapshotStore()) {
        self.store = store
    }

    public func currentSnapshot() async -> SiriFinanceSnapshot? {
        store.load()
    }
}

public actor AssistantSnapshotBox {
    private var snapshot: SiriFinanceSnapshot?
    private let provider: any AssistantFinanceProviding

    public init(provider: any AssistantFinanceProviding) {
        self.provider = provider
    }

    public func refresh() async {
        snapshot = await provider.currentSnapshot()
    }

    public func current() -> SiriFinanceSnapshot? {
        snapshot
    }
}

public enum AssistantFacts {
    public static func overview(_ snapshot: SiriFinanceSnapshot) -> String {
        var lines = [
            "Saldo em contas: \(snapshot.bankBalanceLabel)",
            "Patrimônio: \(snapshot.netWorthLabel)",
            "Gastos 7 dias: \(snapshot.weeklySpendLabel) (Δ \(Int(snapshot.weeklyDeltaPct.rounded()))%)",
            "Faturas abertas: \(snapshot.openBillsLabel) em \(snapshot.creditCount) cartão(ões)",
        ]
        if let income = snapshot.incomeLabel, let expense = snapshot.expenseLabel {
            lines.append("Mês \(snapshot.monthKey): receita \(income), despesa \(expense)")
        }
        if let net = snapshot.netLabel {
            lines.append("Resultado do mês: \(net)")
        }
        if let top = snapshot.weeklyTopCategory {
            lines.append("Top categoria da semana: \(top)")
        }
        return lines.joined(separator: "\n")
    }

    public static func cards(_ snapshot: SiriFinanceSnapshot, filter: String = "") -> String {
        let items = filtered(snapshot.rankedCards, filter: filter) { card, q in
            contains(card.name, q) || contains(card.institutionName, q) || card.lastFour.contains(q)
        }
        guard !items.isEmpty else {
            if snapshot.cards.isEmpty {
                return "Ainda não há cartões no resumo. Abra Cartões uma vez."
            }
            return "Nenhum cartão corresponde a esse filtro."
        }
        return items.map {
            "\($0.name) (final \($0.lastFour)): fatura aberta \($0.openTotalLabel), outstanding \($0.outstandingLabel)"
        }.joined(separator: "\n")
    }

    public static func accounts(_ snapshot: SiriFinanceSnapshot, filter: String = "") -> String {
        let items = filtered(snapshot.accounts, filter: filter) { account, q in
            contains(account.name, q) || contains(account.kind, q) || contains(account.institutionName ?? "", q)
        }
        guard !items.isEmpty else {
            if snapshot.accounts.isEmpty {
                return "Ainda não há contas no resumo. Abra Contas uma vez."
            }
            return "Nenhuma conta corresponde a esse filtro."
        }
        return items.map {
            let bank = $0.institutionName.map { " · \($0)" } ?? ""
            return "\($0.name) (\($0.kind)\(bank)): \($0.amountLabel)"
        }.joined(separator: "\n")
    }

    public static func categories(_ snapshot: SiriFinanceSnapshot, filter: String = "") -> String {
        let items = filtered(snapshot.rankedCategories, filter: filter) { category, q in
            contains(category.name, q)
        }
        guard !items.isEmpty else {
            if snapshot.categories.isEmpty {
                return "Ainda não há gastos por categoria no resumo deste mês."
            }
            return "Nenhuma categoria corresponde a esse filtro."
        }
        return items.map { "\($0.name): \($0.amountLabel)" }.joined(separator: "\n")
    }

    public static func budgets(_ snapshot: SiriFinanceSnapshot, filter: String = "") -> String {
        let items = filtered(snapshot.budgets, filter: filter) { budget, q in
            contains(budget.category, q)
        }
        guard !items.isEmpty else {
            return "Não há categorias de orçamento no resumo deste mês."
        }
        return items.map {
            "\($0.category): \($0.spentLabel)/\($0.limitLabel) (\($0.percent)%)"
        }.joined(separator: "\n")
    }

    public static func recentTransactions(_ snapshot: SiriFinanceSnapshot, filter: String = "") -> String {
        let items = filtered(snapshot.recentTransactions, filter: filter) { tx, q in
            contains(tx.description, q) || contains(tx.category, q)
        }
        guard !items.isEmpty else {
            return "Não há transações recentes no resumo."
        }
        return items.prefix(16).map {
            let sign = $0.isCredit ? "+" : "−"
            return "\($0.description) [\($0.category)] \(sign)\($0.amountLabel) (\($0.dateRelative))"
        }.joined(separator: "\n")
    }

    public static func creditPurchases(
        _ snapshot: SiriFinanceSnapshot,
        cardName: String = "",
        month: String = "",
        installmentType: String = "all"
    ) -> String {
        var items = snapshot.creditPurchases.filter { !$0.isPayment }

        if !cardName.isEmpty {
            let q = fold(cardName)
            items = items.filter { fold($0.cardName).contains(q) }
        }

        if !month.isEmpty {
            let monthDigit = normalizeMonthQuery(month)
            items = items.filter { item in
                let matchPurchase = item.purchaseDate?.contains("-\(monthDigit)-") == true
                let matchDue = item.dueMonth.contains("-\(monthDigit)") || item.dueMonth == monthDigit || item.dueMonth.contains(monthDigit)
                return matchPurchase || matchDue
            }
        }

        let normType = fold(installmentType)
        if normType.contains("non") || normType.contains("nao") || normType.contains("vista") || normType.contains("single") {
            items = items.filter { !$0.isInstallment }
        } else if normType.contains("installment") || normType.contains("parcelad") {
            items = items.filter { $0.isInstallment }
        }

        guard !items.isEmpty else {
            if snapshot.creditPurchases.isEmpty {
                return "Ainda não há compras de cartão carregadas no resumo. Abra a tela de Cartões para sincronizar."
            }
            return "Nenhuma compra encontrada com os filtros informados (cartão: '\(cardName)', mês: '\(month)', tipo: '\(installmentType)')."
        }

        let total = items.reduce(0.0) { $0 + $1.amount }
        let totalFormatted = String(format: "R$ %.2f", total).replacingOccurrences(of: ".", with: ",")

        let lines = items.prefix(25).map { item in
            let datePart = item.purchaseDate.map { " em \($0)" } ?? ""
            let instPart = item.isInstallment ? (item.installmentLabel ?? "Parcelada") : "À vista (não parcelada)"
            return "• \(item.description): \(item.amountLabel)\(datePart) · \(item.cardName) · \(instPart)"
        }

        var header = "Encontradas \(items.count) compra(s) (Total: \(totalFormatted)):"
        if items.count > 25 {
            header += " (exibindo as 25 primeiras)"
        }
        return "\(header)\n\(lines.joined(separator: "\n"))"
    }

    public static func normalizeMonthQuery(_ text: String) -> String {
        let folded = fold(text).lowercased()
        if folded.contains("janeiro") || folded == "jan" || folded == "1" || folded == "01" { return "01" }
        if folded.contains("fevereiro") || folded == "fev" || folded == "2" || folded == "02" { return "02" }
        if folded.contains("marco") || folded.contains("março") || folded == "mar" || folded == "3" || folded == "03" { return "03" }
        if folded.contains("abril") || folded == "abr" || folded == "4" || folded == "04" { return "04" }
        if folded.contains("maio") || folded == "mai" || folded == "5" || folded == "05" { return "05" }
        if folded.contains("junho") || folded == "jun" || folded == "6" || folded == "06" { return "06" }
        if folded.contains("julho") || folded == "jul" || folded == "7" || folded == "07" { return "07" }
        if folded.contains("agosto") || folded == "ago" || folded == "8" || folded == "08" { return "08" }
        if folded.contains("setembro") || folded == "set" || folded == "9" || folded == "09" { return "09" }
        if folded.contains("outubro") || folded == "out" || folded == "10" { return "10" }
        if folded.contains("novembro") || folded == "nov" || folded == "11" { return "11" }
        if folded.contains("dezembro") || folded == "dez" || folded == "12" { return "12" }
        return folded
    }

    private static func filtered<T>(
        _ items: [T],
        filter: String,
        matches: (T, String) -> Bool
    ) -> [T] {
        let q = fold(filter)
        guard !q.isEmpty else { return items }
        return items.filter { matches($0, q) }
    }

    private static func contains(_ value: String, _ query: String) -> Bool {
        fold(value).contains(query)
    }

    public static func fold(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
