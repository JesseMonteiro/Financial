import XCTest
@testable import MeuFluxCore

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

    func testIdentityReadsEmailAndFullName() {
        let jwt = Self.makeJWT(exp: 2_000, claims: [
            "email": "jesse@meuflux.app",
            "user_metadata": ["full_name": "Jesse Monteiro"],
        ])
        let identity = JWT.accountIdentity(of: jwt)
        XCTAssertEqual(identity?.email, "jesse@meuflux.app")
        XCTAssertEqual(identity?.displayName, "Jesse Monteiro")
    }

    func testIdentityIgnoresEmptyClaims() {
        let jwt = Self.makeJWT(exp: 2_000, claims: ["email": "  "])
        XCTAssertNil(JWT.accountIdentity(of: jwt))
    }

    private static func makeJWT(exp: Int, claims: [String: Any] = [:]) -> String {
        let header = encode(["alg": "none", "typ": "JWT"])
        var payload: [String: Any] = ["exp": exp]
        for (key, value) in claims { payload[key] = value }
        return "\(header).\(encode(payload)).sig"
    }

    private static func encode(_ object: [String: Any]) -> String {
        let data = try! JSONSerialization.data(withJSONObject: object)
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
    }
}

