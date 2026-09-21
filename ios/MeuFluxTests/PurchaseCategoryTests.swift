import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData

final class PurchaseCategoryTests: XCTestCase {
    func testDefaultCatalogHasNineStableKeys() {
        let keys = PurchaseCategoryCatalog.defaults.map(\.key)
        XCTAssertEqual(keys.count, 23)
        XCTAssertTrue(keys.contains("Food and drinks"))
        XCTAssertTrue(keys.contains("Transportation"))
        XCTAssertTrue(keys.contains("Housing"))
        XCTAssertTrue(keys.contains("Income"))
        XCTAssertTrue(keys.contains("Other"))
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
        XCTAssertEqual(mapped.icon, "utensils") // default for Food when missing
    }

    func testDomainMapperPurchaseCategoryWithIcon() {
        let json = """
        {"id":"cat-2","key":"Pets","label":"Pets","color":"#111111","icon":"pawprint","sort_order":1}
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let dto = try! decoder.decode(DomainPurchaseCategoryRowDTO.self, from: json)
        let mapped = DomainMapper.purchaseCategory(dto)
        XCTAssertEqual(mapped.icon, "pawprint")
    }

    func testIconCatalogHasStableDefaults() {
        XCTAssertEqual(CategoryIconCatalog.defaultIconId(for: .food), "utensils")
        XCTAssertEqual(PurchaseCategoryCatalog.systemImage(for: "Food"), "fork.knife")
        let custom = [PurchaseCategory(id: "1", key: "Food", label: "Comida", color: "#f97316", icon: "cup", sortOrder: 0)]
        XCTAssertEqual(PurchaseCategoryCatalog.systemImage(for: "Food", in: custom), "cup.and.saucer.fill")
    }
}
