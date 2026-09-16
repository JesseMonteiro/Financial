import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class CategoriesViewModel {
    public private(set) var state: FeatureLoadState<[PurchaseCategory]> = .idle
    public private(set) var categories: [PurchaseCategory] = []
    public var errorMessage: String?
    public var draftLabel = ""
    public var draftColor = PurchaseCategoryCatalog.presetColors[0]
    public var draftIcon = CategoryIconCatalog.defaultIconId(for: .other)
    public var editingID: String?

    private let repository: (any PurchaseCategoriesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any PurchaseCategoriesRepository)? = nil) {
        self.repository = repository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "purchase-categories"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
            categories = PurchaseCategoryCatalog.defaults
            state = .loaded(categories)
            return
        }
        do {
            categories = try await repository.fetchCategories(force: force)
            if categories.isEmpty {
                categories = PurchaseCategoryCatalog.defaults
            }
            state = categories.isEmpty ? .empty : .loaded(categories)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if categories.isEmpty {
                categories = PurchaseCategoryCatalog.defaults
                state = .loaded(categories)
            } else if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func beginCreate() {
        editingID = nil
        draftLabel = ""
        draftColor = PurchaseCategoryCatalog.presetColors[0]
        draftIcon = "tag"
    }

    public func beginEdit(_ category: PurchaseCategory) {
        editingID = category.id
        draftLabel = category.label
        draftColor = category.color ?? PurchaseCategoryCatalog.presetColors[0]
        draftIcon = category.icon
            ?? CategoryIconCatalog.defaultIconId(forKey: category.key)
    }

    public func saveDraft() async {
        guard let repository else { return }
        let label = draftLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !label.isEmpty else {
            errorMessage = "Informe o nome da categoria."
            return
        }

        let category: PurchaseCategory
        if let editingID, let existing = categories.first(where: { $0.id == editingID }) {
            category = PurchaseCategory(
                id: existing.id,
                key: existing.key,
                label: label,
                color: draftColor,
                icon: draftIcon,
                sortOrder: existing.sortOrder
            )
        } else {
            let key = PurchaseCategoryCatalog.slugify(label, existingKeys: categories.map(\.key))
            let nextOrder = (categories.map(\.sortOrder).max() ?? -1) + 1
            category = PurchaseCategory(
                id: UUID().uuidString,
                key: key,
                label: label,
                color: draftColor,
                icon: draftIcon,
                sortOrder: nextOrder
            )
        }

        do {
            try await repository.saveCategory(category)
            draftLabel = ""
            editingID = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ category: PurchaseCategory) async {
        guard let repository else { return }
        do {
            try await repository.deleteCategory(id: category.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
