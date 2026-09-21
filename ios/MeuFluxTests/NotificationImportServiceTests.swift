import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData
import MeuFluxCore

private actor MockAuthSession: AuthSessionActor {
    var authenticated: Bool

    init(authenticated: Bool = true) {
        self.authenticated = authenticated
    }

    func accessToken() async -> String? { authenticated ? "token" : nil }
    func refreshToken() async -> String? { authenticated ? "refresh" : nil }
    func setTokens(access: String, refresh: String?) async throws { authenticated = true }
    func clear() async throws { authenticated = false }
    func isAuthenticated() async -> Bool { authenticated }
}

private final class MockMealBenefits: MealBenefitsRepository, @unchecked Sendable {
    var purchases: [MealBenefitPurchase] = []
    var benefits: [MealBenefit] = [
        MealBenefit(
            id: "va-1",
            kind: .va,
            label: "Alelo VA",
            monthlyAmount: Money(amount: 800),
            creditDay: 1,
            startsOn: InstantDate(year: 2026, month: 1, day: 1)
        )
    ]

    func fetchBenefits(force: Bool) async throws -> [MealBenefit] { benefits }
    func saveBenefit(_ benefit: MealBenefit) async throws {}
    func deleteBenefit(id: String) async throws {}
    func savePurchase(_ purchase: MealBenefitPurchase) async throws {
        purchases.removeAll { $0.id == purchase.id }
        purchases.append(purchase)
    }
    func deletePurchase(id: String) async throws {
        purchases.removeAll { $0.id == id }
    }
}

private final class MockManuals: ManualExpensesRepository, @unchecked Sendable {
    var expenses: [ManualExpense] = []

    func fetchExpenses(month: YearMonth?, force: Bool) async throws -> [ManualExpense] { expenses }
    func createExpense(_ expense: ManualExpense) async throws -> ManualExpense {
        expenses.append(expense)
        return expense
    }
    func updateExpense(_ expense: ManualExpense) async throws {
        if let index = expenses.firstIndex(where: { $0.id == expense.id }) {
            expenses[index] = expense
        } else {
            expenses.append(expense)
        }
    }
    func deleteExpense(id: String) async throws {
        expenses.removeAll { $0.id == id }
    }
}

private struct MockConnectedBankChecker: ConnectedBankChecking, Sendable {
    var connectedSources: Set<NotificationImportSource>

    func isConnectedViaOpenFinance(source: NotificationImportSource) async -> Bool {
        guard source.isBankSource else { return false }
        return connectedSources.contains(source)
    }
}

private final class MockBankConnections: BankConnectionsRepository, @unchecked Sendable {
    var items: [BankConnectionItem] = []

    func fetchItems(force: Bool) async throws -> [BankConnectionItem] { items }
    func syncItem(id: String) async throws {}
}

final class NotificationImportServiceTests: XCTestCase {
    private let now = InstantDate(year: 2026, month: 9, day: 14).date()!

    func testRoutesAleloToMealBenefit() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        let manuals = MockManuals()
        await store.saveRules([
            NotificationImportRule(source: .alelo, destination: .mealBenefit(id: "va-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: manuals,
            authSession: MockAuthSession()
        )
        let outcome = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ",
            sourceApp: "Alelo",
            now: now
        )
        guard case .imported(let record) = outcome else {
            return XCTFail("expected imported, got \(outcome)")
        }
        XCTAssertEqual(record.createdEntityKind, .mealPurchase)
        XCTAssertEqual(meals.purchases.count, 1)
        XCTAssertEqual(meals.purchases.first?.amount.amount, Decimal(string: "32.50"))
        XCTAssertEqual(meals.purchases.first?.description, "RESTAURANTE XYZ")
        XCTAssertEqual(meals.purchases.first?.category, "Restaurantes & Bares")
        XCTAssertTrue(manuals.expenses.isEmpty)
    }

    func testRoutesGenericToManualAccount() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        let manuals = MockManuals()
        await store.saveRules([
            NotificationImportRule(source: .generic, destination: .manualAccount(id: "acc-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: manuals,
            authSession: MockAuthSession()
        )
        let outcome = await service.importFromNotification(
            title: "Meu Banco",
            body: "Compra aprovada de R$ 80,00 em UBER",
            sourceApp: "Meu Banco",
            now: now
        )
        guard case .imported = outcome else {
            return XCTFail("expected imported, got \(outcome)")
        }
        XCTAssertEqual(manuals.expenses.count, 1)
        XCTAssertEqual(manuals.expenses.first?.accountId, "acc-1")
        XCTAssertEqual(manuals.expenses.first?.isPaid, true)
        XCTAssertEqual(manuals.expenses.first?.category, "Transport")
        XCTAssertTrue(meals.purchases.isEmpty)
    }

    func testDedupSameNotification() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        await store.saveRules([
            NotificationImportRule(source: .alelo, destination: .mealBenefit(id: "va-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: MockManuals(),
            authSession: MockAuthSession()
        )
        let first = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ",
            sourceApp: "Alelo",
            now: now
        )
        let second = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ",
            sourceApp: "Alelo",
            now: now
        )
        guard case .imported = first else { return XCTFail("first should import") }
        guard case .duplicate = second else { return XCTFail("second should dedup, got \(second)") }
        XCTAssertEqual(meals.purchases.count, 1)
    }

    func testNeedsDestinationWithoutRule() async {
        let service = NotificationImportService(
            store: InMemoryNotificationImportStore(),
            mealBenefits: MockMealBenefits(),
            manuals: MockManuals(),
            authSession: MockAuthSession()
        )
        let outcome = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 10,00 em PADARIA",
            sourceApp: "Alelo",
            now: now
        )
        guard case .needsDestination = outcome else {
            return XCTFail("expected needsDestination, got \(outcome)")
        }
    }

    func testQueuesWhenLoggedOut() async {
        let store = InMemoryNotificationImportStore()
        await store.saveRules([
            NotificationImportRule(source: .alelo, destination: .mealBenefit(id: "va-1"))
        ])
        let meals = MockMealBenefits()
        let auth = MockAuthSession(authenticated: false)
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: MockManuals(),
            authSession: auth
        )
        let queued = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 10,00 em PADARIA",
            sourceApp: "Alelo",
            now: now
        )
        guard case .queued = queued else { return XCTFail("expected queued, got \(queued)") }
        XCTAssertTrue(meals.purchases.isEmpty)

        try? await auth.setTokens(access: "x", refresh: "y")
        let processed = await service.processQueued(now: now)
        XCTAssertEqual(processed.count, 1)
        guard case .imported = processed.first else {
            return XCTFail("expected imported after login, got \(String(describing: processed.first))")
        }
        XCTAssertEqual(meals.purchases.count, 1)
    }

    func testUndoDeletesPurchase() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        await store.saveRules([
            NotificationImportRule(source: .alelo, destination: .mealBenefit(id: "va-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: MockManuals(),
            authSession: MockAuthSession()
        )
        let imported = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 10,00 em PADARIA",
            sourceApp: "Alelo",
            now: now
        )
        guard case .imported(let record) = imported else { return XCTFail("import failed") }
        let undone = await service.undo(recordId: record.id)
        guard case .undone = undone else { return XCTFail("expected undone, got \(undone)") }
        XCTAssertTrue(meals.purchases.isEmpty)
    }

    // MARK: - Open Finance Anti-Duplicity Tests

    func testSkipsImportWhenBankConnectedViaOpenFinance() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        let manuals = MockManuals()
        let checker = MockConnectedBankChecker(connectedSources: [.nubank])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: manuals,
            authSession: MockAuthSession(),
            bankChecker: checker
        )

        let outcome = await service.importFromNotification(
            title: "Nubank",
            body: "Compra de R$ 45,00 no crédito aprovada em IFOOD",
            sourceApp: "Nubank",
            now: now
        )

        guard case .skippedOpenFinance(let record) = outcome else {
            return XCTFail("expected skippedOpenFinance, got \(outcome)")
        }
        XCTAssertEqual(record.status, .skippedOpenFinance)
        XCTAssertTrue(manuals.expenses.isEmpty, "Nenhuma despesa manual deve ser criada quando banco está conectado")
    }

    func testImportsBankWhenNotConnectedViaOpenFinance() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        let manuals = MockManuals()
        let checker = MockConnectedBankChecker(connectedSources: [.itau]) // C6 NÃO está conectado
        await store.saveRules([
            NotificationImportRule(source: .c6, destination: .manualAccount(id: "c6-account"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: manuals,
            authSession: MockAuthSession(),
            bankChecker: checker
        )

        let outcome = await service.importFromNotification(
            title: "C6 Bank",
            body: "Sua compra de R$ 32,00 no cartão foi aprovada em RESTAURANTE",
            sourceApp: "C6 Bank",
            now: now
        )

        guard case .imported(let record) = outcome else {
            return XCTFail("expected imported, got \(outcome)")
        }
        XCTAssertEqual(record.createdEntityKind, .manualExpense)
        XCTAssertEqual(manuals.expenses.count, 1)
        XCTAssertEqual(manuals.expenses.first?.accountId, "c6-account")
        XCTAssertEqual(manuals.expenses.first?.amount.amount, Decimal(string: "32.00"))
    }

    func testVAVRNeverBlockedByOpenFinanceCheck() async {
        let store = InMemoryNotificationImportStore()
        let meals = MockMealBenefits()
        let manuals = MockManuals()
        // Mesmo se o checker tiver fontes bancárias, fontes de benefícios não devem ser bloqueadas
        let checker = MockConnectedBankChecker(connectedSources: [.nubank, .itau])
        await store.saveRules([
            NotificationImportRule(source: .alelo, destination: .mealBenefit(id: "va-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: meals,
            manuals: manuals,
            authSession: MockAuthSession(),
            bankChecker: checker
        )

        let outcome = await service.importFromNotification(
            title: "Alelo",
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ",
            sourceApp: "Alelo",
            now: now
        )

        guard case .imported(let record) = outcome else {
            return XCTFail("expected imported, got \(outcome)")
        }
        XCTAssertEqual(record.createdEntityKind, .mealPurchase)
        XCTAssertEqual(meals.purchases.count, 1)
    }

    func testLiveConnectedBankCheckerMatching() async {
        let bankConnections = MockBankConnections()
        bankConnections.items = [
            BankConnectionItem(id: "conn-1", institutionName: "Nu Pagamentos S.A.", status: "UPDATED"),
            BankConnectionItem(id: "conn-2", institutionName: "Banco Itaú S.A.", status: "LOGIN_ERROR") // Com erro não deve contar como ativo
        ]
        let checker = LiveConnectedBankChecker(bankConnections: bankConnections)

        let isNubankConnected = await checker.isConnectedViaOpenFinance(source: .nubank)
        XCTAssertTrue(isNubankConnected, "Nubank deve ser reconhecido por 'Nu Pagamentos'")

        let isItauConnected = await checker.isConnectedViaOpenFinance(source: .itau)
        XCTAssertFalse(isItauConnected, "Itaú com LOGIN_ERROR não deve ser considerado ativo")

        let isC6Connected = await checker.isConnectedViaOpenFinance(source: .c6)
        XCTAssertFalse(isC6Connected, "C6 não está na lista de conexões")

        let isAleloBlocked = await checker.isConnectedViaOpenFinance(source: .alelo)
        XCTAssertFalse(isAleloBlocked, "Alelo não é banco e nunca deve ser bloqueado")
    }

    // MARK: - Direct Transaction (Apple Pay / Wallet) Tests

    func testImportDirectTransactionApplePayManualAccount() async {
        let store = InMemoryNotificationImportStore()
        let manuals = MockManuals()
        await store.saveRules([
            NotificationImportRule(source: .wallet, destination: .manualAccount(id: "card-1"))
        ])
        let service = NotificationImportService(
            store: store,
            mealBenefits: MockMealBenefits(),
            manuals: manuals,
            authSession: MockAuthSession()
        )

        let outcome = await service.importDirectTransaction(
            amount: Decimal(string: "78.50")!,
            merchant: "Supermercado Pão de Açúcar",
            cardName: "Cartão C6",
            date: now
        )

        guard case .imported(let record) = outcome else {
            return XCTFail("expected imported, got \(outcome)")
        }
        XCTAssertEqual(manuals.expenses.count, 1)
        XCTAssertEqual(manuals.expenses.first?.amount.amount, Decimal(string: "78.50"))
        XCTAssertEqual(manuals.expenses.first?.description, "Supermercado Pão de Açúcar")
        XCTAssertEqual(record.createdEntityKind, .manualExpense)
    }

    func testImportDirectTransactionApplePaySkippedIfOpenFinanceConnected() async {
        let store = InMemoryNotificationImportStore()
        let manuals = MockManuals()
        let checker = MockConnectedBankChecker(connectedSources: [.nubank])
        let service = NotificationImportService(
            store: store,
            mealBenefits: MockMealBenefits(),
            manuals: manuals,
            authSession: MockAuthSession(),
            bankChecker: checker
        )

        let outcome = await service.importDirectTransaction(
            amount: Decimal(string: "120.00")!,
            merchant: "Amazon",
            cardName: "Nubank Ultravioleta",
            date: now
        )

        guard case .skippedOpenFinance(let record) = outcome else {
            return XCTFail("expected skippedOpenFinance, got \(outcome)")
        }
        XCTAssertEqual(record.status, .skippedOpenFinance)
        XCTAssertTrue(manuals.expenses.isEmpty, "Não deve criar despesa manual para cartão Nubank conectado ao Open Finance")
    }
}
