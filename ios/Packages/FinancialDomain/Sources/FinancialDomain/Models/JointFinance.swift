import Foundation

/// Shared joint account link status (RPC `get_my_joint_link`).
public struct JointLink: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var status: String
    public var partnerId: String?
    public var partnerDisplayName: String?
    public var inviteToken: String?

    public init(
        id: String,
        status: String,
        partnerId: String? = nil,
        partnerDisplayName: String? = nil,
        inviteToken: String? = nil
    ) {
        self.id = id
        self.status = status
        self.partnerId = partnerId
        self.partnerDisplayName = partnerDisplayName
        self.inviteToken = inviteToken
    }

    public var isActive: Bool { status == "active" }
}

public struct JointMember: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var displayName: String
    public var salary: Money
    public var isCurrentUser: Bool

    public init(id: String, displayName: String, salary: Money, isCurrentUser: Bool) {
        self.id = id
        self.displayName = displayName
        self.salary = salary
        self.isCurrentUser = isCurrentUser
    }
}

/// Active joint financial moment payload for Conta conjunta.
public struct JointMomentSnapshot: Sendable, Hashable {
    public var link: JointLink
    public var members: [JointMember]
    public var detail: FinancialMomentDetail

    public init(link: JointLink, members: [JointMember], detail: FinancialMomentDetail) {
        self.link = link
        self.members = members
        self.detail = detail
    }
}

