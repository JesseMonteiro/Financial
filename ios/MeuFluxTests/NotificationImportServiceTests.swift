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
}
