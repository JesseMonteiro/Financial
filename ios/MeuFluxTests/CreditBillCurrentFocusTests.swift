import XCTest
@testable import MeuFluxDomain
@testable import CreditCards

final class CreditBillCurrentFocusTests: XCTestCase {
    private func date(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        return cal.date(from: comps)!
    }

    func testWhenCurrentMonthBillIsPaidFocusAdvancesToNextOpenBill() {
        let refDate = date(year: 2026, month: 9, day: 20)
        let period = CreditBillPeriod(
            openDueKey: "2026-10",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-08",
                    title: "Agosto",
                    type: .past,
                    total: Money(amount: 1_000),
                    dueDateShort: "10/08",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 1_500),
                    dueDateShort: "10/09",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .currentOpen,
                    total: Money(amount: 800),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-11",
                    title: "Novembro",
                    type: .future,
                    total: Money(amount: 400),
                    dueDateShort: "10/11",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        // When September is paid, the focus must be the next open bill (October 2026-10)
        XCTAssertEqual(period.resolvedCurrentDueKey(referenceDate: refDate), "2026-10")
    }

    func testWhenCurrentMonthBillIsClosedUnpaidFocusRemainsOnClosedUnpaid() {
        let refDate = date(year: 2026, month: 9, day: 20)
        let period = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-08",
                    title: "Agosto",
                    type: .past,
                    total: Money(amount: 1_000),
                    dueDateShort: "10/08",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 1_500),
                    dueDateShort: "10/09",
                    isPaid: false,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .future,
                    total: Money(amount: 800),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        // When September is closed but unpaid, focus must remain on September (2026-09)
        XCTAssertEqual(period.resolvedCurrentDueKey(referenceDate: refDate), "2026-09")
    }

    func testWhenCurrentMonthBillIsOpenAndUnpaidFocusIsCurrentMonth() {
        let refDate = date(year: 2026, month: 9, day: 5)
        let period = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-08",
                    title: "Agosto",
                    type: .past,
                    total: Money(amount: 1_000),
                    dueDateShort: "10/08",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .currentOpen,
                    total: Money(amount: 1_200),
                    dueDateShort: "10/09",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .future,
                    total: Money(amount: 500),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        XCTAssertEqual(period.resolvedCurrentDueKey(referenceDate: refDate), "2026-09")
    }

    func testWhenOpenDueKeyPointsToPaidBillAdvancesToNextUnpaid() {
        let refDate = date(year: 2026, month: 9, day: 20)
        // Stale openDueKey pointing to September, but September bucket is actually paid
        let period = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 1_500),
                    dueDateShort: "10/09",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .currentOpen,
                    total: Money(amount: 800),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        XCTAssertEqual(period.resolvedCurrentDueKey(referenceDate: refDate), "2026-10")
    }

    @MainActor
    func testViewModelSelectCardPicksCorrectCurrentBillPerCard() async {
        let card1 = CreditCardSummary(
            id: "card-paid",
            name: "Cartão Pago",
            institutionName: "Nubank",
            lastFour: "1111",
            outstanding: .zero,
            openTotal: Money(amount: 800)
        )
        let card2 = CreditCardSummary(
            id: "card-unpaid",
            name: "Cartão Pendente",
            institutionName: "Itaú",
            lastFour: "2222",
            outstanding: Money(amount: 1_500),
            openTotal: Money(amount: 1_500)
        )

        let periodPaid = CreditBillPeriod(
            openDueKey: "2026-10",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 1_500),
                    dueDateShort: "10/09",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .currentOpen,
                    total: Money(amount: 800),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        let periodUnpaid = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 1_500),
                    dueDateShort: "10/09",
                    isPaid: false,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .future,
                    total: Money(amount: 600),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        let consolidatedPeriod = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .past,
                    total: Money(amount: 3_000),
                    dueDateShort: "10/09",
                    isPaid: false,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .currentOpen,
                    total: Money(amount: 1_400),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )

        struct MockRepo: CreditCardsRepository {
            let screen: CreditCardsScreen
            func fetchScreen(force: Bool) async throws -> CreditCardsScreen { screen }
        }

        let screen = CreditCardsScreen(
            cards: [card1, card2],
            outstandingTotal: Money(amount: 1_500),
            creditLimitTotal: Money(amount: 10_000),
            availableLimitTotal: Money(amount: 8_500),
            periods: [
                CreditCardsScreen.allCardsId: consolidatedPeriod,
                "card-paid": periodPaid,
                "card-unpaid": periodUnpaid,
            ]
        )

        let viewModel = CreditCardsViewModel(repository: MockRepo(screen: screen))
        await viewModel.load()

        // Consolidated has an unpaid September bill -> active is 2026-09
        XCTAssertEqual(viewModel.activeBillKey, "2026-09")
        XCTAssertTrue(viewModel.isViewingCurrentBill)

        // Switching to card-paid (which already has September paid) should land on October (2026-10)
        viewModel.selectCard("card-paid")
        XCTAssertEqual(viewModel.activeBillKey, "2026-10")
        XCTAssertEqual(viewModel.currentBillKey, "2026-10")
        XCTAssertTrue(viewModel.isViewingCurrentBill)

        // Switching to card-unpaid (which has September unpaid) should land on September (2026-09)
        viewModel.selectCard("card-unpaid")
        XCTAssertEqual(viewModel.activeBillKey, "2026-09")
        XCTAssertEqual(viewModel.currentBillKey, "2026-09")
        XCTAssertTrue(viewModel.isViewingCurrentBill)

        // Navigating to October on card-unpaid
        viewModel.selectBill("2026-10")
        XCTAssertEqual(viewModel.activeBillKey, "2026-10")
        XCTAssertFalse(viewModel.isViewingCurrentBill)

        // Clicking "Fatura atual" resets to September
        viewModel.selectCurrentBill()
        XCTAssertEqual(viewModel.activeBillKey, "2026-09")
        XCTAssertTrue(viewModel.isViewingCurrentBill)
    }
}
