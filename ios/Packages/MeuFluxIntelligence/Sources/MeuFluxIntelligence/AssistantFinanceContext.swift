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
            matchesCard(itemCardName: card.name, query: q) || contains(card.institutionName, q) || card.lastFour.contains(q)
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

    public struct ParsedMonthFilter: Equatable, Sendable {
        public let month: Int
        public let year: Int?

        public init(month: Int, year: Int? = nil) {
            self.month = month
            self.year = year
        }

        public var monthString2Digits: String {
            String(format: "%02d", month)
        }

        public func matches(purchaseDate: String?, dueMonth: String) -> Bool {
            let mStr = monthString2Digits

            let matchDue: Bool
            if let year {
                let yStr = String(year)
                matchDue = dueMonth == "\(yStr)-\(mStr)" ||
                           (dueMonth.contains(yStr) && (dueMonth.hasSuffix("-\(mStr)") || dueMonth.contains("-\(mStr)-") || dueMonth.contains("/\(mStr)")))
            } else {
                matchDue = dueMonth.hasSuffix("-\(mStr)") ||
                           dueMonth.contains("-\(mStr)-") ||
                           dueMonth == mStr ||
                           dueMonth.contains("/\(mStr)")
            }

            var matchPurchase = false
            if let date = purchaseDate, !date.isEmpty {
                if let year {
                    let yStr = String(year)
                    matchPurchase = date.starts(with: "\(yStr)-\(mStr)-") ||
                                    date.contains("\(yStr)-\(mStr)") ||
                                    date.contains("/\(mStr)/\(yStr)")
                } else {
                    matchPurchase = date.contains("-\(mStr)-") ||
                                    date.contains("/\(mStr)/") ||
                                    date.starts(with: "\(mStr)-")
                }
            }

            return matchDue || matchPurchase
        }
    }

    public static func cleanCardQuery(_ text: String) -> String {
        var folded = fold(text).lowercased()
        let stopWords = [
            "cartao de credito", "cartao de debito",
            "cartao", "credito", "debito",
            "meu", "minha", "meus", "minhas",
            "no", "na", "nos", "nas",
            "do", "da", "dos", "das",
            "de", "em"
        ]
        for stop in stopWords {
            if let regex = try? NSRegularExpression(pattern: "\\b\(stop)\\b", options: .caseInsensitive) {
                folded = regex.stringByReplacingMatches(
                    in: folded,
                    options: [],
                    range: NSRange(location: 0, length: folded.utf16.count),
                    withTemplate: " "
                )
            }
        }
        let cleaned = folded.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? fold(text).lowercased() : cleaned
    }

    public static func matchesCard(itemCardName: String, query: String) -> Bool {
        let cleanQuery = cleanCardQuery(query)
        if cleanQuery.isEmpty { return true }

        let itemFolded = fold(itemCardName).lowercased()
        if itemFolded.contains(cleanQuery) || cleanQuery.contains(itemFolded) {
            return true
        }

        let tokens = cleanQuery.split(separator: " ").map(String.init).filter { $0.count >= 3 }
        if !tokens.isEmpty && tokens.contains(where: { itemFolded.contains($0) }) {
            return true
        }

        return false
    }

    public static func parseMonthQuery(_ text: String) -> ParsedMonthFilter? {
        let folded = fold(text).lowercased()
        guard !folded.isEmpty else { return nil }

        var extractedYear: Int? = nil
        if let yearMatch = folded.range(of: #"\b(20\d\d)\b"#, options: .regularExpression) {
            extractedYear = Int(folded[yearMatch])
        }

        let monthNames: [(names: [String], month: Int)] = [
            (["janeiro", "jan"], 1),
            (["fevereiro", "fev"], 2),
            (["marco", "março", "mar"], 3),
            (["abril", "abr"], 4),
            (["maio", "mai"], 5),
            (["junho", "jun"], 6),
            (["julho", "jul"], 7),
            (["agosto", "ago"], 8),
            (["setembro", "set"], 9),
            (["outubro", "out"], 10),
            (["novembro", "nov"], 11),
            (["dezembro", "dez"], 12)
        ]

        // 1. Slash and dash date formats: YYYY-MM or YYYY/MM
        if let match = folded.range(of: #"\b(20\d\d)[-/](0?[1-9]|1[0-2])\b"#, options: .regularExpression) {
            let matched = String(folded[match])
            let parts = matched.split(whereSeparator: { $0 == "-" || $0 == "/" })
            if parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]) {
                return ParsedMonthFilter(month: m, year: y)
            }
        }

        // 2. Slash and dash date formats: MM/YYYY or MM-YYYY
        if let match = folded.range(of: #"\b(0?[1-9]|1[0-2])[-/](20\d\d)\b"#, options: .regularExpression) {
            let matched = String(folded[match])
            let parts = matched.split(whereSeparator: { $0 == "-" || $0 == "/" })
            if parts.count == 2, let m = Int(parts[0]), let y = Int(parts[1]) {
                return ParsedMonthFilter(month: m, year: y)
            }
        }

        // 3. Explicit "mes MM" or "mês MM"
        if let match = folded.range(of: #"\bmes\s+(0?[1-9]|1[0-2])\b"#, options: .regularExpression) {
            let matched = String(folded[match])
            let parts = matched.split(separator: " ")
            if parts.count >= 2, let m = Int(parts.last!) {
                return ParsedMonthFilter(month: m, year: extractedYear)
            }
        }

        // 4. Standalone number representing month only (e.g. "10", "5")
        if let match = folded.range(of: #"^\s*(0?[1-9]|1[0-2])\s*$"#, options: .regularExpression) {
            let trimmed = folded.trimmingCharacters(in: .whitespaces)
            if let m = Int(trimmed) {
                return ParsedMonthFilter(month: m, year: extractedYear)
            }
        }

        // 5. Textual month names with strict word boundary matching
        for entry in monthNames {
            for name in entry.names {
                let foldedName = fold(name).lowercased()
                let pattern = #"(^|\b)"# + NSRegularExpression.escapedPattern(for: foldedName) + #"(\b|$)"#
                if folded.range(of: pattern, options: .regularExpression) != nil {
                    return ParsedMonthFilter(month: entry.month, year: extractedYear)
                }
            }
        }

        return nil
    }

    public static func creditPurchases(
        _ snapshot: SiriFinanceSnapshot,
        cardName: String = "",
        month: String = "",
        installmentType: String = "all"
    ) -> String {
        var items = snapshot.creditPurchases.filter { !$0.isPayment }

        if !cardName.isEmpty {
            items = items.filter { matchesCard(itemCardName: $0.cardName, query: cardName) }
        }

        if !month.isEmpty {
            if let monthFilter = parseMonthQuery(month) {
                items = items.filter { monthFilter.matches(purchaseDate: $0.purchaseDate, dueMonth: $0.dueMonth) }
            } else {
                let monthDigit = normalizeMonthQuery(month)
                items = items.filter { item in
                    let matchPurchase = item.purchaseDate?.contains("-\(monthDigit)-") == true
                    let matchDue = item.dueMonth.contains("-\(monthDigit)") || item.dueMonth == monthDigit || item.dueMonth.contains(monthDigit)
                    return matchPurchase || matchDue
                }
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
            let availableCards = Set(snapshot.creditPurchases.map(\.cardName)).sorted().joined(separator: ", ")
            return "Nenhuma compra encontrada com os filtros informados (cartão: '\(cardName)', mês: '\(month)', tipo: '\(installmentType)'). Cartões com compras disponíveis no resumo: \(availableCards.isEmpty ? "nenhum" : availableCards)."
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
        if let parsed = parseMonthQuery(text) {
            return parsed.monthString2Digits
        }
        return fold(text).lowercased()
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
