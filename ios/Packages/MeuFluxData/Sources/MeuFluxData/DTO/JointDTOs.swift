import Foundation

public struct JointStatusResponseDTO: Codable, Sendable {
    public let link: JointLinkDTO?
}

public struct JointLinkDTO: Codable, Sendable {
    public let id: String
    public let status: String
    public let partnerId: String?
    public let partnerDisplayName: String?
    public let inviteToken: String?
    public let inviteExpiresAt: String?
    public let userA: String?
    public let userB: String?
}

public struct JointMemberDTO: Codable, Sendable {
    public let id: String
    public let displayName: String
    public let salary: Double
    public let isCurrentUser: Bool
}

/// Joint financial-moment response: FM payload + members + link.
public struct JointMomentDTO: Codable, Sendable {
    public let link: JointLinkDTO
    public let members: [JointMemberDTO]
    public let selectedMonth: String
    public let salary: Double
    public let receivables: ReceivablesSummaryDTO
    public let creditCards: CreditCardsSummaryDTO
    public let automaticDebits: AutomaticDebitsSummaryDTO
    public let manualExpenses: ManualExpensesSummaryDTO
    public let totals: FinancialTotalsDTO
    public let status: MonthStatusDTO
    public let monthsStatus: [String: MonthStatusDTO]?
    public let mealBenefits: MealBenefitsSummaryDTO?
}

public struct JointInviteResponseDTO: Codable, Sendable {
    public let success: Bool?
    public let token: String?
}

public struct JointAcceptResponseDTO: Codable, Sendable {
    public let success: Bool?
    public let message: String?
}

