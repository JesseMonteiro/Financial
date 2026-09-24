import XCTest
@testable import MeuFluxDomain

final class BudgetPeriodTests: XCTestCase {
    func testPeriodTitlesAndUnits() {
        XCTAssertEqual(BudgetPeriod.daily.title, "Diária")
        XCTAssertEqual(BudgetPeriod.weekly.unitLabel, "/semana")
        XCTAssertEqual(BudgetPeriod.biweekly.progressLabel(index: 1, count: 2), "quinzena 1 de 2")
        XCTAssertEqual(BudgetPeriod.monthly.progressLabel(index: 1, count: 1), "mês")
    }

    func testMealKindDefaultCategories() {
        XCTAssertEqual(MealBenefitKind.va.defaultBudgetCategory, "Supermercado & Alimentação")
        XCTAssertEqual(MealBenefitKind.vr.defaultBudgetCategory, "Restaurantes & Bares")
        XCTAssertTrue(MealBenefitKind.budgetCategoryOptions.contains("Delivery de Comida"))
    }

    func testCategoryKeyResolutionAndLabels() {
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Supermercado & Alimentação"), "Groceries")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Supermercados"), "Groceries")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("supermercado"), "Groceries")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Groceries"), "Groceries")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Alimentação"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Eating out"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Restaurantes & Bares"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Habitação"), "Housing")
        XCTAssertEqual(BudgetCategoryCatalog.resolveBudgetCategoryKey("Lazer"), "Leisure")

        XCTAssertEqual(BudgetCategoryCatalog.label(forBaseKey: "Groceries"), "Supermercados")
        XCTAssertEqual(BudgetCategoryCatalog.label(forBaseKey: "Food and drinks"), "Alimentação")
    }

    func testBudgetLimitTransactionsAndSync() {
        let tx1 = BudgetTransactionItem(
            id: "tx-1",
            description: "DEBITO ENERGIA",
            date: InstantDate(year: 2026, month: 9, day: 11),
            amount: Money(amount: 141.10),
            isMeal: false,
            accountName: "Banco Santander",
            subCategoryLabel: "Electricity"
        )
        var limit = BudgetLimit(
            id: "Housing",
            category: "Housing",
            limit: Money(amount: 2500),
            spent: .zero,
            month: YearMonth(year: 2026, month: 9),
            categoryLabel: "Habitação",
            transactions: [tx1]
        )
        XCTAssertEqual(limit.spent.amount, 0)
        XCTAssertEqual(limit.transactions.count, 1)

        // Simulating sync
        let total = limit.transactions.reduce(Decimal.zero) { $0 + $1.amount.amount }
        limit.spent = Money(amount: total)
        XCTAssertEqual(limit.spent.amount, 141.10)
    }

    func testHierarchicalCategoriesAndSubcategoryMatching() {
        // Hierarchy structure
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Groceries"))
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Supermercados"))
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Eating out"))
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Restaurantes & Bares"))
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Rent"))
        XCTAssertTrue(BudgetCategoryCatalog.isSubcategory("Aluguel"))
        XCTAssertFalse(BudgetCategoryCatalog.isSubcategory("Food and drinks"))
        XCTAssertFalse(BudgetCategoryCatalog.isSubcategory("Alimentação"))
        XCTAssertFalse(BudgetCategoryCatalog.isSubcategory("Housing"))

        // Parent resolution
        XCTAssertEqual(BudgetCategoryCatalog.parentBaseKey(forSubcategory: "Groceries"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.parentLabel(forSubcategory: "Groceries"), "Alimentação")
        XCTAssertEqual(BudgetCategoryCatalog.parentBaseKey(forSubcategory: "Supermercados"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.parentLabel(forSubcategory: "Supermercados"), "Alimentação")
        XCTAssertEqual(BudgetCategoryCatalog.parentBaseKey(forSubcategory: "Eating out"), "Food and drinks")
        XCTAssertEqual(BudgetCategoryCatalog.parentLabel(forSubcategory: "Eating out"), "Alimentação")
        XCTAssertEqual(BudgetCategoryCatalog.parentBaseKey(forSubcategory: "Rent"), "Housing")
        XCTAssertEqual(BudgetCategoryCatalog.parentLabel(forSubcategory: "Rent"), "Habitação")

        // Subcategory matching: subcategory budget only matches matching subcategory transactions
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Groceries", forBudgetCategory: "Groceries"))
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Supermercados", forBudgetCategory: "Groceries"))
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Supermercados", forBudgetCategory: "Supermercados"))
        XCTAssertFalse(BudgetCategoryCatalog.matches(transactionCategory: "Eating out", forBudgetCategory: "Groceries"))
        XCTAssertFalse(BudgetCategoryCatalog.matches(transactionCategory: "Rent", forBudgetCategory: "Groceries"))

        // Base category matching: base category budget matches all its subcategories
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Food and drinks", forBudgetCategory: "Food and drinks"))
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Groceries", forBudgetCategory: "Food and drinks"))
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Eating out", forBudgetCategory: "Food and drinks"))
        XCTAssertTrue(BudgetCategoryCatalog.matches(transactionCategory: "Food delivery", forBudgetCategory: "Food and drinks"))
        XCTAssertFalse(BudgetCategoryCatalog.matches(transactionCategory: "Rent", forBudgetCategory: "Food and drinks"))

        // BudgetLimit attributes for subcategories
        let subLimit = BudgetLimit(
            id: "Groceries",
            category: "Groceries",
            limit: Money(amount: 1500),
            spent: Money(amount: 300),
            month: YearMonth(year: 2026, month: 9),
            isSubcategory: true,
            parentCategoryLabel: "Alimentação"
        )
        XCTAssertTrue(subLimit.isSubcategory)
        XCTAssertEqual(subLimit.parentCategoryLabel, "Alimentação")
        XCTAssertEqual(subLimit.displayLabel, "Supermercados")
    }
}

