import Foundation
import FinancialDomain

public struct LiveBuildFinancialMomentDetail: BuildFinancialMomentDetailUseCase {
    private let bffClient: BFFClient

    public init(bffClient: BFFClient) {
        self.bffClient = bffClient
    }

    public func execute(month: YearMonth, force: Bool) async throws -> FinancialMomentDetail {
        let dto = try await bffClient.getFinancialMoment(month: month, force: force)
        
        return try await Task.detached(priority: .userInitiated) {
            DomainMapper.financialMomentDetail(dto)
        }.value
    }
}

public struct LiveManageMonthlySalary: ManageMonthlySalaryUseCase {
    private let bffClient: BFFClient

    public init(bffClient: BFFClient) {
        self.bffClient = bffClient
    }

    public func getCurrentSalary(for month: YearMonth) async throws -> SalarySetting {
        let dto = try await bffClient.getCurrentSalary(for: month)
        return DomainMapper.salarySetting(dto)
    }

    public func saveSalary(_ amount: Money, for month: YearMonth) async throws {
        try await bffClient.saveSalary(amount, for: month)
    }
}

public struct LiveToggleManualExpensePaid: ToggleManualExpensePaidUseCase {
    private let bffClient: BFFClient

    public init(bffClient: BFFClient) {
        self.bffClient = bffClient
    }

    public func execute(expenseId: String, isPaid: Bool) async throws {
        try await bffClient.toggleManualExpensePaid(expenseId: expenseId, isPaid: isPaid)
    }
}