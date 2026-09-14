import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class CreditCardsViewModel {
    public private(set) var state: FeatureLoadState<CreditCardsScreen> = .idle
    public private(set) var screen: CreditCardsScreen?
    public var selectedCardId: String = CreditCardsScreen.allCardsId
    public var selectedBillKey: String?
    public var searchText: String = ""
    public var errorMessage: String?

    private let repository: any CreditCardsRepository
    private let manuals: (any ManualExpensesRepository)?
    private let parseBillUseCase: (any ParseBillUseCase)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public var purchaseDescription = ""
    public var purchaseAmount = ""
    public var purchaseDate = Date()
    public var parsedBill: ParsedBill?
    public var includedPurchaseIDs: Set<String> = []
    public var parseError: String?

    public init(
        repository: any CreditCardsRepository = StubCreditCardsRepository(),
        manuals: (any ManualExpensesRepository)? = nil,
        parseBill: (any ParseBillUseCase)? = nil
    ) {
        self.repository = repository
        self.manuals = manuals
        self.parseBillUseCase = parseBill
    }

    public var isAllCards: Bool { selectedCardId == CreditCardsScreen.allCardsId }

    public var cards: [CreditCardSummary] { screen?.cards ?? [] }

    public var selectedCard: CreditCardSummary? {
        guard !isAllCards else { return nil }
        return cards.first(where: { $0.id == selectedCardId })
    }

    public var period: CreditBillPeriod {
        screen?.period(for: selectedCardId) ?? CreditBillPeriod(openDueKey: nil, bills: [])
    }

    public var activeBillKey: String {
        if let selectedBillKey, period.bills.contains(where: { $0.dueMonth == selectedBillKey }) {
            return selectedBillKey
        }
        if let open = period.openDueKey, period.bills.contains(where: { $0.dueMonth == open }) {
            return open
        }
        return period.bills.first(where: { $0.type == .currentOpen })?.dueMonth
            ?? period.bills.last?.dueMonth
            ?? ""
    }

    public var selectedBill: CreditBillBucket? {
        period.bill(for: activeBillKey)
    }

    public var openBillTotal: Money {
        period.openBill?.total ?? .zero
    }

    public var lastPaidTotal: Money {
        period.lastPaidBill?.total ?? .zero
    }

    public var outstanding: Money {
        if let selectedCard { return selectedCard.outstanding }
        return screen?.outstandingTotal ?? .zero
    }

    public var availableLimit: Money {
        if let selectedCard { return selectedCard.availableLimit ?? .zero }
        return screen?.availableLimitTotal ?? .zero
    }

    public var creditLimit: Money {
        if let selectedCard { return selectedCard.creditLimit ?? .zero }
        return screen?.creditLimitTotal ?? .zero
    }

    public var limitFreePercent: Int {
        guard creditLimit.amount > 0 else { return 0 }
        let used = outstanding.amount / creditLimit.amount
        let usedPct = NSDecimalNumber(decimal: used * 100).intValue
        return max(0, min(100, 100 - usedPct))
    }

    public var title: String {
        if isAllCards { return "Cartões de Crédito" }
        return selectedCard?.name ?? "Cartão de Crédito"
    }

    public var subtitle: String {
        if isAllCards {
            return "Soma consolidada de \(cards.count) cartões"
        }
        let card = selectedCard
        return "Final \(card?.lastFour ?? "****")"
    }

    public var filteredLines: [CreditBillLine] {
        let items = selectedBill?.items ?? []
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return items }
        return items.filter {
            $0.description.lowercased().contains(query)
                || translatedCategory($0.category).lowercased().contains(query)
                || ($0.merchantName?.lowercased().contains(query) ?? false)
        }
    }

    public var categoryBreakdown: [(name: String, value: Decimal)] {
        var map: [String: Decimal] = [:]
        for line in selectedBill?.items ?? [] where !line.isPayment {
            let name = translatedCategory(line.category)
            let signed = line.isCredit ? -line.amount.amount : line.amount.amount
            map[name, default: 0] += signed
        }
        return map
            .map { key, value in
                let absolute = value < 0 ? -value : value
                return (name: key, value: absolute)
            }
            .filter { $0.value > Decimal(string: "0.005") ?? 0 }
            .sorted { $0.value > $1.value }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "credit-cards"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            return
        }

        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        do {
            let loaded = try await repository.fetchScreen(force: force)
            screen = loaded
            if loaded.cards.isEmpty {
                state = .empty
                lastLoadedAt = Date()
                lastCacheKey = cacheKey
                return
            }
            if selectedCardId != CreditCardsScreen.allCardsId,
               !loaded.cards.contains(where: { $0.id == selectedCardId }) {
                selectedCardId = CreditCardsScreen.allCardsId
            }
            selectedBillKey = loaded.period(for: selectedCardId).openDueKey
                ?? loaded.period(for: selectedCardId).bills.first(where: { $0.type == .currentOpen })?.dueMonth
            state = .loaded(loaded)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar os cartões.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func selectCard(_ id: String) {
        selectedCardId = id
        searchText = ""
        selectedBillKey = period.openDueKey
            ?? period.bills.first(where: { $0.type == .currentOpen })?.dueMonth
    }

    public func selectBill(_ key: String) {
        selectedBillKey = key
        searchText = ""
    }

    public func addPurchase() async {
        guard let manuals else {
            errorMessage = "Não é possível lançar compra neste ambiente."
            return
        }
        let amount = Decimal(string: purchaseAmount.replacingOccurrences(of: ",", with: ".")) ?? 0
        let description = purchaseDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        guard amount > 0, !description.isEmpty else {
            errorMessage = "Informe descrição e valor."
            return
        }
        let accountId = isAllCards ? cards.first?.id : selectedCardId
        let expense = ManualExpense(
            id: UUID().uuidString,
            description: description,
            amount: Money(amount: amount),
            date: InstantDate(from: purchaseDate),
            category: "Shopping",
            accountId: accountId
        )
        do {
            _ = try await manuals.createExpense(expense)
            purchaseDescription = ""
            purchaseAmount = ""
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func parsePDF(data: Data, mimeType: String = "application/pdf") async {
        guard let parseBillUseCase else {
            parseError = "Leitura de PDF indisponível."
            return
        }
        parseError = nil
        do {
            let bill = try await parseBillUseCase.execute(base64: data.base64EncodedString(), mimeType: mimeType)
            parsedBill = bill
            includedPurchaseIDs = Set(bill.purchases.map(\.id))
        } catch {
            parseError = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func confirmParsedPurchases() async {
        guard let manuals, let parsedBill else { return }
        let accountId = isAllCards ? cards.first?.id : selectedCardId
        do {
            for purchase in parsedBill.purchases where includedPurchaseIDs.contains(purchase.id) {
                _ = try await manuals.createExpense(
                    ManualExpense(
                        id: UUID().uuidString,
                        description: purchase.description,
                        amount: purchase.amount,
                        date: purchase.date ?? InstantDate(from: Date()),
                        category: purchase.category,
                        accountId: accountId
                    )
                )
            }
            self.parsedBill = nil
            await load(force: true)
        } catch {
            parseError = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}

func translatedCategory(_ category: String?) -> String {
    guard let category, !category.isEmpty else { return "Geral" }
    switch category {
    case "Groceries": return "Alimentação"
    case "Eating out": return "Restaurantes"
    case "Food delivery": return "Delivery"
    case "Cinema, theater and concerts": return "Cinema & Shows"
    case "Parking": return "Estacionamento"
    case "Shopping": return "Compras"
    case "Services": return "Serviços"
    case "Tickets": return "Ingressos"
    case "Digital services": return "Serviços digitais"
    case "Telecommunications": return "Telefone & Internet"
    case "Car rental": return "Aluguel de carros"
    case "Automotive": return "Automóvel"
    case "Gas stations": return "Combustível"
    case "Vehicle maintenance": return "Manutenção"
    case "Taxi and ride-hailing": return "Uber / Táxi"
    case "Healthcare": return "Saúde"
    case "Dentist": return "Odontologia"
    case "Pharmacy": return "Farmácia"
    case "Optometry": return "Ótica"
    case "Gyms and fitness centers": return "Academia"
    case "Wellness and fitness": return "Bem-estar"
    case "Houseware": return "Casa"
    case "Rent": return "Aluguel"
    case "Clothing": return "Vestuário"
    case "Gaming": return "Games"
    case "Transfers": return "Transferências"
    case "Credit card payment": return "Pagamento de fatura"
    case "Bank fees": return "Tarifas"
    case "Salary": return "Salário"
    case "Investments": return "Investimentos"
    case "Other": return "Outros"
    default: return category
    }
}
