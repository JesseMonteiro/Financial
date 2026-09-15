import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData

final class PurchaseCategoryTests: XCTestCase {
    func testDefaultCatalogHasNineStableKeys() {
        let keys = PurchaseCategoryCatalog.defaults.map(\.key)
        XCTAssertEqual(keys.count, 9)
        XCTAssertEqual(
            Set(keys),
            Set(["Food", "Groceries", "Rent", "Utilities", "Transport", "Entertainment", "Health", "Education", "Other"])
        )
    }

    func testResolvedFallsBackToDefaultsWhenEmpty() {
        let resolved = PurchaseCategoryCatalog.resolved([])
        XCTAssertEqual(resolved.map(\.key), PurchaseCategoryCatalog.defaults.map(\.key))
    }

    func testSlugifyAvoidsCollisions() {
        let first = PurchaseCategoryCatalog.slugify("Alimentação", existingKeys: [])
        XCTAssertEqual(first, "Alimentacao")
        let second = PurchaseCategoryCatalog.slugify("Alimentação", existingKeys: [first])
        XCTAssertEqual(second, "Alimentacao2")
    }

    func testManualOptionsUsePurchaseCategories() {
        let custom = [
            PurchaseCategory(id: "1", key: "Pets", label: "Pets", color: "#111111", sortOrder: 0),
        ]
        let options = LineItemCategoryOption.manualOptions(custom)
        XCTAssertEqual(options.map(\.id), ["Pets"])
        XCTAssertEqual(options.map(\.label), ["Pets"])
    }

    func testDomainMapperPurchaseCategory() {
        let json = """
        {"id":"cat-1","key":"Food","label":"Alimentação","color":"#f97316","sort_order":3}
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let dto = try! decoder.decode(DomainPurchaseCategoryRowDTO.self, from: json)
        let mapped = DomainMapper.purchaseCategory(dto)
        XCTAssertEqual(mapped.id, "cat-1")
        XCTAssertEqual(mapped.key, "Food")
        XCTAssertEqual(mapped.label, "Alimentação")
        XCTAssertEqual(mapped.color, "#f97316")
        XCTAssertEqual(mapped.sortOrder, 3)
    }
}
