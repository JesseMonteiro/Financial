import Foundation
import MeuFluxCore
import MeuFluxDomain

public enum WidgetSnapshotMapper {
    public static func financialMoment(
        _ detail: FinancialMomentDetail,
        now: Date = Date()
    ) -> FinancialMomentWidgetSnapshot {
        let net = detail.totals.netBalance
        let netOk = net.amount >= 0
        return FinancialMomentWidgetSnapshot(
            monthKey: detail.selectedMonth.key,
            monthLabel: detail.selectedMonth.displayName(),
            incomeLabel: detail.totals.income.formatted(),
            expenseLabel: detail.totals.expenses.formatted(),
            payableLabel: detail.totals.accountsPayable.formatted(),
            netLabel: (netOk ? "+" : "") + net.formatted(),
            utilizationPercent: detail.totals.utilizationPercent,
            isNetPositive: netOk,
            isOverBudget: detail.totals.isOverBudget,
            payableIsClear: detail.totals.accountsPayable.isZero,
            unpaidBillsCount: detail.creditCards.unpaidBills.count,
            unpaidDebitsCount: detail.automaticDebits.unpaidItems.count,
            updatedAt: now
        )
    }
}

