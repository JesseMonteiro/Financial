import Foundation
import FinancialDomain

/// Momento KPIs from the BFF detail payload — iOS does not recalculate money.
public struct LiveBuildFinancialMoment: BuildFinancialMomentUseCase {
    private let detail: any BuildFinancialMomentDetailUseCase

    public init(detail: any BuildFinancialMomentDetailUseCase) {
        self.detail = detail
    }

    public func execute(month: YearMonth) async throws -> FinancialMomentSummary {
        let loaded = try await detail.execute(month: month, force: false)
        var highlights: [String] = []
        if !loaded.totals.income.isZero {
            highlights.append("Entradas no mês: \(loaded.totals.income.formatted())")
        }
        if !loaded.creditCards.total.isZero {
            highlights.append("Faturas do mês: \(loaded.creditCards.total.formatted())")
        }
        if !loaded.totals.accountsPayable.isZero {
            highlights.append("Contas a pagar: \(loaded.totals.accountsPayable.formatted())")
        }
        if highlights.isEmpty {
            highlights.append("Sem lançamentos relevantes neste mês.")
        }
        return FinancialMomentSummary(
            month: month,
            income: loaded.totals.income,
            expense: loaded.totals.expenses,
            balance: loaded.totals.netBalance,
            highlights: highlights
        )
    }
}
