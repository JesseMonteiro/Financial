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

    public static func jointFinance(
        _ snapshot: JointMomentSnapshot,
        now: Date = Date()
    ) -> JointFinanceWidgetSnapshot {
        let detail = snapshot.detail
        let net = detail.totals.netBalance
        let netOk = net.amount >= 0
        let names = snapshot.members.map(\.displayName).joined(separator: " · ")
        return JointFinanceWidgetSnapshot(
            hasActiveLink: snapshot.link.isActive,
            membersLabel: names,
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
            memberCount: snapshot.members.count,
            updatedAt: now
        )
    }

    public static func budget(
        _ limits: [BudgetLimit],
        month: YearMonth,
        now: Date = Date()
    ) -> BudgetWidgetSnapshot {
        let withLimit = limits.filter(\.hasLimit)
        let spentTotal = limits.reduce(Money.zero) { $0.adding($1.spent) }
        let limitTotal = withLimit.reduce(Money.zero) { $0.adding($1.limit) }
        let remaining = limitTotal.subtracting(spentTotal)
        let hasLimits = !withLimit.isEmpty
        let isOver = hasLimits && spentTotal.amount > limitTotal.amount
        let percent: Int = {
            guard limitTotal.amount > 0 else { return 0 }
            let ratio = spentTotal.amount / limitTotal.amount
            let value = NSDecimalNumber(decimal: ratio * 100).doubleValue
            guard value.isFinite else { return 0 }
            return min(100, max(0, Int(value.rounded())))
        }()
        let overCount = withLimit.filter { $0.spent.amount > $0.limit.amount }.count
        let top = withLimit
            .map { limit -> (BudgetLimit, Int) in
                let ratio = limit.limit.amount == 0 ? 0 : limit.spent.amount / limit.limit.amount
                let raw = NSDecimalNumber(decimal: ratio * 100).doubleValue
                let pct = raw.isFinite ? max(0, Int(raw.rounded())) : 0
                return (limit, pct)
            }
            .sorted { lhs, rhs in
                if lhs.1 == rhs.1 { return lhs.0.category < rhs.0.category }
                return lhs.1 > rhs.1
            }
            .prefix(3)
            .map { pair in
                BudgetWidgetCategory(
                    name: pair.0.category,
                    spentLabel: pair.0.spent.formatted(),
                    limitLabel: pair.0.limit.formatted(),
                    percent: pair.1,
                    isOver: pair.0.spent.amount > pair.0.limit.amount
                )
            }

        let remainingSubtitle: String
        if !hasLimits {
            remainingSubtitle = "Defina metas nas categorias"
        } else if isOver {
            remainingSubtitle = "Verba excedida"
        } else {
            remainingSubtitle = "Dentro da verba"
        }

        return BudgetWidgetSnapshot(
            monthKey: month.key,
            monthLabel: month.displayName(),
            spentLabel: spentTotal.formatted(),
            limitLabel: hasLimits ? limitTotal.formatted() : "R$ —",
            remainingLabel: hasLimits ? Money(amount: abs(remaining.amount)).formatted() : "R$ —",
            remainingSubtitle: remainingSubtitle,
            utilizationPercent: percent,
            isOverBudget: isOver,
            hasLimits: hasLimits,
            categoriesWithBudget: withLimit.count,
            overBudgetCount: overCount,
            topCategories: Array(top),
            updatedAt: now
        )
    }
}

