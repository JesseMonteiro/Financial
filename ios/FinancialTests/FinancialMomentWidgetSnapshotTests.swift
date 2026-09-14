import XCTest
@testable import FinancialCore
@testable import FinancialData
@testable import FinancialDomain

final class FinancialMomentWidgetSnapshotTests: XCTestCase {
    func testMapperUsesCurrentMonthTotalsAndUnpaidCounts() {
        let month = YearMonth(year: 2026, month: 9)
        let unpaidBill = CreditCardBillItem(
            cardId: "c1",
            cardName: "Nubank",
            amount: Money(amount: Decimal(string: "800")!),
            dueDate: "2026-09-10",
            isPaid: false,
            isFallback: false
        )
        let paidBill = CreditCardBillItem(
            cardId: "c2",
            cardName: "Inter",
            amount: Money(amount: Decimal(string: "200")!),
            dueDate: "2026-09-05",
            isPaid: true,
            isFallback: false
        )
        let pendingDebit = AutomaticDebitItem(
            id: "d1",
            description: "Energia",
            amount: Money(amount: Decimal(string: "150")!),
            date: "2026-09-08",
            accountId: "a1",
            accountName: "Conta",
            isPending: true
        )
        let detail = FinancialMomentDetail(
            selectedMonth: month,
            salary: Money(amount: Decimal(string: "10000")!),
            receivables: ReceivablesSummary(items: [], total: .zero),
            creditCards: CreditCardsSummary(bills: [unpaidBill, paidBill], total: Money(amount: Decimal(string: "1000")!)),
            automaticDebits: AutomaticDebitsSummary(items: [pendingDebit], total: Money(amount: Decimal(string: "150")!)),
            manualExpenses: ManualExpensesSummary(items: [], total: .zero),
            totals: FinancialTotals(
                income: Money(amount: Decimal(string: "10500")!),
                expenses: Money(amount: Decimal(string: "8000")!),
                accountsPayable: Money(amount: Decimal(string: "1500")!),
                netBalance: Money(amount: Decimal(string: "2500")!)
            ),
            status: MonthStatus(isPositive: true, net: Money(amount: Decimal(string: "2500")!))
        )

        let now = Date(timeIntervalSince1970: 1_789_286_400)
        let snapshot = WidgetSnapshotMapper.financialMoment(detail, now: now)

        XCTAssertEqual(snapshot.monthKey, "2026-09")
        XCTAssertTrue(snapshot.monthLabel.localizedCaseInsensitiveContains("setembro"))
        XCTAssertTrue(snapshot.incomeLabel.contains("10.500") || snapshot.incomeLabel.contains("10500"))
        XCTAssertTrue(snapshot.expenseLabel.contains("8.000") || snapshot.expenseLabel.contains("8000"))
        XCTAssertTrue(snapshot.netLabel.hasPrefix("+"))
        XCTAssertTrue(snapshot.isNetPositive)
        XCTAssertFalse(snapshot.isOverBudget)
        XCTAssertFalse(snapshot.payableIsClear)
        XCTAssertEqual(snapshot.unpaidBillsCount, 1)
        XCTAssertEqual(snapshot.unpaidDebitsCount, 1)
        XCTAssertEqual(snapshot.payableSubtitle, "1 fat. · 1 déb.")
        XCTAssertEqual(snapshot.utilizationPercent, 76)
        XCTAssertEqual(snapshot.updatedAt, now)
    }

    func testMapperMarksDeficitAndClearPayables() {
        let detail = FinancialMomentDetail(
            selectedMonth: YearMonth(year: 2026, month: 1),
            salary: .zero,
            receivables: ReceivablesSummary(items: [], total: .zero),
            creditCards: CreditCardsSummary(bills: [], total: .zero),
            automaticDebits: AutomaticDebitsSummary(items: [], total: .zero),
            manualExpenses: ManualExpensesSummary(items: [], total: .zero),
            totals: FinancialTotals(
                income: Money(amount: Decimal(string: "1000")!),
                expenses: Money(amount: Decimal(string: "1500")!),
                accountsPayable: .zero,
                netBalance: Money(amount: Decimal(string: "-500")!)
            ),
            status: MonthStatus(isPositive: false, net: Money(amount: Decimal(string: "-500")!))
        )

        let snapshot = WidgetSnapshotMapper.financialMoment(detail)

        XCTAssertFalse(snapshot.isNetPositive)
        XCTAssertTrue(snapshot.isOverBudget)
        XCTAssertTrue(snapshot.payableIsClear)
        XCTAssertEqual(snapshot.payableSubtitle, "Nada pendente")
        XCTAssertEqual(snapshot.netSubtitle, "Déficit")
        XCTAssertFalse(snapshot.netLabel.hasPrefix("+"))
        XCTAssertEqual(snapshot.utilizationPercent, 100)
    }

    func testStoreRoundTripAndClear() {
        let suite = "financial.widget.test.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else {
            XCTFail("Could not create test defaults")
            return
        }
        defaults.removePersistentDomain(forName: suite)
        let store = FinancialMomentWidgetStore(defaults: defaults)

        XCTAssertNil(store.load())
        store.save(.preview)
        let loaded = store.load()
        XCTAssertEqual(loaded?.monthKey, FinancialMomentWidgetSnapshot.preview.monthKey)
        XCTAssertEqual(loaded?.netLabel, FinancialMomentWidgetSnapshot.preview.netLabel)
        XCTAssertEqual(loaded?.unpaidBillsCount, 2)
        XCTAssertTrue(store.isAuthenticated())

        store.clear()
        XCTAssertNil(store.load())
        XCTAssertFalse(store.isAuthenticated())

        store.setAuthenticated(true)
        XCTAssertTrue(store.isAuthenticated())
        store.setAuthenticated(false)
        XCTAssertFalse(store.isAuthenticated())
        XCTAssertNil(store.load())
        defaults.removePersistentDomain(forName: suite)
    }
}

