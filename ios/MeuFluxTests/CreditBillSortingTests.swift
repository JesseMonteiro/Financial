import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData
@testable import CreditCards

final class CreditBillSortingTests: XCTestCase {

    private func makeLine(
        id: String,
        accountId: String = "acc-inter",
        accountName: String = "Inter Lucas",
        description: String,
        amount: Decimal,
        date: String? = nil,
        installmentNumber: Int? = nil,
        installmentTotal: Int? = nil
    ) -> CreditBillLine {
        CreditBillLine(
            id: id,
            accountId: accountId,
            accountName: accountName,
            description: description,
            amount: Money(amount: amount),
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false,
            category: "Shopping",
            purchaseDate: date.flatMap(InstantDate.init(isoString:)),
            installmentNumber: installmentNumber,
            installmentTotal: installmentTotal
        )
    }

    func testCompareByPurchaseDateNewestFirst() {
        let pOld = makeLine(id: "tx-1", description: "Farmácia", amount: 50, date: "2026-08-10")
        let pMid = makeLine(id: "tx-2", description: "Supermercado", amount: 150, date: "2026-08-25")
        let pNew = makeLine(id: "tx-3", description: "Restaurante", amount: 80, date: "2026-09-02")
        let pNoDate = makeLine(id: "tx-4", description: "Tarifa", amount: 10, date: nil)

        let unsorted = [pOld, pNoDate, pNew, pMid]
        let sorted = unsorted.sorted(by: CreditBillLine.compareByPurchaseDateNewestFirst)

        XCTAssertEqual(sorted.map(\.id), ["tx-3", "tx-2", "tx-1", "tx-4"])
    }

    func testSameDateTieBreaksByIdDeterministically() {
        let p1 = makeLine(id: "tx-a", description: "Compra A", amount: 100, date: "2026-09-15")
        let p2 = makeLine(id: "tx-b", description: "Compra B", amount: 100, date: "2026-09-15")

        let sorted = [p2, p1].sorted(by: CreditBillLine.compareByPurchaseDateNewestFirst)
        XCTAssertEqual(sorted.map(\.id), ["tx-a", "tx-b"])
    }

    func testCreditBillBucketInitializesWithSortedItems() {
        let pOld = makeLine(id: "tx-1", description: "Old", amount: 10, date: "2026-08-01")
        let pNew = makeLine(id: "tx-2", description: "New", amount: 20, date: "2026-08-20")

        let bucket = CreditBillBucket(
            dueMonth: "2026-09",
            title: "Setembro",
            type: .currentOpen,
            total: Money(amount: 30),
            dueDateShort: "12/09",
            isPaid: false,
            hasOfficial: false,
            items: [pOld, pNew]
        )

        XCTAssertEqual(bucket.items.map(\.id), ["tx-2", "tx-1"])
    }

    func testDomainMapperSortsBillBucketItemsByPurchaseDate() {
        let dto1 = CreditBillLineDTO(
            id: "tx-1",
            accountId: "acc-inter",
            accountName: "Inter Lucas",
            description: "Old",
            amount: "10.00",
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false,
            category: "Shopping",
            categoryId: nil,
            purchaseDate: "2026-08-01",
            installmentNumber: nil,
            installmentTotal: nil,
            merchantName: nil
        )
        let dto2 = CreditBillLineDTO(
            id: "tx-2",
            accountId: "acc-inter",
            accountName: "Inter Lucas",
            description: "New",
            amount: "20.00",
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false,
            category: "Shopping",
            categoryId: nil,
            purchaseDate: "2026-08-20",
            installmentNumber: nil,
            installmentTotal: nil,
            merchantName: nil
        )
        let bucketDTO = CreditBillBucketDTO(
            dueMonth: "2026-09",
            title: "Setembro",
            type: "CURRENT_OPEN",
            total: "30.00",
            dueDate: "2026-09-12",
            dueDateShort: "12/09",
            isPaid: false,
            hasOfficial: false,
            items: [dto1, dto2]
        )

        let bucket = DomainMapper.creditBillBucket(bucketDTO)
        XCTAssertEqual(bucket.items.map(\.id), ["tx-2", "tx-1"])
    }

    @MainActor
    func testViewModelFilteredLinesAlwaysSortedNewestFirstForInterCards() async {
        let lucasInter = CreditCardSummary(
            id: "inter-lucas",
            name: "Inter Lucas",
            institutionName: "Banco Inter",
            lastFour: "1234",
            outstanding: Money(amount: 3_000),
            openTotal: Money(amount: 1_200)
        )
        let jesseInter = CreditCardSummary(
            id: "inter-jesse",
            name: "Inter Jesse",
            institutionName: "Banco Inter",
            lastFour: "5678",
            outstanding: Money(amount: 2_000),
            openTotal: Money(amount: 800)
        )

        let txL1 = makeLine(id: "l-1", accountId: "inter-lucas", accountName: "Inter Lucas", description: "Padaria", amount: 25, date: "2026-09-01")
        let txL2 = makeLine(id: "l-2", accountId: "inter-lucas", accountName: "Inter Lucas", description: "Óticas Rocha", amount: 70, date: "2026-09-18", installmentNumber: 2, installmentTotal: 10)
        let txL3 = makeLine(id: "l-3", accountId: "inter-lucas", accountName: "Inter Lucas", description: "Mercado Livre", amount: 200, date: "2026-09-10")

        let txJ1 = makeLine(id: "j-1", accountId: "inter-jesse", accountName: "Inter Jesse", description: "Combustível", amount: 100, date: "2026-09-05")
        let txJ2 = makeLine(id: "j-2", accountId: "inter-jesse", accountName: "Inter Jesse", description: "Amazon Prime", amount: 19.90, date: "2026-09-20")

        // Unsorted buckets
        let lucasBucket = CreditBillBucket(
            dueMonth: "2026-10",
            title: "Outubro",
            type: .currentOpen,
            total: Money(amount: 295),
            dueDateShort: "12/10",
            isPaid: false,
            hasOfficial: false,
            items: [txL1, txL2, txL3]
        )
        let jesseBucket = CreditBillBucket(
            dueMonth: "2026-10",
            title: "Outubro",
            type: .currentOpen,
            total: Money(amount: 119.90),
            dueDateShort: "12/10",
            isPaid: false,
            hasOfficial: false,
            items: [txJ1, txJ2]
        )
        let consolidatedBucket = CreditBillBucket(
            dueMonth: "2026-10",
            title: "Outubro",
            type: .currentOpen,
            total: Money(amount: 414.90),
            dueDateShort: "12/10",
            isPaid: false,
            hasOfficial: false,
            items: [txL1, txJ1, txL2, txJ2, txL3]
        )

        struct MockRepo: CreditCardsRepository {
            let screen: CreditCardsScreen
            func fetchScreen(force: Bool) async throws -> CreditCardsScreen { screen }
        }

        let screen = CreditCardsScreen(
            cards: [lucasInter, jesseInter],
            outstandingTotal: Money(amount: 5_000),
            creditLimitTotal: Money(amount: 20_000),
            availableLimitTotal: Money(amount: 15_000),
            periods: [
                CreditCardsScreen.allCardsId: CreditBillPeriod(openDueKey: "2026-10", bills: [consolidatedBucket]),
                "inter-lucas": CreditBillPeriod(openDueKey: "2026-10", bills: [lucasBucket]),
                "inter-jesse": CreditBillPeriod(openDueKey: "2026-10", bills: [jesseBucket]),
            ]
        )

        let viewModel = CreditCardsViewModel(repository: MockRepo(screen: screen))
        await viewModel.load()

        // 1. Consolidated view: all items sorted newest first
        // Dates: 2026-09-20 (j-2), 2026-09-18 (l-2), 2026-09-10 (l-3), 2026-09-05 (j-1), 2026-09-01 (l-1)
        XCTAssertEqual(viewModel.filteredLines.map(\.id), ["j-2", "l-2", "l-3", "j-1", "l-1"])

        // 2. Select Lucas Inter: items sorted newest first
        // Dates: 2026-09-18 (l-2), 2026-09-10 (l-3), 2026-09-01 (l-1)
        viewModel.selectCard("inter-lucas")
        XCTAssertEqual(viewModel.filteredLines.map(\.id), ["l-2", "l-3", "l-1"])

        // 3. Select Jesse Inter: items sorted newest first
        // Dates: 2026-09-20 (j-2), 2026-09-05 (j-1)
        viewModel.selectCard("inter-jesse")
        XCTAssertEqual(viewModel.filteredLines.map(\.id), ["j-2", "j-1"])

        // 4. Searching within Lucas card maintains newest-first order
        viewModel.selectCard("inter-lucas")
        viewModel.searchText = "a" // matches "Padaria", "Óticas Rocha", "Mercado Livre"
        XCTAssertEqual(viewModel.filteredLines.map(\.id), ["l-2", "l-3", "l-1"])
    }
}
