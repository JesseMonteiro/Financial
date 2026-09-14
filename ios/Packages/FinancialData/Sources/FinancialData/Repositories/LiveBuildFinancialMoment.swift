import Foundation
import FinancialDomain

/// Cashflow-style Momento for the selected month (parity with web KPIs, simplified).
/// Entradas/saídas vêm das transações do mês; faturas abertas entram como contas a pagar.
public struct LiveBuildFinancialMoment: BuildFinancialMomentUseCase {
    private let accounts: any AccountsRepository
    private let transactions: any TransactionsRepository
    private let bills: any BillsRepository

    public init(
        accounts: any AccountsRepository,
        transactions: any TransactionsRepository,
        bills: any BillsRepository
    ) {
        self.accounts = accounts
        self.transactions = transactions
        self.bills = bills
    }

    public func execute(month: YearMonth) async throws -> FinancialMomentSummary {
        async let accountsTask = accounts.fetchAccounts()
        async let txTask = transactions.fetchTransactions(accountId: nil, month: month)

        let loadedAccounts = try await accountsTask
        let creditCards = loadedAccounts.filter { $0.type == .credit }

        var monthBills: [Bill] = []
        for card in creditCards {
            let cardBills = (try? await bills.fetchBills(accountId: card.id, dueMonth: nil)) ?? []
            monthBills.append(contentsOf: cardBills.filter { $0.dueMonth == month })
        }

        let txs = try await txTask
        let bankTxs = txs.filter { tx in
            guard let account = loadedAccounts.first(where: { $0.id == tx.accountId }) else {
                return true
            }
            return account.type != .credit
        }

        let income = bankTxs
            .filter { $0.kind == .credit }
            .reduce(Decimal.zero) { $0 + $1.amount.amount }

        let bankExpense = bankTxs
            .filter { $0.kind == .debit }
            .reduce(Decimal.zero) { $0 + $1.amount.amount }

        let billsDue = monthBills.reduce(Decimal.zero) { $0 + $1.totalAmount.amount }
        let unpaidBills = monthBills.filter { !$0.isPaid }.reduce(Decimal.zero) { $0 + $1.totalAmount.amount }

        // Fallback when Pluggy bills are missing: use credit outstanding as payable proxy.
        let creditOutstanding = creditCards.reduce(Decimal.zero) { $0 + $1.balance.amount }
        let expenseTotal = bankExpense + (billsDue > 0 ? billsDue : 0)
        let payable = unpaidBills > 0 ? unpaidBills : creditOutstanding

        var highlights: [String] = []
        if income > 0 {
            highlights.append("Entradas no mês: \(Money(amount: income).formatted())")
        }
        if billsDue > 0 {
            highlights.append("Faturas com vencimento em \(month.displayName()): \(Money(amount: billsDue).formatted())")
        } else if creditOutstanding > 0 {
            highlights.append("Saldo em cartões: \(Money(amount: creditOutstanding).formatted())")
        }
        if payable > 0 {
            highlights.append("Contas a pagar: \(Money(amount: payable).formatted())")
        }
        if highlights.isEmpty {
            highlights.append("Sem lançamentos relevantes neste mês.")
        }

        return FinancialMomentSummary(
            month: month,
            income: Money(amount: income),
            expense: Money(amount: expenseTotal),
            balance: Money(amount: income - expenseTotal),
            highlights: highlights
        )
    }
}

