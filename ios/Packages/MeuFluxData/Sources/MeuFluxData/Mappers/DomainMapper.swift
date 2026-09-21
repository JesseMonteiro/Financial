import Foundation
import MeuFluxDomain

public enum DomainMapper {
    public static func money(_ dto: MoneyDTO) -> Money {
        Money(amount: Decimal(string: dto.amount) ?? .zero, currencyCode: dto.currency)
    }

    public static func money(amount: Decimal, currencyCode: String = "BRL") -> Money {
        Money(amount: amount, currencyCode: currencyCode)
    }

    public static func account(_ dto: AccountDTO) -> Account {
        Account(
            id: dto.id,
            name: dto.name,
            type: AccountType(rawValue: dto.type.lowercased()) ?? .other,
            balance: money(dto.balance),
            institutionName: dto.institutionName,
            connectorId: dto.connectorId,
            isHidden: dto.isHidden ?? false
        )
    }

    public static func account(_ dto: PluggyAccountDTO) -> Account {
        let mappedType: AccountType
        switch dto.type.uppercased() {
        case "CREDIT": mappedType = .credit
        case "BANK":
            switch (dto.subtype ?? "").uppercased() {
            case "SAVINGS_ACCOUNT", "SAVINGS": mappedType = .savings
            case "CHECKING_ACCOUNT", "CHECKING": mappedType = .checking
            default: mappedType = .checking
            }
        default: mappedType = .other
        }
        let currency = dto.currencyCode ?? "BRL"
        let institution =
            dto.bankData?.institutionName
            ?? dto.creditData?.institutionName
            ?? dto.name
        let number = dto.number ?? dto.creditData?.number
        let reserved = dto.reservedBalance ?? dto.bankData?.reservedTotal ?? 0
        let creditLimit = dto.creditData?.creditLimit.map { money(amount: $0, currencyCode: currency) }
        let available = dto.creditData?.availableCreditLimit.map { money(amount: $0, currencyCode: currency) }
        let openBill = dto.openBillTotal ?? dto.billAmount
        let outstanding = dto.outstanding ?? abs(dto.balance)
        let billAmount: Money? = mappedType == .credit
            ? money(amount: abs(openBill ?? outstanding), currencyCode: currency)
            : nil
        let balanceAmount = mappedType == .credit
            ? outstanding
            : (dto.availableBalance ?? dto.balance)
        var updatedAt: Date?
        if let raw = dto.updatedAt {
            updatedAt = ISO8601DateFormatter().date(from: raw)
                ?? ISO8601DateFormatter.withFractional.date(from: raw)
        }
        return Account(
            id: dto.id,
            name: dto.marketingName ?? dto.name,
            type: mappedType,
            balance: money(amount: balanceAmount, currencyCode: currency),
            institutionName: institution,
            connectorId: dto.itemId,
            isHidden: false,
            currencyCode: currency,
            number: number,
            marketingName: dto.marketingName,
            isManual: dto.isManual ?? false,
            updatedAt: updatedAt,
            billAmount: billAmount,
            creditLimit: creditLimit,
            availableCreditLimit: available,
            reservedBalance: money(amount: reserved, currencyCode: currency)
        )
    }

    public static func account(fromManual mapped: ManualAccount) -> Account {
        let isCredit = mapped.type == .credit
        return Account(
            id: mapped.id,
            name: mapped.name,
            type: mapped.type,
            balance: isCredit ? (mapped.billAmount ?? mapped.balance) : mapped.balance,
            institutionName: mapped.institutionName.isEmpty ? nil : mapped.institutionName,
            connectorId: nil,
            isHidden: false,
            currencyCode: mapped.balance.currencyCode,
            isManual: true,
            billAmount: mapped.billAmount,
            creditLimit: mapped.creditLimit,
            availableCreditLimit: {
                guard isCredit, let limit = mapped.creditLimit else { return nil }
                let bill = (mapped.billAmount ?? mapped.balance).amount
                return Money(amount: max(0, limit.amount - bill), currencyCode: limit.currencyCode)
            }()
        )
    }

    public static func transaction(_ dto: TransactionDTO) -> Transaction {
        Transaction(
            id: dto.id,
            accountId: dto.accountId,
            description: dto.description,
            amount: money(dto.amount),
            date: InstantDate(isoString: dto.date) ?? InstantDate(year: 1970, month: 1, day: 1),
            category: dto.category,
            kind: TransactionKind(rawValue: dto.kind.lowercased()) ?? .debit,
            isPending: dto.isPending ?? false
        )
    }

    public static func transaction(_ dto: PluggyTransactionDTO) -> Transaction {
        let kind: TransactionKind
        switch (dto.type ?? "").uppercased() {
        case "CREDIT": kind = .credit
        case "DEBIT": kind = .debit
        default: kind = dto.amount >= 0 ? .credit : .debit
        }
        let currency = dto.currencyCode ?? "BRL"
        
        // Map creditCardMetadata if present
        let metadata: CreditCardMetadata? = dto.creditCardMetadata.map { ccm in
            CreditCardMetadata(
                billId: ccm.billId,
                billForecastDate: ccm.billForecastDate
            )
        }
        
        // Use nested billId/billForecastDate from creditCardMetadata, fallback to top-level
        let billId = dto.creditCardMetadata?.billId ?? dto.billId
        let billForecastDate = dto.creditCardMetadata?.billForecastDate ?? dto.billForecastDate
        
        return Transaction(
            id: dto.id,
            accountId: dto.accountId,
            description: dto.description,
            amount: money(amount: abs(dto.amount), currencyCode: currency),
            date: InstantDate(isoString: dto.date) ?? InstantDate(year: 1970, month: 1, day: 1),
            category: dto.category,
            categoryId: dto.categoryId,
            kind: kind,
            isPending: (dto.status ?? "").uppercased() == "PENDING",
            creditCardMetadata: metadata,
            billId: billId,
            billForecastDate: billForecastDate
        )
    }

    public static func bill(_ dto: BillDTO) -> Bill {
        Bill(
            id: dto.id,
            accountId: dto.accountId,
            dueMonth: DueMonth(key: dto.dueMonth) ?? DueMonth(year: 1970, month: 1),
            dueDate: dto.dueDate.flatMap(InstantDate.init(isoString:)),
            totalAmount: money(dto.totalAmount),
            minimumPayment: dto.minimumPayment.map(money),
            status: BillStatus(rawValue: dto.status) ?? .open,
            isPaid: dto.isPaid ?? false
        )
    }

    public static func bill(_ dto: PluggyBillDTO) -> Bill {
        let due = dto.dueDate.flatMap(InstantDate.init(isoString:))
        let dueMonth = due.map(\.yearMonth)
            ?? DueMonth(from: Date())
        let paidViaPayments = !(dto.payments ?? []).isEmpty
        let isPaid = paidViaPayments || dto.paidAt != nil || (dto.status ?? "").uppercased() == "PAID"
        let status: BillStatus
        switch (dto.status ?? "").uppercased() {
        case "PAID": status = .paid
        case "OVERDUE": status = .overdue
        case "CLOSED": status = .closed
        default: status = isPaid ? .paid : .open
        }
        let currency = dto.currencyCode ?? "BRL"
        return Bill(
            id: dto.id,
            accountId: dto.accountId,
            dueMonth: dueMonth,
            dueDate: due,
            totalAmount: money(amount: dto.totalAmount, currencyCode: currency),
            minimumPayment: dto.minimumPaymentAmount.map { money(amount: $0, currencyCode: currency) },
            status: status,
            isPaid: isPaid
        )
    }

    public static func investment(_ dto: InvestmentDTO) -> Investment {
        Investment(
            id: dto.id,
            name: dto.name,
            type: dto.type,
            balance: money(dto.balance),
            accountId: dto.accountId,
            rate: dto.rate.flatMap { Decimal(string: $0) }
        )
    }

    static func investment(_ dto: PluggyInvestmentDTO) -> Investment {
        Investment(
            id: dto.id,
            name: dto.name,
            type: dto.type,
            balance: money(amount: dto.balance),
            accountId: dto.accountId,
            rate: dto.rate,
            issuer: dto.issuer,
            ownerLabel: dto.ownerLabel
        )
    }

    public static func loan(_ dto: LoanDTO) -> Loan {
        Loan(
            id: dto.id,
            name: dto.name,
            principal: money(dto.principal),
            outstandingBalance: money(dto.outstandingBalance),
            interestRate: dto.interestRate.flatMap { Decimal(string: $0) },
            nextDueDate: dto.nextDueDate.flatMap(InstantDate.init(isoString:)),
            installmentAmount: dto.installmentAmount.map(money)
        )
    }

    static func loan(_ dto: PluggyLoanDTO) -> Loan {
        Loan(
            id: dto.id,
            name: dto.name,
            principal: money(amount: dto.principal),
            outstandingBalance: money(amount: dto.outstandingBalance),
            interestRate: dto.interestRate,
            nextDueDate: dto.nextDueDate.flatMap(InstantDate.init(isoString:)),
            installmentAmount: dto.installmentAmount.map { money(amount: $0) }
        )
    }

    public static func budgetLimit(_ dto: BudgetLimitDTO) -> BudgetLimit {
        BudgetLimit(
            id: dto.id,
            category: dto.category,
            limit: money(dto.limit),
            spent: money(dto.spent),
            month: YearMonth(key: dto.month) ?? YearMonth(year: 1970, month: 1)
        )
    }

    public static func goal(_ dto: GoalDTO) -> Goal {
        Goal(
            id: dto.id,
            name: dto.name,
            target: money(dto.target),
            current: money(dto.current),
            deadline: dto.deadline.flatMap(InstantDate.init(isoString:))
        )
    }

    public static func receivable(_ dto: ReceivableDTO) -> Receivable {
        Receivable(
            id: dto.id,
            description: dto.description,
            amount: money(dto.amount),
            dueDate: dto.dueDate.flatMap(InstantDate.init(isoString:)),
            isReceived: dto.isReceived ?? false,
            counterparty: dto.counterparty
        )
    }

    public static func manualExpense(_ dto: ManualExpenseDTO) -> ManualExpense {
        ManualExpense(
            id: dto.id,
            description: dto.description,
            amount: money(dto.amount),
            date: InstantDate(isoString: dto.date) ?? InstantDate(year: 1970, month: 1, day: 1),
            category: dto.category,
            accountId: dto.accountId
        )
    }

    public static func jointLink(_ dto: JointLinkDTO) -> JointLink {
        JointLink(
            id: dto.id,
            status: dto.status,
            partnerId: dto.partnerId,
            partnerDisplayName: dto.partnerDisplayName,
            inviteToken: dto.inviteToken,
            ownerUserId: dto.userA
        )
    }

    public static func jointMoment(_ dto: JointMomentDTO) -> JointMomentSnapshot {
        let fm = FinancialMomentDTO(
            selectedMonth: dto.selectedMonth,
            salary: dto.salary,
            receivables: dto.receivables,
            creditCards: dto.creditCards,
            automaticDebits: dto.automaticDebits,
            manualExpenses: dto.manualExpenses,
            totals: dto.totals,
            status: dto.status,
            monthsStatus: dto.monthsStatus,
            mealBenefits: dto.mealBenefits
        )
        return JointMomentSnapshot(
            link: jointLink(dto.link),
            members: dto.members.map {
                JointMember(
                    id: $0.id,
                    displayName: $0.displayName,
                    salary: money($0.salary),
                    isCurrentUser: $0.isCurrentUser
                )
            },
            detail: financialMomentDetail(fm)
        )
    }

    public static func subscription(_ dto: SubscriptionDTO) -> Subscription {
        Subscription(
            id: dto.id,
            name: dto.name,
            amount: money(dto.amount),
            billingDay: dto.billingDay,
            category: dto.category,
            isActive: dto.isActive ?? true
        )
    }

    public static func agendaItem(_ dto: AgendaItemDTO) -> AgendaItem {
        AgendaItem(
            id: dto.id,
            title: dto.title,
            date: InstantDate(isoString: dto.date) ?? InstantDate(year: 1970, month: 1, day: 1),
            amount: dto.amount.map(money),
            kind: AgendaItemKind(rawValue: dto.kind) ?? .custom,
            isCompleted: dto.isCompleted ?? false
        )
    }

    public static func profile(_ dto: UserProfileDTO) -> UserProfile {
        UserProfile(
            id: dto.id,
            email: dto.email,
            displayName: dto.displayName,
            avatarURL: dto.avatarUrl.flatMap(URL.init(string:))
        )
    }

    static func profile(_ dto: DomainProfileDTO) -> UserProfile {
        UserProfile(
            id: dto.id ?? "",
            displayName: dto.displayName ?? "Você",
            theme: dto.theme ?? "system",
            density: dto.density ?? "comfortable",
            animationsEnabled: dto.animationsEnabled ?? true,
            telegramChatId: dto.telegramChatId,
            customAccountNames: dto.customAccountNames ?? [:]
        )
    }

    static func budgetLimit(_ dto: DomainBudgetRowDTO, month: YearMonth, spent: Money = .zero) -> BudgetLimit {
        let period = BudgetPeriod(rawValue: dto.period ?? "monthly") ?? .monthly
        return BudgetLimit(
            id: dto.id ?? dto.category,
            category: dto.category,
            limit: money(amount: dto.limit),
            spent: spent,
            month: month,
            period: period,
            periodAmount: money(amount: dto.limit)
        )
    }

    static func goal(_ dto: DomainGoalRowDTO) -> Goal {
        Goal(
            id: dto.id,
            name: dto.title ?? dto.name ?? "Meta",
            target: money(amount: dto.targetAmount),
            current: money(amount: dto.currentAmount),
            deadline: dto.deadline.flatMap(InstantDate.init(isoString:))
        )
    }

    static func purchaseCategory(_ dto: DomainPurchaseCategoryRowDTO) -> PurchaseCategory {
        PurchaseCategory(
            id: dto.id,
            key: dto.key,
            label: dto.label,
            color: dto.color,
            icon: dto.icon,
            sortOrder: dto.sortOrder
        )
    }

    static func mealBenefit(_ dto: DomainMealBenefitRowDTO, purchases: [MealBenefitPurchase] = []) -> MealBenefit {
        MealBenefit(
            id: dto.id,
            kind: MealBenefitKind(rawValue: dto.kind ?? "VA") ?? .va,
            label: dto.label ?? "",
            monthlyAmount: money(amount: dto.monthlyAmount),
            creditDay: dto.creditDay,
            startsOn: dto.startsOn.flatMap { InstantDate(isoString: String($0.prefix(10))) } ?? InstantDate(from: Date()),
            openingBalance: money(amount: dto.openingBalance),
            showInMoment: dto.showInMoment,
            purchases: purchases
        )
    }

    static func mealPurchase(_ dto: DomainMealPurchaseRowDTO) -> MealBenefitPurchase {
        MealBenefitPurchase(
            id: dto.id,
            benefitId: dto.benefitId,
            amount: money(amount: dto.amount),
            purchasedAt: dto.purchasedAt.flatMap { InstantDate(isoString: String($0.prefix(10))) } ?? InstantDate(from: Date()),
            description: dto.description ?? "",
            category: dto.category ?? ""
        )
    }

    static func receivable(_ dto: DomainReceivableRowDTO) -> Receivable {
        let paid = dto.paidInstallments ?? 0
        let total = max(1, dto.installments ?? 1)
        let isContinuous = dto.isContinuous ?? false
        let history = (dto.installmentHistory ?? []).enumerated().compactMap { index, row -> ReceivableInstallment? in
            let number = row.installmentNumber ?? (index + 1)
            let due = row.dueDate.flatMap { InstantDate(isoString: String($0.prefix(10))) }
                ?? InstantDate(from: Date())
            let amount = money(amount: abs(row.amount ?? 0))
            let paidAt = row.paidAt.flatMap { InstantDate(isoString: String($0.prefix(10))) }
            return ReceivableInstallment(
                installmentNumber: number,
                amount: amount,
                dueDate: due,
                paidAt: paidAt
            )
        }.sorted { $0.installmentNumber < $1.installmentNumber }

        let synthesized: [ReceivableInstallment]
        if history.isEmpty {
            let per = money(amount: abs(dto.totalAmount) / Decimal(total))
            synthesized = (1...total).map { n in
                ReceivableInstallment(
                    installmentNumber: n,
                    amount: per,
                    dueDate: InstantDate(from: Date()),
                    paidAt: n <= paid ? InstantDate(from: Date()) : nil
                )
            }
        } else {
            synthesized = history
        }

        return Receivable(
            id: dto.id,
            description: dto.description ?? "Recebível",
            amount: money(amount: dto.totalAmount),
            dueDate: synthesized.first?.dueDate,
            isReceived: paid >= total && !isContinuous,
            counterparty: dto.personName,
            installments: total,
            paidInstallments: paid,
            isContinuous: isContinuous,
            personColor: dto.personColor,
            originalTotalAmount: dto.originalTotalAmount.map { money(amount: $0) },
            linkedTransactionId: dto.linkedTransactionId,
            linkedBillForecastDate: dto.linkedBillForecastDate,
            notes: dto.notes,
            installmentHistory: synthesized
        )
    }

    static func manualExpense(_ dto: DomainManualRowDTO) -> ManualExpense {
        let paidAt: InstantDate?
        if let raw = dto.paidAt, raw.count >= 10 {
            paidAt = InstantDate(isoString: String(raw.prefix(10)))
        } else {
            paidAt = nil
        }
        return ManualExpense(
            id: dto.id,
            description: dto.description,
            amount: money(amount: abs(dto.amount)),
            date: InstantDate(isoString: String(dto.date.prefix(10))) ?? InstantDate(from: Date()),
            category: dto.category,
            accountId: dto.accountId,
            isPaid: dto.isPaid ?? false,
            isRecurring: dto.isRecurring ?? false,
            isContinuous: dto.isContinuous ?? false,
            parentId: dto.parentId,
            originalDescription: dto.originalDescription,
            frequency: dto.frequency,
            paidAt: paidAt
        )
    }

    static func manualAccount(_ dto: DomainManualAccountRowDTO) -> ManualAccount {
        let type: AccountType
        switch (dto.type ?? "").uppercased() {
        case "CREDIT": type = .credit
        default: type = .manual
        }
        return ManualAccount(
            id: dto.id,
            name: dto.name,
            type: type,
            institutionName: dto.institutionName ?? "",
            balance: money(amount: dto.balance),
            billAmount: dto.billAmount.map { money(amount: $0) },
            billDueDay: dto.billDueDay,
            creditLimit: dto.creditLimit.map { money(amount: $0) }
        )
    }

    static func parsedBill(_ dto: ParsedBillDTO) -> ParsedBill {
        ParsedBill(
            totalAmount: money(amount: dto.totalAmount),
            dueDate: dto.dueDate.flatMap(InstantDate.init(isoString:)),
            closingDate: dto.closingDate.flatMap(InstantDate.init(isoString:)),
            cardLastDigits: dto.cardLastDigits,
            institutionName: dto.institutionName,
            purchases: dto.purchases.map {
                ParsedBillPurchase(
                    date: $0.date.flatMap(InstantDate.init(isoString:)),
                    description: $0.description,
                    amount: money(amount: $0.amount),
                    installment: $0.installment,
                    totalInstallments: $0.totalInstallments,
                    category: $0.category
                )
            }
        )
    }

    public static func settings(_ dto: AppSettingsDTO) -> AppSettings {
        AppSettings(
            preferredLocale: dto.preferredLocale ?? "pt_BR",
            biometricLockEnabled: dto.biometricLockEnabled ?? false,
            notificationsEnabled: dto.notificationsEnabled ?? true,
            defaultDueMonthOffset: dto.defaultDueMonthOffset ?? 0
        )
    }

    public static func bankItem(_ dto: BankItemDTO) -> BankConnectionItem {
        BankConnectionItem(
            id: dto.id,
            institutionName: dto.institutionName,
            status: dto.status,
            lastSyncAt: dto.lastSyncAt
        )
    }

    static func bankItem(_ dto: PluggyItemDTO) -> BankConnectionItem {
        let lastSync: Date?
        if let raw = dto.lastSyncAt {
            lastSync = ISO8601DateFormatter().date(from: raw)
                ?? ISO8601DateFormatter.withFractional.date(from: raw)
        } else {
            lastSync = nil
        }
        return BankConnectionItem(
            id: dto.id,
            institutionName: dto.institutionName,
            status: dto.status,
            executionStatus: dto.executionStatus,
            lastSyncAt: lastSync
        )
    }

    public static func creditCardsScreen(_ dto: CreditCardsScreenDTO) -> CreditCardsScreen {
        CreditCardsScreen(
            cards: dto.cards.map(creditCardSummary),
            outstandingTotal: money(string: dto.outstandingTotal),
            creditLimitTotal: money(string: dto.creditLimitTotal),
            availableLimitTotal: money(string: dto.availableLimitTotal),
            periods: dto.periods.mapValues(creditBillPeriod)
        )
    }

    public static func creditCardSummary(_ dto: CreditCardSummaryDTO) -> CreditCardSummary {
        CreditCardSummary(
            id: dto.id,
            name: dto.name,
            institutionName: dto.institutionName ?? dto.connectorName ?? "",
            lastFour: dto.lastFour ?? "****",
            outstanding: money(string: dto.outstanding),
            openTotal: money(string: dto.openTotal),
            openDueKey: dto.openDueKey,
            openDueDate: dto.openDueDate.flatMap(InstantDate.init(isoString:)),
            openTitle: dto.openTitle,
            lastPaidTotal: dto.lastPaidTotal.map(money(string:)),
            lastPaidKey: dto.lastPaidKey,
            lastPaidTitle: dto.lastPaidTitle,
            creditLimit: dto.creditLimit.map(money(string:)),
            availableLimit: dto.availableLimit.map(money(string:)),
            marketingName: dto.marketingName ?? "",
            connectorName: dto.connectorName ?? "",
            iconKey: dto.iconKey,
            cardFaceURL: dto.cardFaceUrl.flatMap(URL.init(string:))
        )
    }

    public static func creditBillPeriod(_ dto: CreditBillPeriodDTO) -> CreditBillPeriod {
        CreditBillPeriod(
            openDueKey: dto.openDueKey,
            bills: dto.bills.map(creditBillBucket)
        )
    }

    public static func creditBillBucket(_ dto: CreditBillBucketDTO) -> CreditBillBucket {
        CreditBillBucket(
            dueMonth: dto.dueMonth,
            title: dto.title,
            type: CreditBillKind(rawValue: dto.type) ?? .past,
            total: money(string: dto.total),
            dueDate: dto.dueDate.flatMap(InstantDate.init(isoString:)),
            dueDateShort: dto.dueDateShort ?? "",
            isPaid: dto.isPaid ?? false,
            hasOfficial: dto.hasOfficial ?? false,
            items: dto.items.map(creditBillLine)
        )
    }

    public static func creditBillLine(_ dto: CreditBillLineDTO) -> CreditBillLine {
        CreditBillLine(
            id: dto.id,
            accountId: dto.accountId ?? "",
            accountName: dto.accountName ?? "",
            description: dto.description,
            amount: money(string: dto.amount),
            isCredit: dto.isCredit ?? false,
            isPayment: dto.isPayment ?? false,
            isProjected: dto.isProjected ?? false,
            isPending: dto.isPending ?? false,
            category: dto.category,
            categoryId: dto.categoryId,
            purchaseDate: dto.purchaseDate.flatMap(InstantDate.init(isoString:)),
            installmentNumber: dto.installmentNumber,
            installmentTotal: dto.installmentTotal,
            merchantName: dto.merchantName
        )
    }

    private static func money(string: String) -> Money {
        Money(amount: Decimal(string: string) ?? .zero)
    }

    // MARK: - Financial Moment

    public static func financialMomentDetail(_ dto: FinancialMomentDTO) -> FinancialMomentDetail {
        let yearMonth = YearMonth(key: dto.selectedMonth) ?? YearMonth(from: Date())
        let statuses = (dto.monthsStatus ?? [:]).mapValues(monthStatus)
        
        return FinancialMomentDetail(
            selectedMonth: yearMonth,
            salary: money(dto.salary),
            receivables: receivablesSummary(dto.receivables),
            creditCards: creditCardsSummary(dto.creditCards),
            automaticDebits: automaticDebitsSummary(dto.automaticDebits),
            manualExpenses: manualExpensesSummary(dto.manualExpenses),
            totals: financialTotals(dto.totals),
            status: monthStatus(dto.status),
            monthsStatus: statuses,
            mealBenefits: mealBenefitsSummary(dto.mealBenefits)
        )
    }

    public static func mealBenefitsSummary(_ dto: MealBenefitsSummaryDTO?) -> MealBenefitsSummary {
        MealBenefitsSummary(items: (dto?.items ?? []).map(mealBenefitMomentItem))
    }

    public static func mealBenefitMomentItem(_ dto: MealBenefitMomentItemDTO) -> MealBenefitMomentItem {
        MealBenefitMomentItem(
            id: dto.id,
            kind: MealBenefitKind(rawValue: dto.kind) ?? .va,
            label: dto.label,
            remaining: money(dto.remaining),
            monthCredit: money(dto.monthCredit),
            monthSpent: money(dto.monthSpent),
            creditDay: dto.creditDay,
            ownerLabel: dto.ownerLabel
        )
    }

    public static func receivablesSummary(_ dto: ReceivablesSummaryDTO) -> ReceivablesSummary {
        ReceivablesSummary(
            items: dto.items.map(receivableItem),
            total: money(dto.total)
        )
    }

    public static func receivableItem(_ dto: ReceivableItemDTO) -> ReceivableItem {
        ReceivableItem(
            personName: dto.personName,
            personColor: dto.personColor,
            description: dto.description,
            amount: money(dto.amount),
            installmentNumber: dto.installmentNumber,
            totalInstallments: dto.totalInstallments,
            isPaid: dto.isPaid,
            ownerLabel: dto.ownerLabel,
            receivableId: dto.receivableId
        )
    }

    public static func creditCardsSummary(_ dto: CreditCardsSummaryDTO) -> CreditCardsSummary {
        CreditCardsSummary(
            bills: dto.bills.map(creditCardBillItem),
            total: money(dto.total)
        )
    }

    public static func creditCardBillItem(_ dto: CreditCardBillItemDTO) -> CreditCardBillItem {
        CreditCardBillItem(
            cardId: dto.cardId,
            cardName: dto.cardName,
            amount: money(dto.amount),
            dueDate: dto.dueDate,
            isPaid: dto.isPaid,
            isFallback: dto.isFallback,
            ownerLabel: dto.ownerLabel,
            lastFour: dto.lastFour ?? "****",
            institutionName: dto.institutionName ?? "",
            marketingName: dto.marketingName ?? "",
            connectorName: dto.connectorName ?? "",
            iconKey: dto.iconKey,
            cardFaceURL: dto.cardFaceUrl.flatMap(URL.init(string:))
        )
    }

    public static func automaticDebitsSummary(_ dto: AutomaticDebitsSummaryDTO) -> AutomaticDebitsSummary {
        AutomaticDebitsSummary(
            items: dto.items.map(automaticDebitItem),
            total: money(dto.total)
        )
    }

    public static func automaticDebitItem(_ dto: AutomaticDebitItemDTO) -> AutomaticDebitItem {
        AutomaticDebitItem(
            id: dto.id,
            description: dto.description,
            amount: money(dto.amount),
            date: dto.date,
            accountId: dto.accountId,
            accountName: dto.accountName,
            isPending: dto.isPending
        )
    }

    public static func manualExpensesSummary(_ dto: ManualExpensesSummaryDTO) -> ManualExpensesSummary {
        ManualExpensesSummary(
            items: dto.items.map(manualExpenseItem),
            total: money(dto.total)
        )
    }

    public static func manualExpenseItem(_ dto: ManualExpenseItemDTO) -> ManualExpenseItem {
        ManualExpenseItem(
            id: dto.id,
            description: dto.description,
            amount: money(dto.amount),
            date: dto.date,
            category: dto.category,
            isPaid: dto.isPaid,
            ownerLabel: dto.ownerLabel
        )
    }

    public static func financialTotals(_ dto: FinancialTotalsDTO) -> FinancialTotals {
        FinancialTotals(
            income: money(dto.income),
            expenses: money(dto.expenses),
            accountsPayable: money(dto.accountsPayable),
            netBalance: money(dto.netBalance)
        )
    }

    public static func monthStatus(_ dto: MonthStatusDTO) -> MonthStatus {
        MonthStatus(
            isPositive: dto.isPositive,
            net: money(dto.net)
        )
    }

    public static func salarySetting(_ dto: SalarySettingDTO) -> SalarySetting {
        SalarySetting(
            currentAmount: money(dto.currentAmount),
            isDefault: dto.isDefault
        )
    }

    public static func dashboard(_ dto: DashboardDTO) -> DashboardSnapshot {
        DashboardSnapshot(
            displayName: dto.displayName,
            selectedMonth: YearMonth(key: dto.selectedMonth) ?? YearMonth(from: Date()),
            summary: DashboardSummary(
                netWorth: money(dto.summary.netWorth),
                bankBalance: money(dto.summary.bankBalance),
                reservedBalance: money(dto.summary.reservedBalance),
                investmentTotal: money(dto.summary.investmentTotal),
                creditDebt: money(dto.summary.creditDebt),
                openBillsTotal: money(dto.summary.openBillsTotal ?? 0),
                loansTotal: money(dto.summary.loansTotal),
                totalAssets: money(dto.summary.totalAssets),
                bankCount: dto.summary.bankCount,
                creditCount: dto.summary.creditCount
            ),
            cashflow: DashboardCashflow(
                income: money(dto.cashflow.income),
                expense: money(dto.cashflow.expense),
                net: money(dto.cashflow.net),
                savingsRate: dto.cashflow.savingsRate
            ),
            monthOverMonth: DashboardMonthOverMonth(
                expenseDeltaPct: dto.monthOverMonth.expenseDeltaPct,
                currentExpense: money(dto.monthOverMonth.currentExpense),
                previousExpense: money(dto.monthOverMonth.previousExpense)
            ),
            netWorthSeries: dto.netWorthSeries.map {
                DashboardSeriesPoint(ym: $0.ym, month: $0.month, value: $0.value)
            },
            incomeExpenseSeries: dto.incomeExpenseSeries.map {
                DashboardCashflowPoint(
                    ym: $0.ym,
                    month: $0.month,
                    receita: $0.receita,
                    despesa: $0.despesa,
                    net: $0.net
                )
            },
            categoryExpenses: dto.categoryExpenses.map {
                DashboardCategoryExpense(
                    name: $0.name,
                    value: $0.value,
                    colorHex: $0.color ?? "#6366f1"
                )
            },
            insights: dto.insights.map {
                DashboardInsight(id: $0.id, type: $0.type, text: $0.text)
            },
            weeklyRecap: DashboardWeeklyRecap(
                total: money(dto.weeklyRecap.total),
                deltaPct: dto.weeklyRecap.deltaPct,
                topCategoryName: dto.weeklyRecap.topCategory?.name,
                topCategoryValue: dto.weeklyRecap.topCategory.map { money($0.value) }
            ),
            recentTransactions: dto.recentTransactions.map { tx in
                DashboardRecentTransaction(
                    id: tx.id,
                    description: tx.description,
                    category: tx.category,
                    categoryId: tx.categoryId,
                    date: tx.date,
                    dateRelative: tx.dateRelative,
                    amount: money(tx.amount),
                    isCredit: tx.isCredit,
                    isPending: tx.isPending,
                    accountId: tx.accountId,
                    accountName: tx.accountName
                )
            },
            recentCreditPurchases: (dto.recentCreditPurchases ?? []).map { tx in
                DashboardRecentTransaction(
                    id: tx.id,
                    description: tx.description,
                    category: tx.category,
                    categoryId: tx.categoryId,
                    date: tx.date,
                    dateRelative: tx.dateRelative,
                    amount: money(tx.amount),
                    isCredit: tx.isCredit,
                    isPending: tx.isPending,
                    accountId: tx.accountId,
                    accountName: tx.accountName
                )
            },
            dailySpend: (dto.dailySpend ?? []).map {
                DashboardDailySpendPoint(
                    date: $0.date,
                    amount: money($0.amount).amount,
                    maxPurchase: money($0.maxPurchase ?? 0).amount,
                    topPurchaseDescription: $0.topPurchaseDescription,
                    topPurchaseCategory: $0.topPurchaseCategory,
                    topPurchaseAmount: $0.topPurchaseAmount.map { money($0).amount },
                    topPurchaseId: $0.topPurchaseId,
                    topPurchaseAccountName: $0.topPurchaseAccountName
                )
            },
            budgetCategories: dto.budgetCategories.map {
                DashboardBudgetCategory(
                    category: $0.category,
                    spent: money($0.spent),
                    limit: money($0.limit),
                    percent: $0.percent,
                    colorHex: $0.color ?? "#6366f1"
                )
            },
            calculationVersion: dto.calculationVersion
        )
    }

    static func agendaItem(_ dto: AgendaScreenItemDTO) -> AgendaItem {
        AgendaItem(
            id: dto.id,
            title: dto.title,
            date: InstantDate(isoString: String(dto.date.prefix(10))) ?? InstantDate(from: Date()),
            amount: dto.amount.map { money($0) },
            kind: AgendaItemKind(rawValue: dto.kind) ?? .custom,
            isCompleted: dto.isCompleted ?? false
        )
    }

    static func budgetLimit(_ dto: BudgetScreenRowDTO, month: YearMonth) -> BudgetLimit {
        let period = BudgetPeriod(rawValue: dto.period ?? "monthly") ?? .monthly
        let allowance = money(dto.allowance ?? dto.limit)
        return BudgetLimit(
            id: dto.id ?? dto.category,
            category: dto.category,
            limit: allowance,
            spent: money(dto.spent),
            month: month,
            period: period,
            periodAmount: money(dto.periodAmount ?? dto.limit),
            monthCap: money(dto.monthCap ?? dto.limit),
            periodIndex: dto.periodIndex ?? 1,
            periodCount: dto.periodCount ?? 1,
            spentBank: money(dto.spentBank ?? dto.spent),
            spentMeal: money(dto.spentMeal ?? 0),
            hasLimit: dto.hasLimit ?? ((dto.periodAmount ?? dto.limit) > 0)
        )
    }

    static func reports(_ dto: ReportsScreenDTO) -> ReportsSnapshot {
        ReportsSnapshot(
            months: dto.months,
            selectedMonth: YearMonth(key: dto.selectedMonth) ?? YearMonth(from: Date()),
            income: money(dto.income),
            expense: money(dto.expense),
            categories: dto.categories.map { ReportCategory(name: $0.name, amount: money($0.value)) },
            accounts: dto.accounts.map {
                ReportAccountRef(id: $0.id, name: $0.name, type: $0.type ?? "BANK")
            },
            calculationVersion: dto.calculationVersion
        )
    }

    static func subscription(_ dto: SubscriptionScreenItemDTO) -> Subscription {
        Subscription(
            id: dto.id,
            name: dto.name,
            amount: money(dto.amount),
            billingDay: dto.billingDay,
            category: dto.category,
            isActive: dto.isActive ?? true
        )
    }

    private static func money(_ amount: Double) -> Money {
        Money(amount: Decimal(amount))
    }
}

private extension ISO8601DateFormatter {
    nonisolated(unsafe) static let withFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
