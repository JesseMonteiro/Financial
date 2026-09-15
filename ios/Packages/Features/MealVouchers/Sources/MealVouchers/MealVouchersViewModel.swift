import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class MealVouchersViewModel {
    public private(set) var state: FeatureLoadState<[MealBenefit]> = .idle
    public private(set) var benefits: [MealBenefit] = []
    public var errorMessage: String?

    public var draftKind: MealBenefitKind = .va
    public var draftLabel = ""
    public var draftMonthly = ""
    public var draftCreditDay = "1"
    public var draftStartsOn = Date()
    public var draftOpening = ""
    public var draftShowInMoment = false
    public var editingBenefitId: String?

    public var purchaseBenefitId: String?
    public var draftPurchaseDescription = ""
    public var draftPurchaseAmount = ""
    public var draftPurchaseDate = Date()
    public var draftPurchaseCategory = MealBenefitKind.va.defaultBudgetCategory

    private let repository: (any MealBenefitsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any MealBenefitsRepository)? = nil) {
        self.repository = repository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "meal-benefits"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
            state = .empty
            return
        }
        do {
            benefits = try await repository.fetchBenefits(force: force)
            state = benefits.isEmpty ? .empty : .loaded(benefits)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func beginCreate() {
        editingBenefitId = nil
        draftKind = .va
        draftLabel = ""
        draftMonthly = ""
        draftCreditDay = "1"
        draftStartsOn = Date()
        draftOpening = ""
        draftShowInMoment = false
    }

    public func beginEdit(_ benefit: MealBenefit) {
        editingBenefitId = benefit.id
        draftKind = benefit.kind
        draftLabel = benefit.label
        draftMonthly = NSDecimalNumber(decimal: benefit.monthlyAmount.amount).stringValue
        draftCreditDay = String(benefit.creditDay)
        draftStartsOn = benefit.startsOn.date() ?? Date()
        draftOpening = NSDecimalNumber(decimal: benefit.openingBalance.amount).stringValue
        draftShowInMoment = benefit.showInMoment
    }

    public func saveDraft() async {
        guard let repository else { return }
        let monthly = Decimal(string: draftMonthly.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard monthly > 0 else {
            errorMessage = "Informe o valor mensal do benefício."
            return
        }
        let opening = Decimal(string: draftOpening.replacingOccurrences(of: ",", with: ".")) ?? 0
        let day = min(31, max(1, Int(draftCreditDay) ?? 1))
        let benefit = MealBenefit(
            id: editingBenefitId ?? UUID().uuidString,
            kind: draftKind,
            label: draftLabel.trimmingCharacters(in: .whitespacesAndNewlines),
            monthlyAmount: Money(amount: monthly),
            creditDay: day,
            startsOn: InstantDate(from: draftStartsOn),
            openingBalance: Money(amount: opening),
            showInMoment: draftShowInMoment
        )
        do {
            try await repository.saveBenefit(benefit)
            editingBenefitId = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func toggleShowInMoment(_ benefit: MealBenefit, on: Bool) async {
        guard let repository else { return }
        var next = benefit
        next.showInMoment = on
        do {
            try await repository.saveBenefit(next)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ benefit: MealBenefit) async {
        guard let repository else { return }
        do {
            try await repository.deleteBenefit(id: benefit.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func beginPurchase(for benefit: MealBenefit) {
        purchaseBenefitId = benefit.id
        draftPurchaseDescription = ""
        draftPurchaseAmount = ""
        draftPurchaseDate = Date()
        draftPurchaseCategory = benefit.kind.defaultBudgetCategory
    }

    public func savePurchase() async {
        guard let repository, let benefitId = purchaseBenefitId else { return }
        let amount = Decimal(string: draftPurchaseAmount.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard amount > 0 else {
            errorMessage = "Informe o valor da compra."
            return
        }
        let purchase = MealBenefitPurchase(
            id: UUID().uuidString,
            benefitId: benefitId,
            amount: Money(amount: amount),
            purchasedAt: InstantDate(from: draftPurchaseDate),
            description: draftPurchaseDescription.trimmingCharacters(in: .whitespacesAndNewlines),
            category: draftPurchaseCategory
        )
        do {
            try await repository.savePurchase(purchase)
            purchaseBenefitId = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func deletePurchase(_ purchase: MealBenefitPurchase) async {
        guard let repository else { return }
        do {
            try await repository.deletePurchase(id: purchase.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func snapshot(for benefit: MealBenefit) -> MealBenefitMonthSnapshot {
        MealBenefitBalance.monthSnapshot(benefit: benefit, yearMonth: YearMonth(from: Date()))
    }
}
