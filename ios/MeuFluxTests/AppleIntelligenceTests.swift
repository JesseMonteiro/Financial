import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxCore
@testable import MeuFluxIntelligence

final class PurchaseCategorizerTests: XCTestCase {
    func testUberIsTransport() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "Uber",
            source: .generic,
            combinedText: "Compra aprovada de R$ 32,90 em UBER *TRIP"
        )
        XCTAssertEqual(kind, .transport)
    }

    func testIFoodIsFood() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "iFood",
            source: .generic,
            combinedText: "Compra aprovada iFood R$ 45,00"
        )
        XCTAssertEqual(kind, .food)
    }

    func testExtraIsGroceries() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "Extra",
            source: .generic,
            combinedText: "Compra Extra R$ 120,00"
        )
        XCTAssertEqual(kind, .groceries)
    }

    func testPadariaIsFood() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "Padaria Central",
            source: .generic,
            combinedText: "Compra aprovada em PADARIA CENTRAL"
        )
        XCTAssertEqual(kind, .food)
    }

    func testBenefitSourceFallsBackToFood() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "Loja X",
            source: .alelo,
            combinedText: "Compra aprovada"
        )
        XCTAssertEqual(kind, .food)
    }

    func testUnknownGenericIsOther() {
        let kind = RuleBasedPurchaseCategorizer.heuristic(
            merchant: "XYZ 123",
            source: .generic,
            combinedText: "Compra aprovada de R$ 10,00 em XYZ 123"
        )
        XCTAssertEqual(kind, .other)
    }

    func testNormalizesIFoodStarPrefix() {
        XCTAssertEqual(MerchantNormalizer.normalize("IFOOD *IFOOD CLUBE"), "iFood")
    }

    func testNormalizesUber() {
        XCTAssertEqual(MerchantNormalizer.normalize("UBER *TRIP"), "Uber")
    }
}

final class InsightNarratorTests: XCTestCase {
    func testRejectsRewriteMissingOriginalAmount() {
        let original = "Seus gastos subiram 25% e chegaram a R$ 1.234,56."
        let facts = InsightNarrator.extractNumericTokens(from: original)
        XCTAssertTrue(facts.contains("R$ 1.234,56"))
        XCTAssertTrue(facts.contains("25%"))
        XCTAssertFalse(
            InsightNarrator.containsRequiredFacts(
                "Você gastou bastante este mês.",
                original: original,
                allFacts: facts
            )
        )
        XCTAssertTrue(
            InsightNarrator.containsRequiredFacts(
                "Atenção: os gastos subiram 25% e chegaram a R$ 1.234,56.",
                original: original,
                allFacts: facts
            )
        )
    }

    func testBudgetPressureUsesSnapshotNumbers() {
        let snapshot = StubLoadDashboard().makeSnapshot(
            budgets: [
                DashboardBudgetCategory(
                    category: "Alimentação",
                    spent: Money(amount: Decimal(string: "920")!),
                    limit: Money(amount: Decimal(string: "1000")!),
                    percent: 92,
                    colorHex: "#f00"
                )
            ]
        )
        let extras = InsightNarrator.budgetPressureInsights(from: snapshot)
        XCTAssertEqual(extras.count, 1)
        XCTAssertTrue(extras[0].text.contains("92%"))
        XCTAssertTrue(extras[0].text.contains(Money(amount: Decimal(string: "920")!).formatted()))
    }

    func testParseNumberedLines() {
        let lines = InsightNarrator.parseNumberedLines(
            """
            1. Primeiro insight
            2. Segundo insight
            """,
            expected: 2
        )
        XCTAssertEqual(lines, ["Primeiro insight", "Segundo insight"])
    }
}

final class SiriSnapshotStoreTests: XCTestCase {
    func testRoundTrip() {
        let defaults = UserDefaults(suiteName: "siri.snapshot.tests.\(UUID().uuidString)")!
        let store = SiriSnapshotStore(defaults: defaults, fallback: nil)
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 10,00",
            netWorthLabel: "R$ 20,00",
            weeklySpendLabel: "R$ 5,00",
            weeklyDeltaPct: 10,
            weeklyTopCategory: "Alimentação",
            openBillsLabel: "R$ 1,00",
            creditCount: 1,
            insights: [
                .init(id: "i1", type: "info", text: "Olá", generatedOnDevice: true)
            ],
            budgets: [
                .init(category: "Alimentação", spentLabel: "R$ 2,00", limitLabel: "R$ 10,00", percent: 20)
            ],
            recentTransactions: [
                .init(
                    id: "t1",
                    description: "Uber",
                    category: "Transporte",
                    amountLabel: "R$ 32,90",
                    dateRelative: "hoje",
                    isCredit: false
                )
            ],
            updatedAt: Date(timeIntervalSince1970: 1_000)
        )
        store.save(snapshot)
        let loaded = store.load()
        XCTAssertEqual(loaded?.bankBalanceLabel, "R$ 10,00")
        XCTAssertEqual(loaded?.recentTransactions.first?.description, "Uber")
        store.clear()
        XCTAssertNil(store.load())
    }
}

final class MeuFluxAssistantRouterTests: XCTestCase {
    func testWeeklyQuestion() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 10,00",
            netWorthLabel: "R$ 20,00",
            weeklySpendLabel: "R$ 200,00",
            weeklyDeltaPct: -5,
            weeklyTopCategory: "Alimentação",
            openBillsLabel: "R$ 80,00",
            creditCount: 2,
            insights: [],
            budgets: [],
            recentTransactions: [],
            updatedAt: Date()
        )
        let reply = MeuFluxAssistantRouter.cannedReply(
            question: "Quanto gastei esta semana?",
            snapshot: snapshot
        )
        XCTAssertTrue(reply.contains("R$ 200,00"))
        XCTAssertTrue(reply.contains("Alimentação"))
    }

    func testBalanceQuestion() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 1.500,00",
            netWorthLabel: "R$ 9.000,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 0,00",
            creditCount: 0,
            insights: [],
            budgets: [],
            recentTransactions: [],
            updatedAt: Date()
        )
        let reply = MeuFluxAssistantRouter.cannedReply(question: "Qual meu saldo?", snapshot: snapshot)
        XCTAssertTrue(reply.contains("R$ 1.500,00"))
        XCTAssertTrue(reply.contains("R$ 9.000,00"))
    }
}

private extension StubLoadDashboard {
    func makeSnapshot(budgets: [DashboardBudgetCategory]) -> DashboardSnapshot {
        DashboardSnapshot(
            displayName: "usuário",
            selectedMonth: YearMonth(year: 2026, month: 9),
            summary: DashboardSummary(
                netWorth: .zero,
                bankBalance: .zero,
                reservedBalance: .zero,
                investmentTotal: .zero,
                creditDebt: .zero,
                openBillsTotal: .zero,
                loansTotal: .zero,
                totalAssets: .zero,
                bankCount: 0,
                creditCount: 0
            ),
            cashflow: DashboardCashflow(income: .zero, expense: .zero, net: .zero, savingsRate: nil),
            monthOverMonth: DashboardMonthOverMonth(
                expenseDeltaPct: 0,
                currentExpense: .zero,
                previousExpense: .zero
            ),
            netWorthSeries: [],
            incomeExpenseSeries: [],
            categoryExpenses: [],
            insights: [],
            weeklyRecap: DashboardWeeklyRecap(
                total: .zero,
                deltaPct: 0,
                topCategoryName: nil,
                topCategoryValue: nil
            ),
            recentTransactions: [],
            budgetCategories: budgets
        )
    }
}
