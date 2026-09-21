import XCTest
@testable import MeuFluxDomain

final class LineItemDetailTests: XCTestCase {
    private let date = InstantDate(year: 2026, month: 9, day: 15)

    func testOpenFinanceTransactionIsViewOnly() {
        let tx = Transaction(
            id: "tx-1",
            accountId: "acc-1",
            description: "Uber",
            amount: Money(amount: 32),
            date: date,
            category: "Taxi and ride-hailing",
            kind: .debit
        )
        let detail = LineItemDetail.from(transaction: tx, accountName: "Nubank")
        XCTAssertEqual(detail.kind, .openFinanceTransaction)
        XCTAssertTrue(detail.capabilities.contains(.changeCategory))
        XCTAssertFalse(detail.capabilities.contains(.togglePaid))
        XCTAssertFalse(detail.capabilities.contains(.edit))
        XCTAssertFalse(detail.capabilities.contains(.delete))
        XCTAssertFalse(detail.capabilities.contains(.createReceivable))
    }

    func testManualExpenseCanToggleEditAndDelete() {
        let expense = ManualExpense(
            id: "man-1",
            description: "Aluguel",
            amount: Money(amount: 1_800),
            date: date,
            category: "Rent"
        )
        let detail = LineItemDetail.from(expense: expense, accountName: "Carteira")
        XCTAssertEqual(detail.kind, .manualExpense)
        XCTAssertTrue(detail.capabilities.contains(.togglePaid))
        XCTAssertTrue(detail.capabilities.contains(.edit))
        XCTAssertTrue(detail.capabilities.contains(.delete))
        XCTAssertTrue(detail.capabilities.contains(.changeCategory))
        XCTAssertFalse(detail.capabilities.contains(.createReceivable))
        XCTAssertEqual(detail.paidActionTitle, "Marcar como paga")
    }

    func testReceivableCanMarkReceivedUntilPaid() {
        let pending = Receivable(
            id: "rec-1",
            description: "Reembolso jantar",
            amount: Money(amount: 90),
            dueDate: date,
            counterparty: "Ana",
            installmentHistory: [
                ReceivableInstallment(
                    installmentNumber: 1,
                    amount: Money(amount: 90),
                    dueDate: date
                )
            ]
        )
        let open = LineItemDetail.from(receivable: pending)
        XCTAssertTrue(open.capabilities.contains(.togglePaid))
        XCTAssertTrue(open.capabilities.contains(.edit))
        XCTAssertTrue(open.capabilities.contains(.delete))
        XCTAssertEqual(open.paidActionTitle, "Marcar recebido")

        var paid = pending
        paid.installmentHistory[0].paidAt = date
        paid.isReceived = true
        let settled = LineItemDetail.from(receivable: paid)
        XCTAssertFalse(settled.capabilities.contains(.togglePaid))
        XCTAssertTrue(settled.capabilities.contains(.edit))
        XCTAssertTrue(settled.capabilities.contains(.delete))
    }

    func testCreditPurchaseCanCreateReceivableWhenUnlinked() {
        let line = CreditBillLine(
            id: "bill-1",
            accountId: "card-1",
            accountName: "Inter Black",
            description: "Farmácia",
            amount: Money(amount: 45),
            isCredit: false,
            isPayment: false,
            isProjected: false,
            isPending: false
        )
        let creatable = LineItemDetail.from(billLine: line, canCreateReceivable: true)
        XCTAssertEqual(creatable.kind, .creditBillLine)
        XCTAssertTrue(creatable.capabilities.contains(.createReceivable))
        XCTAssertTrue(creatable.capabilities.contains(.changeCategory))
        XCTAssertFalse(creatable.capabilities.contains(.edit))

        let linked = LineItemDetail.from(billLine: line, canCreateReceivable: false)
        XCTAssertFalse(linked.capabilities.contains(.createReceivable))

        let payment = CreditBillLine(
            id: "pay-1",
            accountId: "card-1",
            accountName: "Inter Black",
            description: "Pagamento recebido",
            amount: Money(amount: 200),
            isCredit: true,
            isPayment: true,
            isProjected: false,
            isPending: false
        )
        let paymentDetail = LineItemDetail.from(billLine: payment, canCreateReceivable: true)
        XCTAssertFalse(paymentDetail.capabilities.contains(.createReceivable))
    }

    func testAgendaCustomUsesManualSourceId() {
        let item = AgendaItem(
            id: "manual_exp-9",
            title: "Academia",
            date: date,
            amount: Money(amount: 120),
            kind: .custom
        )
        let detail = LineItemDetail.from(agenda: item)
        XCTAssertEqual(detail.kind, .manualExpense)
        XCTAssertEqual(detail.sourceId, "exp-9")
        XCTAssertTrue(detail.capabilities.contains(.togglePaid))
        XCTAssertEqual(LineItemDetail.agendaSourceId(item), "exp-9")
    }

    func testInstantDateParsesPluggyISODateTime() {
        let parsed = InstantDate(isoString: "2026-09-15T03:00:00.000Z")
        XCTAssertEqual(parsed?.year, 2026)
        XCTAssertEqual(parsed?.month, 9)
        XCTAssertEqual(parsed?.day, 15)
        XCTAssertEqual(InstantDate(isoString: "2026-09-01")?.isoString, "2026-09-01")
    }

    func testPaymentBillLineIsNotCategoryEligible() {
        let payment = CreditBillLine(
            id: "pay-1",
            accountId: "card-1",
            accountName: "Inter Black",
            description: "Pagamento recebido",
            amount: Money(amount: 200),
            isCredit: true,
            isPayment: true,
            isProjected: false,
            isPending: false
        )
        let detail = LineItemDetail.from(billLine: payment, canCreateReceivable: true)
        XCTAssertFalse(detail.capabilities.contains(.changeCategory))
    }

    func testCategorySelectionPrefersPluggyIdThenLabel() {
        let tx = Transaction(
            id: "tx-2",
            accountId: "acc-1",
            description: "Ifood",
            amount: Money(amount: 40),
            date: date,
            category: "Eating out",
            categoryId: nil,
            kind: .debit
        )
        let detail = LineItemDetail.from(transaction: tx, accountName: "Nubank")
        let options = [
            LineItemCategoryOption(id: "07010100", label: "Restaurantes"),
            LineItemCategoryOption(id: "07010200", label: "Eating out"),
        ]
        XCTAssertEqual(detail.resolvedCategorySelection(in: options), "07010100")
    }

    func testRecategorizationOptionsReturns23BaseCategoriesWithAlimentacao() {
        let mockPluggyCats = [
            TransactionCategory(id: "01000000", label: "Income", parentId: nil),
            TransactionCategory(id: "01010000", label: "Salary", parentId: "01000000"),
            TransactionCategory(id: "07000000", label: "Food and drinks", parentId: nil),
            TransactionCategory(id: "07010000", label: "Eating out", parentId: "07000000"),
        ]
        let options = LineItemCategoryOption.recategorizationOptions(pluggyCategories: mockPluggyCats)
        // Must contain strictly the 23 Level 1 categories
        XCTAssertEqual(options.count, 23)
        // Must NOT contain leaf subcategories
        XCTAssertFalse(options.contains(where: { $0.id == "01010000" }))
        XCTAssertFalse(options.contains(where: { $0.id == "07010000" }))
        // Must contain Alimentação resolved to 07000000
        let food = options.first(where: { $0.key == "Food and drinks" || $0.label == "Alimentação" })
        XCTAssertNotNil(food)
        XCTAssertEqual(food?.label, "Alimentação")
        XCTAssertEqual(food?.id, "07000000")
    }

    func testRecategorizationOptionsCombinesCustomCategories() {
        let customCategories = [
            PurchaseCategory(id: "cust-1", key: "PetsAndVet", label: "Pets e Veterinário", color: "#ff0055", sortOrder: 0),
        ]
        let options = LineItemCategoryOption.recategorizationOptions(
            pluggyCategories: [],
            purchaseCategories: PurchaseCategoryCatalog.defaults + customCategories
        )
        XCTAssertEqual(options.count, 24) // 1 custom + 23 base
        XCTAssertTrue(options.contains(where: { $0.id == "PetsAndVet" && $0.label == "Pets e Veterinário" }))
        XCTAssertTrue(options.contains(where: { $0.label == "Alimentação" }))
    }

    func testResolvedCategorySelectionResolvesSubcategoryToBaseCategory() {
        let tx = Transaction(
            id: "tx-3",
            accountId: "acc-1",
            description: "Restaurante",
            amount: Money(amount: 55),
            date: date,
            category: "Eating out",
            categoryId: "07010100",
            kind: .debit
        )
        let detail = LineItemDetail.from(transaction: tx, accountName: "Nubank")
        let baseOptions = [
            LineItemCategoryOption(id: "07000000", label: "Alimentação", key: "Food and drinks"),
            LineItemCategoryOption(id: "04000000", label: "Transporte", key: "Transportation"),
        ]
        // "Eating out" must resolve to base category "Alimentação" (07000000)
        XCTAssertEqual(detail.resolvedCategorySelection(in: baseOptions), "07000000")
    }

    func testTranslatedCategoryFoodAndDrinksIsAlimentacao() {
        XCTAssertEqual(LineItemDetail.translatedCategory("Food and drinks"), "Alimentação")
        XCTAssertEqual(LineItemDetail.translatedCategory("Comida e bebidas"), "Alimentação")
        XCTAssertEqual(LineItemDetail.translatedCategory("Food"), "Alimentação")
        XCTAssertEqual(LineItemDetail.translatedCategory("Groceries"), "Supermercado")
    }
}
