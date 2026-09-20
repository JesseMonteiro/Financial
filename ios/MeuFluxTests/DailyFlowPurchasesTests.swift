import XCTest
@testable import MeuFluxDomain
@testable import Dashboard

final class DailyFlowPurchasesTests: XCTestCase {
    private let day1 = InstantDate(year: 2026, month: 9, day: 15)
    private let day2 = InstantDate(year: 2026, month: 9, day: 14)

    func testPointsOrderPurchasesByAmountDescending() {
        let p1 = DashboardRecentTransaction(
            id: "tx-1",
            description: "Padaria",
            category: "Food",
            date: day1.isoString,
            dateRelative: "Hoje",
            amount: Money(amount: 25),
            isCredit: false,
            isPending: false
        )
        let p2 = DashboardRecentTransaction(
            id: "tx-2",
            description: "Supermercado",
            category: "Groceries",
            date: day1.isoString,
            dateRelative: "Hoje",
            amount: Money(amount: 180),
            isCredit: false,
            isPending: false
        )

        let refDate = day1.date() ?? Date()
        let points = DailyFlowBuilder.points(
            purchases: [p1, p2],
            days: 3,
            now: refDate
        )

        guard let point = points.first(where: { $0.day == day1 }) else {
            XCTFail("Deveria conter o ponto para day1")
            return
        }

        XCTAssertEqual(point.purchases.count, 2)
        XCTAssertEqual(point.topPurchase?.id, "tx-2")
        XCTAssertEqual(point.topPurchase?.amount.amount, 180)
        XCTAssertEqual(point.largestPurchase, 180)
        XCTAssertEqual(point.amount, 205)
    }

    func testPointsSynthesizesTopPurchaseFromSnapshot() {
        let snapPoint = DashboardDailySpendPoint(
            date: day2.isoString,
            amount: 350,
            maxPurchase: 250,
            topPurchaseDescription: "Passagem Aérea",
            topPurchaseCategory: "Travel",
            topPurchaseAmount: 250,
            topPurchaseId: "air-1",
            topPurchaseAccountName: "Azul Visa"
        )

        let refDate = day1.date() ?? Date()
        let points = DailyFlowBuilder.points(
            snapshot: [snapPoint],
            days: 5,
            now: refDate
        )

        guard let point = points.first(where: { $0.day == day2 }) else {
            XCTFail("Deveria conter o ponto para day2")
            return
        }

        XCTAssertEqual(point.amount, 350)
        XCTAssertEqual(point.largestPurchase, 250)
        XCTAssertNotNil(point.topPurchase)
        XCTAssertEqual(point.topPurchase?.description, "Passagem Aérea")
        XCTAssertEqual(point.topPurchase?.category, "Travel")
        XCTAssertEqual(point.topPurchase?.accountName, "Azul Visa")
        XCTAssertEqual(point.topPurchase?.amount.amount, 250)
    }

    @MainActor
    func testDashboardViewModelSelection() {
        let p1 = DashboardRecentTransaction(
            id: "tx-amazon",
            description: "Amazon",
            category: "Shopping",
            date: day1.isoString,
            dateRelative: "Hoje",
            amount: Money(amount: 150),
            isCredit: false,
            isPending: false
        )
        let p2 = DashboardRecentTransaction(
            id: "tx-uber",
            description: "Uber",
            category: "Transport",
            date: day2.isoString,
            dateRelative: "Ontem",
            amount: Money(amount: 35),
            isCredit: false,
            isPending: false
        )

        struct MockUseCase: LoadDashboardUseCase {
            func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
                fatalError("not used")
            }
        }

        let vm = DashboardViewModel(loadDashboard: MockUseCase())

        // By default, no day selected
        XCTAssertNil(vm.selectedDay)
        XCTAssertFalse(vm.isDaySelected)

        // Select day2
        vm.select(day: day2)
        XCTAssertEqual(vm.selectedDay, day2)
        XCTAssertTrue(vm.isDaySelected)

        // Toggling day2 deselects
        vm.select(day: day2)
        XCTAssertNil(vm.selectedDay)
        XCTAssertFalse(vm.isDaySelected)

        // Select day1 then clearSelection
        vm.select(day: day1)
        XCTAssertEqual(vm.selectedDay, day1)
        vm.clearSelection()
        XCTAssertNil(vm.selectedDay)
    }
}
