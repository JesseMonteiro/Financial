import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

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
    private let receivables: (any ReceivablesRepository)?
    private let transactions: (any TransactionsRepository)?
    private let purchaseCategoriesRepository: (any PurchaseCategoriesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?
    public private(set) var linkedTransactionIDs: Set<String> = []
    public private(set) var categoryOptions: [LineItemCategoryOption] = LineItemCategoryOption.recategorizationOptions()
    public private(set) var purchaseCategories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults

    public var purchaseDescription = ""
    public var purchaseAmount = ""
    public var purchaseDate = Date()
    public var parsedBill: ParsedBill?
    public var includedPurchaseIDs: Set<String> = []
    public var parseError: String?

    public init(
        repository: any CreditCardsRepository = StubCreditCardsRepository(),
        manuals: (any ManualExpensesRepository)? = nil,
        parseBill: (any ParseBillUseCase)? = nil,
        receivables: (any ReceivablesRepository)? = nil,
        transactions: (any TransactionsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) {
        self.repository = repository
        self.manuals = manuals
        self.parseBillUseCase = parseBill
        self.receivables = receivables
        self.transactions = transactions
        self.purchaseCategoriesRepository = purchaseCategories
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

    /// Canonical focus for the current bill ("fatura atual"): the next open or closed unpaid bill,
    /// matching the web project logic. When the month is already paid, focus moves to the next open bill.
    public var currentBillKey: String? {
        period.resolvedCurrentDueKey()
    }

    /// Backwards-compatibility alias for `currentBillKey`.
    public var currentMonthBillKey: String? {
        currentBillKey
    }

    public var isViewingCurrentBill: Bool {
        guard let current = currentBillKey else { return true }
        return activeBillKey == current
    }

    /// Backwards-compatibility alias for `isViewingCurrentBill`.
    public var isViewingCurrentMonthBill: Bool {
        isViewingCurrentBill
    }

    public var activeBillKey: String {
        if let selectedBillKey, period.bills.contains(where: { $0.dueMonth == selectedBillKey }) {
            return selectedBillKey
        }
        return currentBillKey
            ?? period.openDueKey.flatMap { key in
                period.bills.contains(where: { $0.dueMonth == key }) ? key : nil
            }
            ?? period.bills.first(where: { $0.type == .currentOpen })?.dueMonth
            ?? period.bills.first(where: { !$0.isPaid })?.dueMonth
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
        screen?.resolvedAvailableLimit(cardId: selectedCardId) ?? .zero
    }

    public var creditLimit: Money {
        screen?.resolvedCreditLimit(cardId: selectedCardId) ?? .zero
    }

    public var limitFreePercent: Int {
        screen?.limitFreePercent(cardId: selectedCardId) ?? 0
    }

    public func cardDisplayName(for line: CreditBillLine) -> String {
        screen?.displayName(forAccountId: line.accountId)
            ?? line.accountName
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
        let matching: [CreditBillLine]
        if query.isEmpty {
            matching = items
        } else {
            matching = items.filter {
                $0.description.lowercased().contains(query)
                    || translatedCategory($0.category).lowercased().contains(query)
                    || ($0.merchantName?.lowercased().contains(query) ?? false)
            }
        }
        return matching.sorted(by: CreditBillLine.compareByPurchaseDateNewestFirst)
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
            if categoryOptions.isEmpty { await loadCategories(force: true) }
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
            let activePeriod = loaded.period(for: selectedCardId)
            if let selectedBillKey, activePeriod.bills.contains(where: { $0.dueMonth == selectedBillKey }) {
                // Keep existing selection if valid
            } else {
                selectedBillKey = preferredBillKey(for: activePeriod)
            }
            state = .loaded(loaded)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
            await refreshLinkedReceivables()
            await loadCategories(force: force)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar os cartões.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func changeCategory(id: String, option: LineItemCategoryOption) async {
        guard let transactions else { return }
        do {
            try await transactions.updateCategory(id: id, categoryId: option.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    private func loadCategories(force: Bool) async {
        var pluggyCats: [TransactionCategory] = []
        if let transactions {
            pluggyCats = (try? await transactions.fetchCategories(force: force)) ?? []
        }
        if let purchaseCategoriesRepository,
           let cats = try? await purchaseCategoriesRepository.fetchCategories(force: force) {
            purchaseCategories = PurchaseCategoryCatalog.resolved(cats)
        }
        categoryOptions = LineItemCategoryOption.recategorizationOptions(
            pluggyCategories: pluggyCats,
            purchaseCategories: purchaseCategories
        )
    }

    public func canCreateReceivable(for line: CreditBillLine) -> Bool {
        receivables != nil && !line.isPayment && !line.isCredit && !linkedTransactionIDs.contains(line.id)
    }

    public func createReceivable(from line: CreditBillLine, person: String) async {
        guard let receivables else { return }
        let name = person.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let due = InstantDate(from: Date())
        let item = Receivable(
            id: UUID().uuidString,
            description: line.description,
            amount: line.amount,
            dueDate: due,
            counterparty: name,
            installments: 1,
            originalTotalAmount: line.amount,
            linkedTransactionId: line.id,
            installmentHistory: [
                ReceivableInstallment(installmentNumber: 1, amount: line.amount, dueDate: due)
            ]
        )
        do {
            try await receivables.saveReceivable(item)
            await refreshLinkedReceivables()
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    private func refreshLinkedReceivables() async {
        guard let receivables else { return }
        if let recs = try? await receivables.fetchReceivables(force: false) {
            linkedTransactionIDs = Set(recs.compactMap(\.linkedTransactionId))
        }
    }

    public func selectCard(_ id: String) {
        selectedCardId = id
        searchText = ""
        selectedBillKey = preferredBillKey(for: screen?.period(for: id) ?? period)
    }

    public func selectBill(_ key: String) {
        selectedBillKey = key
        searchText = ""
    }

    public func selectCurrentBill() {
        guard let key = currentBillKey else { return }
        selectBill(key)
    }

    /// Backwards-compatibility alias for `selectCurrentBill`.
    public func selectCurrentMonthBill() {
        selectCurrentBill()
    }

    /// Prefer the next open or closed unpaid bill matching the web app logic.
    public func preferredBillKey(for period: CreditBillPeriod? = nil) -> String? {
        let period = period ?? self.period
        return period.resolvedCurrentDueKey()
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
    case "Groceries": return "Supermercados"
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
