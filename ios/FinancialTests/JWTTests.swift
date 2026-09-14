import XCTest
@testable import FinancialCore

final class JWTTests: XCTestCase {
    func testExpiryReadsExpClaim() {
        let exp: Int = 1_800_000_000
        let jwt = Self.makeJWT(exp: exp)
        let expiry = JWT.expiry(of: jwt)
        XCTAssertEqual(expiry?.timeIntervalSince1970, TimeInterval(exp))
    }

    func testNeedsRefreshWhenExpired() {
        let jwt = Self.makeJWT(exp: 1_000)
        XCTAssertTrue(JWT.needsRefresh(jwt, now: Date(timeIntervalSince1970: 2_000)))
    }

    func testDoesNotNeedRefreshWhenFresh() {
        let now = Date(timeIntervalSince1970: 1_000)
        let jwt = Self.makeJWT(exp: 2_000)
        XCTAssertFalse(JWT.needsRefresh(jwt, now: now, leeway: 60))
    }

    func testNeedsRefreshInsideLeeway() {
        let now = Date(timeIntervalSince1970: 1_950)
        let jwt = Self.makeJWT(exp: 2_000)
        XCTAssertTrue(JWT.needsRefresh(jwt, now: now, leeway: 60))
    }

    func testMalformedTokenNeedsRefresh() {
        XCTAssertTrue(JWT.needsRefresh("not-a-jwt"))
    }

    private static func makeJWT(exp: Int) -> String {
        let header = encode(["alg": "none", "typ": "JWT"])
        let payload = encode(["exp": exp])
        return "\(header).\(payload).sig"
    }

    private static func encode(_ object: [String: Any]) -> String {
        let data = try! JSONSerialization.data(withJSONObject: object)
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
    }
}

