import Foundation
import MeuFluxCore
import MeuFluxDomain

public struct NarratedInsights: Sendable {
    public var items: [DashboardInsight]
    public var usedOnDeviceModel: Bool

    public init(items: [DashboardInsight], usedOnDeviceModel: Bool) {
        self.items = items
        self.usedOnDeviceModel = usedOnDeviceModel
    }
}

public struct InsightNarrator: Sendable {
    private let generator: any OnDeviceGenerating

    public init(generator: (any OnDeviceGenerating)? = nil) {
        self.generator = generator ?? OnDeviceGeneratorFactory.make()
    }

    public func narrate(_ snapshot: DashboardSnapshot) async -> NarratedInsights {
        var items = snapshot.insights
        items.append(contentsOf: Self.budgetPressureInsights(from: snapshot))
        guard generator.isAvailable, !items.isEmpty else {
            return NarratedInsights(items: items, usedOnDeviceModel: false)
        }

        let facts = Self.factTokens(from: snapshot, insights: items)
        let prompt = items.enumerated().map { index, insight in
            "\(index + 1). (\(insight.type)) \(insight.text)"
        }.joined(separator: "\n")

        let instructions = """
        Reescreva cada insight financeiro em português do Brasil, tom de coach, uma frase por linha numerada.
        NÃO invente números. Cada linha DEVE repetir os valores monetários e percentuais originais (ex.: R$ 1.234,56 ou 20%).
        Não adicione linhas extras.
        """

        guard let raw = try? await generator.generateText(instructions: instructions, prompt: prompt) else {
            return NarratedInsights(items: items, usedOnDeviceModel: false)
        }

        let lines = Self.parseNumberedLines(raw, expected: items.count)
        guard lines.count == items.count else {
            return NarratedInsights(items: items, usedOnDeviceModel: false)
        }

        var rewritten: [DashboardInsight] = []
        rewritten.reserveCapacity(items.count)
        for (item, line) in zip(items, lines) {
            if Self.containsRequiredFacts(line, original: item.text, allFacts: facts) {
                rewritten.append(
                    DashboardInsight(id: item.id, type: item.type, text: line, generatedOnDevice: true)
                )
            } else {
                rewritten.append(item)
            }
        }
        return NarratedInsights(items: rewritten, usedOnDeviceModel: rewritten.contains(where: \.generatedOnDevice))
    }

    public static func budgetPressureInsights(from snapshot: DashboardSnapshot) -> [DashboardInsight] {
        snapshot.budgetCategories
            .filter { $0.percent >= 90 }
            .prefix(1)
            .map { budget in
                DashboardInsight(
                    id: "budget-pressure-\(budget.category)",
                    type: "warning",
                    text: "Você já usou \(budget.percent)% da verba de \(budget.category) (\(budget.spent.formatted()) de \(budget.limit.formatted())).",
                    generatedOnDevice: false
                )
            }
    }

    public static func containsRequiredFacts(_ candidate: String, original: String, allFacts: [String]) -> Bool {
        let originalFacts = allFacts.filter { original.contains($0) }
        if originalFacts.isEmpty { return true }
        return originalFacts.allSatisfy { candidate.contains($0) }
    }

    public static func factTokens(from snapshot: DashboardSnapshot, insights: [DashboardInsight]) -> [String] {
        var tokens: [String] = []
        tokens.append(snapshot.weeklyRecap.total.formatted())
        tokens.append(snapshot.cashflow.expense.formatted())
        tokens.append(snapshot.summary.bankBalance.formatted())
        tokens.append(contentsOf: insights.flatMap { extractNumericTokens(from: $0.text) })
        tokens.append(contentsOf: snapshot.budgetCategories.flatMap {
            [$0.spent.formatted(), $0.limit.formatted(), "\($0.percent)%"]
        })
        return Array(Set(tokens.filter { !$0.isEmpty }))
    }

    public static func extractNumericTokens(from text: String) -> [String] {
        var tokens: [String] = []
        if let regex = try? NSRegularExpression(pattern: #"R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?"#) {
            let ns = text as NSString
            let range = NSRange(location: 0, length: ns.length)
            for match in regex.matches(in: text, options: [], range: range) {
                tokens.append(ns.substring(with: match.range))
            }
        }
        if let regex = try? NSRegularExpression(pattern: #"-?\d+(?:[.,]\d+)?%"#) {
            let ns = text as NSString
            let range = NSRange(location: 0, length: ns.length)
            for match in regex.matches(in: text, options: [], range: range) {
                tokens.append(ns.substring(with: match.range))
            }
        }
        return tokens
    }

    public static func parseNumberedLines(_ raw: String, expected: Int) -> [String] {
        let lines = raw
            .split(whereSeparator: \.isNewline)
            .map { line -> String in
                var text = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
                if let regex = try? NSRegularExpression(pattern: #"^\d+[\.\)]\s*"#) {
                    let ns = text as NSString
                    text = regex.stringByReplacingMatches(in: text, options: [], range: NSRange(location: 0, length: ns.length), withTemplate: "")
                }
                return text.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            .filter { !$0.isEmpty }
        if lines.count >= expected {
            return Array(lines.prefix(expected))
        }
        return lines
    }
}

public enum SiriSnapshotMapper {
    public static func make(from snapshot: DashboardSnapshot, now: Date = Date()) -> SiriFinanceSnapshot {
        SiriFinanceSnapshot(
            displayName: snapshot.displayName,
            monthKey: snapshot.selectedMonth.key,
            bankBalanceLabel: snapshot.summary.bankBalance.formatted(),
            netWorthLabel: snapshot.summary.netWorth.formatted(),
            weeklySpendLabel: snapshot.weeklyRecap.total.formatted(),
            weeklyDeltaPct: snapshot.weeklyRecap.deltaPct,
            weeklyTopCategory: snapshot.weeklyRecap.topCategoryName,
            openBillsLabel: snapshot.summary.openBillsTotal.formatted(),
            creditCount: snapshot.summary.creditCount,
            insights: snapshot.insights.map {
                .init(id: $0.id, type: $0.type, text: $0.text, generatedOnDevice: $0.generatedOnDevice)
            },
            budgets: snapshot.budgetCategories.map {
                .init(
                    category: $0.category,
                    spentLabel: $0.spent.formatted(),
                    limitLabel: $0.limit.formatted(),
                    percent: $0.percent
                )
            },
            recentTransactions: snapshot.recentTransactions.prefix(40).map {
                .init(
                    id: $0.id,
                    description: $0.description,
                    category: $0.category,
                    amountLabel: $0.amount.formatted(),
                    dateRelative: $0.dateRelative,
                    isCredit: $0.isCredit
                )
            },
            incomeLabel: snapshot.cashflow.income.formatted(),
            expenseLabel: snapshot.cashflow.expense.formatted(),
            netLabel: snapshot.cashflow.net.formatted(),
            categories: snapshot.categoryExpenses
                .sorted { $0.value > $1.value }
                .prefix(12)
                .map {
                    .init(
                        name: $0.name,
                        amountLabel: Money(amount: Decimal($0.value)).formatted(),
                        amount: $0.value
                    )
                },
            creditPurchases: snapshot.recentCreditPurchases.map { tx in
                let hasInst = isInstallmentDescription(tx.description)
                let cardName = (tx.accountName?.isEmpty == false ? tx.accountName! : "Cartão")
                let dueMonth = tx.date.count >= 7 ? String(tx.date.prefix(7)) : snapshot.selectedMonth.description
                return SiriFinanceSnapshot.SiriCreditBillPurchase(
                    id: tx.id,
                    cardId: tx.accountId ?? "",
                    cardName: cardName,
                    description: tx.description,
                    amountLabel: tx.amount.formatted(),
                    amount: NSDecimalNumber(decimal: tx.amount.amount).doubleValue,
                    purchaseDate: tx.date,
                    dueMonth: dueMonth,
                    isInstallment: hasInst,
                    installmentLabel: hasInst ? "Parcelada" : "À vista (não parcelada)",
                    category: tx.category
                )
            },
            updatedAt: now
        )
    }

    public static func cards(from screen: CreditCardsScreen) -> [SiriFinanceSnapshot.SiriCard] {
        screen.cards.map { card in
            .init(
                id: card.id,
                name: card.name,
                institutionName: card.institutionName,
                lastFour: card.lastFour,
                openTotalLabel: card.openTotal.formatted(),
                openTotalAmount: NSDecimalNumber(decimal: card.openTotal.amount).doubleValue,
                outstandingLabel: card.outstanding.formatted()
            )
        }
    }

    public static func creditPurchases(from screen: CreditCardsScreen) -> [SiriFinanceSnapshot.SiriCreditBillPurchase] {
        var results: [SiriFinanceSnapshot.SiriCreditBillPurchase] = []
        var seenIds = Set<String>()

        let specificPeriods = screen.periods.filter { $0.key != CreditCardsScreen.allCardsId }
        let periodsToScan = specificPeriods.isEmpty ? screen.periods : specificPeriods

        for (cardId, period) in periodsToScan {
            let fallbackName = screen.displayName(forAccountId: cardId)
                ?? screen.cards.first(where: { $0.id == cardId })?.name
                ?? "Cartão"

            for bucket in period.bills {
                for line in bucket.items {
                    if line.isPayment { continue }
                    let uniqueKey = "\(cardId)_\(line.id)_\(bucket.dueMonth)"
                    if seenIds.contains(uniqueKey) { continue }
                    seenIds.insert(uniqueKey)

                    let totalInst = line.installmentTotal ?? 0
                    let numInst = line.installmentNumber
                    let hasInstPattern = isInstallmentDescription(line.description)
                    let isInstallment = totalInst > 1 || line.installmentLabel != nil || hasInstPattern
                    let resolvedCardName = line.accountName.isEmpty ? fallbackName : line.accountName

                    results.append(
                        .init(
                            id: line.id,
                            cardId: line.accountId.isEmpty ? cardId : line.accountId,
                            cardName: resolvedCardName,
                            description: line.description,
                            amountLabel: line.amount.formatted(),
                            amount: NSDecimalNumber(decimal: line.amount.amount).doubleValue,
                            purchaseDate: line.purchaseDate?.description,
                            dueMonth: bucket.dueMonth,
                            isInstallment: isInstallment,
                            installmentNumber: numInst,
                            installmentTotal: totalInst > 0 ? totalInst : nil,
                            installmentLabel: line.installmentLabel,
                            category: line.category,
                            merchantName: line.merchantName,
                            isPayment: line.isPayment
                        )
                    )
                }
            }
        }
        return results
    }

    private static func isInstallmentDescription(_ text: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: #"(?:\b\d+\s*\/\s*\d+\b|\b\d+\s*de\s*\d+\b|parcela\s+\d+)"#, options: .caseInsensitive) else {
            return false
        }
        let ns = text as NSString
        return regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: ns.length)) != nil
    }

    public static func accounts(from accounts: [Account]) -> [SiriFinanceSnapshot.SiriAccount] {
        accounts
            .filter { !$0.isHidden && !$0.isCreditCard }
            .map { account in
                .init(
                    id: account.id,
                    name: account.name,
                    kind: Self.kindLabel(account.type),
                    amountLabel: account.displayAmount.formatted(),
                    institutionName: account.institutionName
                )
            }
    }

    private static func kindLabel(_ type: AccountType) -> String {
        switch type {
        case .checking: return "corrente"
        case .savings: return "poupança"
        case .credit: return "cartão"
        case .investment: return "investimento"
        case .loan: return "empréstimo"
        case .manual: return "manual"
        case .other: return "outra"
        }
    }
}
