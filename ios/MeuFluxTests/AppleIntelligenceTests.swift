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

    func testCardSpendQuestionRanksHighestOpenTotal() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 10,00",
            netWorthLabel: "R$ 20,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 800,00",
            creditCount: 2,
            insights: [],
            budgets: [],
            recentTransactions: [],
            cards: [
                .init(
                    id: "c1",
                    name: "Inter",
                    institutionName: "Inter",
                    lastFour: "1111",
                    openTotalLabel: "R$ 200,00",
                    openTotalAmount: 200,
                    outstandingLabel: "R$ 200,00"
                ),
                .init(
                    id: "c2",
                    name: "Nubank",
                    institutionName: "Nubank",
                    lastFour: "2222",
                    openTotalLabel: "R$ 600,00",
                    openTotalAmount: 600,
                    outstandingLabel: "R$ 700,00"
                ),
            ],
            updatedAt: Date()
        )
        let reply = MeuFluxAssistantRouter.cannedReply(
            question: "qual cartão eu tenho mais gastos?",
            snapshot: snapshot
        )
        XCTAssertTrue(reply.contains("Nubank"), reply)
        XCTAssertTrue(reply.contains("R$ 600,00"), reply)
        XCTAssertFalse(reply.contains("cartão(ões) com fatura aberta"), reply)
    }

    func testBareCardQuestionDoesNotUseSpendRanking() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 10,00",
            netWorthLabel: "R$ 20,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 80,00",
            creditCount: 2,
            insights: [],
            budgets: [],
            recentTransactions: [],
            updatedAt: Date()
        )
        let reply = MeuFluxAssistantRouter.cannedReply(question: "Como está a fatura?", snapshot: snapshot)
        XCTAssertTrue(reply.contains("R$ 80,00"), reply)
        XCTAssertFalse(MeuFluxAssistantRouter.isCardSpendQuestion("Como está a fatura?"))
    }

    func testCategoryQuestionUsesMonthlyBreakdown() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 10,00",
            netWorthLabel: "R$ 20,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 0,00",
            creditCount: 0,
            insights: [],
            budgets: [],
            recentTransactions: [],
            categories: [
                .init(name: "Alimentação", amountLabel: "R$ 900,00", amount: 900),
                .init(name: "Transporte", amountLabel: "R$ 120,00", amount: 120),
            ],
            updatedAt: Date()
        )
        let reply = MeuFluxAssistantRouter.cannedReply(
            question: "Onde gastei mais este mês?",
            snapshot: snapshot
        )
        XCTAssertTrue(reply.contains("Alimentação"), reply)
        XCTAssertTrue(reply.contains("R$ 900,00"), reply)
    }

    func testCreditPurchasesFilterForAmazonNonInstallmentInOctober() {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-10",
            bankBalanceLabel: "R$ 1.000,00",
            netWorthLabel: "R$ 5.000,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 950,00",
            creditCount: 1,
            insights: [],
            budgets: [],
            recentTransactions: [],
            cards: [
                .init(
                    id: "c-amazon",
                    name: "Cartão Amazon",
                    institutionName: "Bradesco",
                    lastFour: "9999",
                    openTotalLabel: "R$ 950,00",
                    openTotalAmount: 950,
                    outstandingLabel: "R$ 950,00"
                )
            ],
            creditPurchases: [
                .init(
                    id: "p1",
                    cardId: "c-amazon",
                    cardName: "Cartão Amazon",
                    description: "Livro Clean Architecture",
                    amountLabel: "R$ 89,90",
                    amount: 89.90,
                    purchaseDate: "2026-10-02",
                    dueMonth: "2026-10",
                    isInstallment: false
                ),
                .init(
                    id: "p2",
                    cardId: "c-amazon",
                    cardName: "Cartão Amazon",
                    description: "Kindle Paperwhite (1/3)",
                    amountLabel: "R$ 200,00",
                    amount: 200.00,
                    purchaseDate: "2026-10-05",
                    dueMonth: "2026-10",
                    isInstallment: true,
                    installmentNumber: 1,
                    installmentTotal: 3,
                    installmentLabel: "Parcela 1/3"
                ),
                .init(
                    id: "p3",
                    cardId: "c-amazon",
                    cardName: "Cartão Amazon",
                    description: "Cabo USB-C",
                    amountLabel: "R$ 35,00",
                    amount: 35.00,
                    purchaseDate: "2026-10-14",
                    dueMonth: "2026-10",
                    isInstallment: false
                ),
                .init(
                    id: "p4",
                    cardId: "c-nubank",
                    cardName: "Nubank",
                    description: "Almoço",
                    amountLabel: "R$ 45,00",
                    amount: 45.00,
                    purchaseDate: "2026-10-08",
                    dueMonth: "2026-10",
                    isInstallment: false
                )
            ],
            updatedAt: Date()
        )

        let reply = MeuFluxAssistantRouter.cannedReply(
            question: "Quais as compras não parceladas no mês de outubro no meu cartão amazon?",
            snapshot: snapshot
        )

        XCTAssertTrue(reply.contains("Livro Clean Architecture"), reply)
        XCTAssertTrue(reply.contains("Cabo USB-C"), reply)
        XCTAssertFalse(reply.contains("Kindle Paperwhite"), reply)
        XCTAssertFalse(reply.contains("Nubank"), reply)
        XCTAssertFalse(reply.contains("Almoço"), reply)
    }
}


final class SiriSnapshotMapperTests: XCTestCase {
    func testMapsCategoriesAndCashflow() {
        var snapshot = StubLoadDashboard().makeSnapshot(budgets: [])
        snapshot.categoryExpenses = [
            DashboardCategoryExpense(name: "Alimentação", value: 500, colorHex: "#f00"),
            DashboardCategoryExpense(name: "Transporte", value: 80, colorHex: "#0f0"),
        ]
        snapshot.cashflow = DashboardCashflow(
            income: Money(amount: 3000),
            expense: Money(amount: 1200),
            net: Money(amount: 1800),
            savingsRate: 0.6
        )
        let siri = SiriSnapshotMapper.make(from: snapshot)
        XCTAssertEqual(siri.categories.first?.name, "Alimentação")
        XCTAssertEqual(siri.incomeLabel, Money(amount: 3000).formatted())
        XCTAssertEqual(siri.expenseLabel, Money(amount: 1200).formatted())
    }

    func testMapsCardsByOpenTotal() {
        let screen = CreditCardsScreen(
            cards: [
                CreditCardSummary(
                    id: "inter",
                    name: "Inter",
                    institutionName: "Inter",
                    lastFour: "1111",
                    outstanding: Money(amount: 200),
                    openTotal: Money(amount: 200)
                ),
                CreditCardSummary(
                    id: "nubank",
                    name: "Nubank",
                    institutionName: "Nubank",
                    lastFour: "2222",
                    outstanding: Money(amount: 700),
                    openTotal: Money(amount: 600)
                ),
            ],
            outstandingTotal: Money(amount: 900),
            creditLimitTotal: .zero,
            availableLimitTotal: .zero,
            periods: [:]
        )
        let cards = SiriSnapshotMapper.cards(from: screen)
        XCTAssertEqual(cards.count, 2)
        XCTAssertEqual(cards.max(by: { $0.openTotalAmount < $1.openTotalAmount })?.name, "Nubank")
    }

    func testPreservesExistingCardsWhenDashboardHasNone() {
        let previous = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-09",
            bankBalanceLabel: "R$ 1,00",
            netWorthLabel: "R$ 2,00",
            weeklySpendLabel: "R$ 0,00",
            weeklyDeltaPct: 0,
            weeklyTopCategory: nil,
            openBillsLabel: "R$ 0,00",
            creditCount: 1,
            insights: [],
            budgets: [],
            recentTransactions: [],
            cards: [
                .init(
                    id: "c1",
                    name: "Nubank",
                    institutionName: "Nubank",
                    lastFour: "2222",
                    openTotalLabel: "R$ 10,00",
                    openTotalAmount: 10,
                    outstandingLabel: "R$ 10,00"
                )
            ],
            updatedAt: Date()
        )
        let mapped = SiriSnapshotMapper.make(from: StubLoadDashboard().makeSnapshot(budgets: []))
            .preservingLists(from: previous)
        XCTAssertEqual(mapped.cards.first?.name, "Nubank")
    }

    func testDecodesLegacySnapshotWithoutNewFields() throws {
        let json = """
        {
          "displayName":"Jesse",
          "monthKey":"2026-09",
          "bankBalanceLabel":"R$ 10,00",
          "netWorthLabel":"R$ 20,00",
          "weeklySpendLabel":"R$ 5,00",
          "weeklyDeltaPct":10,
          "openBillsLabel":"R$ 1,00",
          "creditCount":1,
          "insights":[],
          "budgets":[],
          "recentTransactions":[],
          "updatedAt":"1970-01-01T00:16:40Z"
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let snapshot = try decoder.decode(SiriFinanceSnapshot.self, from: Data(json.utf8))
        XCTAssertEqual(snapshot.bankBalanceLabel, "R$ 10,00")
        XCTAssertTrue(snapshot.cards.isEmpty)
        XCTAssertTrue(snapshot.categories.isEmpty)
    }

    func testMapsCreditPurchasesDetectingInstallmentAndDates() {
        let amazonLine1 = CreditBillLine(
            id: "tx-amazon-1",
            accountId: "card-amazon",
            accountName: "Amazon Prime",
            description: "Kindle Oasis",
            amount: Money(amount: 800),
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false,
            category: "Shopping",
            purchaseDate: InstantDate(isoString: "2026-10-05"),
            installmentNumber: nil,
            installmentTotal: 1
        )
        let amazonLine2 = CreditBillLine(
            id: "tx-amazon-2",
            accountId: "card-amazon",
            accountName: "Amazon Prime",
            description: "Fone Bluetooth 2/5",
            amount: Money(amount: 150),
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false,
            category: "Shopping",
            purchaseDate: InstantDate(isoString: "2026-09-10"),
            installmentNumber: 2,
            installmentTotal: 5
        )
        let amazonPayment = CreditBillLine(
            id: "tx-amazon-pay",
            accountId: "card-amazon",
            accountName: "Amazon Prime",
            description: "Pagamento de Fatura",
            amount: Money(amount: 950),
            isCredit: true,
            isPayment: true,
            isProjected: false,
            isPending: false
        )
        let bucket = CreditBillBucket(
            dueMonth: "2026-10",
            title: "Outubro 2026",
            type: .currentOpen,
            total: Money(amount: 950),
            dueDateShort: "15/10",
            isPaid: false,
            hasOfficial: false,
            items: [amazonLine1, amazonLine2, amazonPayment]
        )
        let screen = CreditCardsScreen(
            cards: [
                CreditCardSummary(
                    id: "card-amazon",
                    name: "Cartão Amazon",
                    institutionName: "Bradesco",
                    lastFour: "9999",
                    outstanding: Money(amount: 950),
                    openTotal: Money(amount: 950)
                )
            ],
            outstandingTotal: Money(amount: 950),
            creditLimitTotal: Money(amount: 10000),
            availableLimitTotal: Money(amount: 9050),
            periods: [
                "card-amazon": CreditBillPeriod(openDueKey: "2026-10", bills: [bucket])
            ]
        )

        let purchases = SiriSnapshotMapper.creditPurchases(from: screen)
        XCTAssertEqual(purchases.count, 2)
        let kindle = purchases.first(where: { $0.id == "tx-amazon-1" })
        XCTAssertNotNil(kindle)
        XCTAssertFalse(kindle!.isInstallment)
        XCTAssertEqual(kindle!.cardName, "Amazon Prime")
        XCTAssertEqual(kindle!.dueMonth, "2026-10")

        let fone = purchases.first(where: { $0.id == "tx-amazon-2" })
        XCTAssertNotNil(fone)
        XCTAssertTrue(fone!.isInstallment)
        XCTAssertEqual(fone!.installmentTotal, 5)
    }
}

private struct MockRemoteChatbotProvider: RemoteChatbotProviding {
    let mockedReply: String
    func reply(message: String, history: [AssistantChatMessage], snapshot: SiriFinanceSnapshot) async throws -> String {
        mockedReply
    }
}

final class MeuFluxAssistantSessionTests: XCTestCase {
    func testAssistantSessionFallsBackToRemoteProviderWhenOnDeviceUnavailable() async {
        let remote = MockRemoteChatbotProvider(mockedReply: "Resposta vinda do Gemini na nuvem")
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-10",
            bankBalanceLabel: "R$ 100,00",
            netWorthLabel: "R$ 100,00",
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
        let defaults = UserDefaults(suiteName: "siri.snapshot.tests.\(UUID().uuidString)")!
        let store = SiriSnapshotStore(defaults: defaults, fallback: nil)
        store.save(snapshot)

        let session = MeuFluxAssistantSession(
            generator: UnavailableOnDeviceGenerator(),
            store: store,
            remoteProvider: remote
        )

        let reply = await session.reply(to: "Olá, como estão minhas finanças?")
        XCTAssertEqual(reply, "Resposta vinda do Gemini na nuvem")
    }

    func testAssistantSessionUsesCannedReplyWhenRemoteAndOnDeviceFail() async {
        let snapshot = SiriFinanceSnapshot(
            displayName: "Jesse",
            monthKey: "2026-10",
            bankBalanceLabel: "R$ 2.500,00",
            netWorthLabel: "R$ 10.000,00",
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
        let defaults = UserDefaults(suiteName: "siri.snapshot.tests.\(UUID().uuidString)")!
        let store = SiriSnapshotStore(defaults: defaults, fallback: nil)
        store.save(snapshot)

        let session = MeuFluxAssistantSession(
            generator: UnavailableOnDeviceGenerator(),
            store: store,
            remoteProvider: nil
        )

        let reply = await session.reply(to: "Qual meu saldo?")
        XCTAssertTrue(reply.contains("R$ 2.500,00"), reply)
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
