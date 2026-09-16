import XCTest
@testable import MeuFluxCore
@testable import MeuFluxData
@testable import MeuFluxDomain

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

    func testAppAndWidgetEntitlementsShareAppGroup() throws {
        let testsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let iosDir = testsDir.deletingLastPathComponent()
        let files = [
            iosDir.appendingPathComponent("MeuFluxApp/MeuFlux.entitlements"),
            iosDir.appendingPathComponent("MeuFluxWidgets/MeuFluxWidgets.entitlements"),
        ]
        XCTAssertEqual(AppGroup.identifier, "group.com.meuflux.app")
        for url in files {
            let data = try Data(contentsOf: url)
            let plist = try PropertyListSerialization.propertyList(from: data, format: nil)
            let dict = try XCTUnwrap(plist as? [String: Any], url.lastPathComponent)
            let groups = try XCTUnwrap(
                dict["com.apple.security.application-groups"] as? [String],
                "\(url.lastPathComponent) missing application-groups"
            )
            XCTAssertTrue(
                groups.contains(AppGroup.identifier),
                "\(url.lastPathComponent) must include \(AppGroup.identifier)"
            )
        }
    }

    func testJointMapperUsesMembersAndTotals() {
        let month = YearMonth(year: 2026, month: 9)
        let detail = FinancialMomentDetail(
            selectedMonth: month,
            salary: Money(amount: Decimal(string: "18000")!),
            receivables: ReceivablesSummary(items: [], total: .zero),
            creditCards: CreditCardsSummary(bills: [], total: .zero),
            automaticDebits: AutomaticDebitsSummary(items: [], total: .zero),
            manualExpenses: ManualExpensesSummary(items: [], total: .zero),
            totals: FinancialTotals(
                income: Money(amount: Decimal(string: "18000")!),
                expenses: Money(amount: Decimal(string: "12400")!),
                accountsPayable: Money(amount: Decimal(string: "2100")!),
                netBalance: Money(amount: Decimal(string: "5600")!)
            ),
            status: MonthStatus(isPositive: true, net: Money(amount: Decimal(string: "5600")!))
        )
        let snapshot = JointMomentSnapshot(
            link: JointLink(id: "l1", status: "active", partnerDisplayName: "Ana"),
            members: [
                JointMember(id: "u1", displayName: "Você", salary: Money(amount: Decimal(string: "10000")!), isCurrentUser: true),
                JointMember(id: "u2", displayName: "Ana", salary: Money(amount: Decimal(string: "8000")!), isCurrentUser: false),
            ],
            detail: detail
        )
        let now = Date(timeIntervalSince1970: 1_789_286_400)
        let widget = WidgetSnapshotMapper.jointFinance(snapshot, now: now)

        XCTAssertTrue(widget.hasActiveLink)
        XCTAssertEqual(widget.membersLabel, "Você · Ana")
        XCTAssertEqual(widget.memberCount, 2)
        XCTAssertEqual(widget.monthKey, "2026-09")
        XCTAssertTrue(widget.netLabel.hasPrefix("+"))
        XCTAssertTrue(widget.isNetPositive)
        XCTAssertFalse(widget.payableIsClear)
        XCTAssertEqual(widget.updatedAt, now)
    }

    func testBudgetMapperTotalsTopCategoriesAndOverspend() {
        let month = YearMonth(year: 2026, month: 9)
        let supermarket = BudgetLimit(
            id: "1",
            category: "Supermercado",
            limit: Money(amount: Decimal(string: "1000")!),
            spent: Money(amount: Decimal(string: "1200")!),
            month: month
        )
        let restaurants = BudgetLimit(
            id: "2",
            category: "Restaurantes",
            limit: Money(amount: Decimal(string: "800")!),
            spent: Money(amount: Decimal(string: "400")!),
            month: month
        )
        let noMeta = BudgetLimit(
            id: "3",
            category: "Outros",
            limit: .zero,
            spent: Money(amount: Decimal(string: "50")!),
            month: month,
            hasLimit: false
        )
        let now = Date(timeIntervalSince1970: 1_789_286_400)
        let widget = WidgetSnapshotMapper.budget(
            [supermarket, restaurants, noMeta],
            month: month,
            now: now
        )

        XCTAssertTrue(widget.hasLimits)
        XCTAssertEqual(widget.categoriesWithBudget, 2)
        XCTAssertEqual(widget.overBudgetCount, 1)
        XCTAssertFalse(widget.isOverBudget)
        XCTAssertEqual(widget.remainingSubtitle, "Dentro da verba")
        XCTAssertEqual(widget.utilizationPercent, 92)
        XCTAssertEqual(widget.topCategories.first?.name, "Supermercado")
        XCTAssertTrue(widget.topCategories.first?.isOver == true)
        XCTAssertEqual(widget.topCategories.count, 2)
        XCTAssertEqual(widget.updatedAt, now)
        XCTAssertFalse(widget.spentLabel.contains("—"))
    }

    func testBudgetMapperWithoutLimits() {
        let month = YearMonth(year: 2026, month: 1)
        let widget = WidgetSnapshotMapper.budget([], month: month)
        XCTAssertFalse(widget.hasLimits)
        XCTAssertEqual(widget.limitLabel, "R$ —")
        XCTAssertEqual(widget.remainingSubtitle, "Defina metas nas categorias")
        XCTAssertEqual(widget.utilizationPercent, 0)
        XCTAssertTrue(widget.topCategories.isEmpty)
    }

    func testJointAndBudgetStoresRoundTrip() {
        let suite = "financial.widget.extra.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else {
            XCTFail("Could not create test defaults")
            return
        }
        defaults.removePersistentDomain(forName: suite)

        let jointStore = JointFinanceWidgetStore(defaults: defaults)
        XCTAssertNil(jointStore.load())
        jointStore.save(.preview)
        XCTAssertEqual(jointStore.load()?.membersLabel, JointFinanceWidgetSnapshot.preview.membersLabel)
        XCTAssertTrue(jointStore.isAuthenticated())
        jointStore.save(.inactive())
        XCTAssertEqual(jointStore.load()?.hasActiveLink, false)
        jointStore.clear()
        XCTAssertNil(jointStore.load())

        let budgetStore = BudgetWidgetStore(defaults: defaults)
        budgetStore.save(.preview)
        XCTAssertEqual(budgetStore.load()?.overBudgetCount, 1)
        XCTAssertEqual(budgetStore.load()?.topCategories.count, 2)
        budgetStore.clear()
        XCTAssertNil(budgetStore.load())
        defaults.removePersistentDomain(forName: suite)
    }

    func testWidgetKindAndDeepLinks() {
        XCTAssertEqual(WidgetKind.allTimelineKinds.count, 3)
        XCTAssertTrue(WidgetKind.allTimelineKinds.contains(WidgetKind.jointFinance))
        XCTAssertTrue(WidgetKind.allTimelineKinds.contains(WidgetKind.budget))
        XCTAssertEqual(WidgetDeepLink.jointFinance.absoluteString, "meuflux://joint-account")
        XCTAssertEqual(WidgetDeepLink.budget.absoluteString, "meuflux://budget")
    }
}

