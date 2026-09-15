import Foundation

public struct LineItemCapabilities: OptionSet, Sendable, Hashable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let togglePaid = LineItemCapabilities(rawValue: 1 << 0)
    public static let edit = LineItemCapabilities(rawValue: 1 << 1)
    public static let delete = LineItemCapabilities(rawValue: 1 << 2)
    public static let createReceivable = LineItemCapabilities(rawValue: 1 << 3)
    public static let changeCategory = LineItemCapabilities(rawValue: 1 << 4)
}

public struct LineItemCategoryOption: Sendable, Hashable, Identifiable {
    public var id: String
    public var label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }

    public static func manualOptions(_ categories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults) -> [LineItemCategoryOption] {
        PurchaseCategoryCatalog.resolved(categories).map {
            LineItemCategoryOption(id: $0.key, label: $0.label)
        }
    }

    public static func pluggyOptions(_ categories: [TransactionCategory]) -> [LineItemCategoryOption] {
        let leaves = categories.filter { $0.parentId != nil && !$0.parentId!.isEmpty }
        let source = leaves.isEmpty ? categories : leaves
        return source
            .map { LineItemCategoryOption(id: $0.id, label: $0.label) }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }
}

public enum LineItemKind: String, Sendable, Hashable {
    case openFinanceTransaction
    case creditBillLine
    case automaticDebit
    case manualExpense
    case receivable
    case agenda

    public var title: String {
        switch self {
        case .openFinanceTransaction: return "Transação"
        case .creditBillLine: return "Compra no cartão"
        case .automaticDebit: return "Débito automático"
        case .manualExpense: return "Despesa manual"
        case .receivable: return "Valor a receber"
        case .agenda: return "Compromisso"
        }
    }
}

public struct LineItemMetadataRow: Sendable, Hashable {
    public var label: String
    public var value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

public struct LineItemDetail: Sendable, Hashable, Identifiable {
    public var id: String
    public var kind: LineItemKind
    public var title: String
    public var amount: Money
    public var isCredit: Bool
    public var category: String?
    public var categoryKey: String?
    public var categoryId: String?
    public var accountLabel: String?
    public var statusLabel: String?
    public var badges: [String]
    public var metadata: [LineItemMetadataRow]
    public var capabilities: LineItemCapabilities
    public var isPaid: Bool
    public var sourceId: String
    public var installmentNumber: Int?

    public init(
        id: String,
        kind: LineItemKind,
        title: String,
        amount: Money,
        isCredit: Bool,
        category: String? = nil,
        categoryKey: String? = nil,
        categoryId: String? = nil,
        accountLabel: String? = nil,
        statusLabel: String? = nil,
        badges: [String] = [],
        metadata: [LineItemMetadataRow] = [],
        capabilities: LineItemCapabilities = [],
        isPaid: Bool = false,
        sourceId: String? = nil,
        installmentNumber: Int? = nil
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.amount = amount
        self.isCredit = isCredit
        self.category = category
        self.categoryKey = categoryKey
        self.categoryId = categoryId
        self.accountLabel = accountLabel
        self.statusLabel = statusLabel
        self.badges = badges
        self.metadata = metadata
        self.capabilities = capabilities
        self.isPaid = isPaid
        self.sourceId = sourceId ?? id
        self.installmentNumber = installmentNumber
    }

    public var kindTitle: String { kind.title }

    public var categorySelectionId: String {
        categoryId ?? categoryKey ?? ""
    }

    public func resolvedCategorySelection(in options: [LineItemCategoryOption]) -> String {
        let preferred = categorySelectionId
        if options.contains(where: { $0.id == preferred }) { return preferred }
        if let categoryId, options.contains(where: { $0.id == categoryId }) { return categoryId }
        if let categoryKey, options.contains(where: { $0.id == categoryKey }) { return categoryKey }
        if let category {
            if let match = options.first(where: { $0.label.caseInsensitiveCompare(category) == .orderedSame }) {
                return match.id
            }
        }
        return preferred
    }

    public var paidActionTitle: String {
        if kind == .receivable {
            return isPaid ? "Já recebido" : "Marcar recebido"
        }
        return isPaid ? "Marcar como não paga" : "Marcar como paga"
    }
}

public extension LineItemDetail {
    static func from(
        transaction: Transaction,
        accountName: String?
    ) -> LineItemDetail {
        let category = translatedCategory(transaction.category)
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Data", value: transaction.date.formatted()),
        ]
        if let accountName, !accountName.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Conta", value: accountName))
        }
        if !category.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Categoria", value: category))
        }
        return LineItemDetail(
            id: transaction.id,
            kind: .openFinanceTransaction,
            title: transaction.description,
            amount: transaction.amount,
            isCredit: transaction.kind == .credit,
            category: category,
            categoryKey: transaction.category,
            categoryId: transaction.categoryId,
            accountLabel: accountName,
            statusLabel: transaction.isPending ? "Pendente" : "Confirmada",
            badges: transaction.isPending ? ["Pendente"] : [],
            metadata: metadata,
            capabilities: .changeCategory
        )
    }

    static func from(
        billLine: CreditBillLine,
        canCreateReceivable: Bool = false
    ) -> LineItemDetail {
        let category = translatedCategory(billLine.category)
        var badges: [String] = []
        if let installment = billLine.installmentLabel { badges.append(installment) }
        if billLine.isProjected { badges.append("Projetada") }
        if billLine.isPending { badges.append("Pendente") }
        var metadata: [LineItemMetadataRow] = []
        if !billLine.accountName.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Cartão", value: billLine.accountName))
        }
        if let date = billLine.purchaseDate {
            metadata.append(LineItemMetadataRow(label: "Data", value: date.formatted()))
        }
        if !category.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Categoria", value: category))
        }
        if let merchant = billLine.merchantName, !merchant.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Estabelecimento", value: merchant))
        }
        metadata.append(LineItemMetadataRow(label: "Status", value: billLine.statusLabel))
        let create = canCreateReceivable && !billLine.isPayment && !billLine.isCredit
        var capabilities: LineItemCapabilities = []
        if create { capabilities.insert(.createReceivable) }
        if !billLine.isPayment && !billLine.isProjected {
            capabilities.insert(.changeCategory)
        }
        return LineItemDetail(
            id: billLine.id,
            kind: .creditBillLine,
            title: billLine.description,
            amount: billLine.amount,
            isCredit: billLine.isCredit,
            category: category,
            categoryKey: billLine.category,
            categoryId: billLine.categoryId,
            accountLabel: billLine.accountName,
            statusLabel: billLine.statusLabel,
            badges: badges,
            metadata: metadata,
            capabilities: capabilities,
            sourceId: billLine.id
        )
    }

    static func from(expense: ManualExpense, accountName: String? = nil) -> LineItemDetail {
        let category = ManualExpenseCategoryLabel.label(expense.category)
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Data", value: expense.date.formatted()),
        ]
        if !category.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Categoria", value: category))
        }
        if let accountName, !accountName.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Conta", value: accountName))
        }
        if expense.isRecurring {
            metadata.append(LineItemMetadataRow(label: "Recorrência", value: expense.isContinuous ? "Contínua" : "Parcelada"))
        }
        return LineItemDetail(
            id: expense.id,
            kind: .manualExpense,
            title: expense.description,
            amount: expense.amount,
            isCredit: false,
            category: category,
            categoryKey: expense.category,
            accountLabel: accountName,
            statusLabel: expense.isPaid ? "Paga" : "Em aberto",
            badges: expense.isPaid ? ["Paga"] : [],
            metadata: metadata,
            capabilities: [.togglePaid, .edit, .delete, .changeCategory],
            isPaid: expense.isPaid,
            sourceId: expense.id
        )
    }

    static func from(
        receivable: Receivable,
        installment: ReceivableInstallment? = nil
    ) -> LineItemDetail {
        let inst = installment ?? receivable.installmentHistory.first { !$0.isPaid } ?? receivable.installmentHistory.first
        let amount = inst?.amount ?? receivable.amount
        let paid = inst?.isPaid ?? receivable.isReceived
        var badges: [String] = []
        if receivable.installments > 1, let inst {
            badges.append("Parcela \(inst.installmentNumber)/\(receivable.installments)")
        }
        if paid { badges.append("Recebido") }
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Pessoa", value: receivable.personName),
        ]
        if let due = inst?.dueDate ?? receivable.dueDate {
            metadata.append(LineItemMetadataRow(label: "Vencimento", value: due.formatted()))
        }
        if let notes = receivable.notes, !notes.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Notas", value: notes))
        }
        return LineItemDetail(
            id: "\(receivable.id)-\(inst?.installmentNumber ?? 0)",
            kind: .receivable,
            title: receivable.description,
            amount: amount,
            isCredit: true,
            accountLabel: receivable.personName,
            statusLabel: paid ? "Recebido" : "A receber",
            badges: badges,
            metadata: metadata,
            capabilities: paid ? [.edit, .delete] : [.togglePaid, .edit, .delete],
            isPaid: paid,
            sourceId: receivable.id,
            installmentNumber: inst?.installmentNumber
        )
    }

    static func from(debit: AutomaticDebitItem) -> LineItemDetail {
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Data", value: debit.date),
        ]
        if !debit.accountName.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Conta", value: debit.accountName))
        }
        return LineItemDetail(
            id: debit.id,
            kind: .automaticDebit,
            title: debit.description,
            amount: debit.amount,
            isCredit: false,
            accountLabel: debit.accountName,
            statusLabel: debit.isPending ? "Agendado" : "Liquidado",
            badges: debit.isPending ? ["Agendado"] : ["Liquidado"],
            metadata: metadata,
            capabilities: []
        )
    }

    static func from(momentExpense: ManualExpenseItem) -> LineItemDetail {
        let category = ManualExpenseCategoryLabel.label(momentExpense.category)
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Data", value: momentExpense.date),
        ]
        if !category.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Categoria", value: category))
        }
        if let owner = momentExpense.ownerLabel, !owner.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Titular", value: owner))
        }
        return LineItemDetail(
            id: momentExpense.id,
            kind: .manualExpense,
            title: momentExpense.description,
            amount: momentExpense.amount,
            isCredit: false,
            category: category,
            categoryKey: momentExpense.category,
            statusLabel: momentExpense.isPaid ? "Paga" : "Em aberto",
            badges: momentExpense.isPaid ? ["Paga"] : [],
            metadata: metadata,
            capabilities: [.togglePaid, .edit, .delete, .changeCategory],
            isPaid: momentExpense.isPaid,
            sourceId: momentExpense.id
        )
    }

    static func from(momentReceivable: ReceivableItem) -> LineItemDetail {
        var badges = ["Parcela \(momentReceivable.installmentNumber)/\(momentReceivable.totalInstallments)"]
        if momentReceivable.isPaid { badges.append("Recebido") }
        var metadata: [LineItemMetadataRow] = [
            LineItemMetadataRow(label: "Pessoa", value: momentReceivable.personName),
        ]
        if let owner = momentReceivable.ownerLabel, !owner.isEmpty {
            metadata.append(LineItemMetadataRow(label: "Titular", value: owner))
        }
        let source = momentReceivable.receivableId
        var capabilities: LineItemCapabilities = []
        if source != nil, !momentReceivable.isPaid { capabilities.insert(.togglePaid) }
        if source != nil { capabilities.insert(.edit); capabilities.insert(.delete) }
        return LineItemDetail(
            id: momentReceivable.id,
            kind: .receivable,
            title: momentReceivable.description,
            amount: momentReceivable.amount,
            isCredit: true,
            accountLabel: momentReceivable.personName,
            statusLabel: momentReceivable.isPaid ? "Recebido" : "A receber",
            badges: badges,
            metadata: metadata,
            capabilities: capabilities,
            isPaid: momentReceivable.isPaid,
            sourceId: source ?? momentReceivable.id,
            installmentNumber: momentReceivable.installmentNumber
        )
    }

    static func from(dashboard: DashboardRecentTransaction) -> LineItemDetail {
        let category = translatedCategory(dashboard.category)
        return LineItemDetail(
            id: dashboard.id,
            kind: .openFinanceTransaction,
            title: dashboard.description,
            amount: dashboard.amount,
            isCredit: dashboard.isCredit,
            category: category,
            categoryKey: dashboard.category,
            categoryId: dashboard.categoryId,
            statusLabel: dashboard.isPending ? "Pendente" : "Confirmada",
            badges: dashboard.isPending ? ["Pendente"] : [],
            metadata: [
                LineItemMetadataRow(label: "Quando", value: dashboard.dateRelative),
                LineItemMetadataRow(label: "Data", value: dashboard.date),
                LineItemMetadataRow(label: "Categoria", value: category),
            ],
            capabilities: .changeCategory
        )
    }

    static func from(agenda: AgendaItem) -> LineItemDetail {
        var capabilities: LineItemCapabilities = []
        if agenda.kind == .custom { capabilities = [.togglePaid, .changeCategory] }
        return LineItemDetail(
            id: agenda.id,
            kind: agenda.kind == .custom ? .manualExpense : (agenda.kind == .receivable ? .receivable : .agenda),
            title: agenda.title,
            amount: agenda.amount ?? .zero,
            isCredit: agenda.kind == .receivable,
            statusLabel: agenda.isCompleted ? "Pago" : "Pendente",
            badges: [agendaKindLabel(agenda.kind)],
            metadata: [
                LineItemMetadataRow(label: "Data", value: agenda.date.formatted()),
                LineItemMetadataRow(label: "Tipo", value: agendaKindLabel(agenda.kind)),
            ],
            capabilities: capabilities,
            isPaid: agenda.isCompleted,
            sourceId: agendaSourceId(agenda)
        )
    }

    static func agendaSourceId(_ item: AgendaItem) -> String {
        if item.kind == .custom, item.id.hasPrefix("manual_") {
            return String(item.id.dropFirst("manual_".count))
        }
        return item.id
    }

    static func translatedCategory(_ category: String?) -> String {
        guard let category, !category.isEmpty else { return "Geral" }
        if let kind = ExpenseCategoryKind(rawValue: category) { return kind.labelPT }
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

    func applyingCategory(option: LineItemCategoryOption) -> LineItemDetail {
        var copy = self
        copy.categoryId = option.id
        copy.categoryKey = option.id
        copy.category = option.label
        copy.metadata = metadata.map { row in
            guard row.label == "Categoria" else { return row }
            return LineItemMetadataRow(label: row.label, value: option.label)
        }
        if !copy.metadata.contains(where: { $0.label == "Categoria" }) {
            copy.metadata.append(LineItemMetadataRow(label: "Categoria", value: option.label))
        }
        return copy
    }

    private static func agendaKindLabel(_ kind: AgendaItemKind) -> String {
        switch kind {
        case .bill: return "Fatura"
        case .receivable: return "A receber"
        case .subscription: return "Assinatura"
        case .loan: return "Empréstimo"
        case .custom: return "Despesa"
        }
    }
}

enum ManualExpenseCategoryLabel {
    static func label(_ raw: String?) -> String {
        PurchaseCategoryCatalog.label(for: raw)
    }
}
