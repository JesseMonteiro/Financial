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
}
