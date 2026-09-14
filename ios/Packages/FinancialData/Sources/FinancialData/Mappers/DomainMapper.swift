import Foundation
import FinancialDomain

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
        return Account(
            id: dto.id,
            name: dto.marketingName ?? dto.name,
            type: mappedType,
            balance: money(amount: dto.balance, currencyCode: currency),
            institutionName: dto.name,
            connectorId: dto.itemId,
            isHidden: false,
            currencyCode: currency
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
        return Transaction(
            id: dto.id,
            accountId: dto.accountId,
            description: dto.description,
            amount: money(amount: abs(dto.amount), currencyCode: currency),
            date: InstantDate(isoString: dto.date) ?? InstantDate(year: 1970, month: 1, day: 1),
            category: dto.category,
            kind: kind,
            isPending: (dto.status ?? "").uppercased() == "PENDING"
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
            inviteToken: dto.inviteToken
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
            monthsStatus: dto.monthsStatus
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
        BudgetLimit(
            id: dto.id ?? dto.category,
            category: dto.category,
            limit: money(amount: dto.limit),
            spent: spent,
            month: month
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

    static func receivable(_ dto: DomainReceivableRowDTO) -> Receivable {
        let paid = dto.paidInstallments ?? 0
        let total = max(1, dto.installments ?? 1)
        return Receivable(
            id: dto.id,
            description: dto.description ?? "Recebível",
            amount: money(amount: dto.totalAmount),
            isReceived: paid >= total && !(dto.isContinuous ?? false),
            counterparty: dto.personName,
            installments: total,
            paidInstallments: paid,
            isContinuous: dto.isContinuous ?? false
        )
    }

    static func manualExpense(_ dto: DomainManualRowDTO) -> ManualExpense {
        ManualExpense(
            id: dto.id,
            description: dto.description,
            amount: money(amount: abs(dto.amount)),
            date: InstantDate(isoString: String(dto.date.prefix(10))) ?? InstantDate(from: Date()),
            category: dto.category,
            accountId: dto.accountId,
            isPaid: dto.isPaid ?? false,
            isRecurring: dto.isRecurring ?? false,
            isContinuous: dto.isContinuous ?? false
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
            monthsStatus: statuses
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
            ownerLabel: dto.ownerLabel
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
                    date: tx.date,
                    dateRelative: tx.dateRelative,
                    amount: money(tx.amount),
                    isCredit: tx.isCredit,
                    isPending: tx.isPending
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
            }
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
