import XCTest
@testable import MeuFluxData

final class CacheActorTests: XCTestCase {
    private var tempDir: URL!

    override func setUp() {
        super.setUp()
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("CacheActorTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDown() {
        if let tempDir {
            try? FileManager.default.removeItem(at: tempDir)
        }
        super.tearDown()
    }

    func testMemoryAndDiskRoundTrip() async {
        let actor1 = CacheActor(diskDirectoryURL: tempDir)
        let sampleData = Data("{\"status\":\"ok\"}".utf8)
        let key = "bff:dashboard:v3:2026-09"

        await actor1.set(sampleData, forKey: key)
        let inMemory = await actor1.get(key)
        XCTAssertEqual(inMemory, sampleData)

        // Simulate app restart by instantiating a fresh CacheActor pointing to the same disk dir
        let actor2 = CacheActor(diskDirectoryURL: tempDir)
        let fromDisk = await actor2.get(key)
        XCTAssertEqual(fromDisk, sampleData)
    }

    func testExpiration() async {
        let actor = CacheActor(defaultTTL: 0.1, diskDirectoryURL: tempDir)
        let sampleData = Data("sample".utf8)
        let key = "bff:temp"

        await actor.set(sampleData, forKey: key, ttl: 0.1)
        let fresh = await actor.get(key)
        XCTAssertEqual(fresh, sampleData)

        try? await Task.sleep(nanoseconds: 150_000_000)
        let expired = await actor.get(key)
        XCTAssertNil(expired)
    }

    func testRemoveKeysMatchingPrefix() async {
        let actor1 = CacheActor(diskDirectoryURL: tempDir)
        await actor1.set(Data("dash".utf8), forKey: "bff:dashboard:2026-09")
        await actor1.set(Data("cards".utf8), forKey: "bff:credit-cards")

        await actor1.removeKeys(matching: "bff:dashboard:")

        let dash = await actor1.get("bff:dashboard:2026-09")
        let cards = await actor1.get("bff:credit-cards")
        XCTAssertNil(dash)
        XCTAssertEqual(cards, Data("cards".utf8))

        // Check disk in a new actor instance
        let actor2 = CacheActor(diskDirectoryURL: tempDir)
        let dashDisk = await actor2.get("bff:dashboard:2026-09")
        let cardsDisk = await actor2.get("bff:credit-cards")
        XCTAssertNil(dashDisk)
        XCTAssertEqual(cardsDisk, Data("cards".utf8))
    }

    func testClear() async {
        let actor1 = CacheActor(diskDirectoryURL: tempDir)
        await actor1.set(Data("1".utf8), forKey: "key1")
        await actor1.set(Data("2".utf8), forKey: "key2")

        await actor1.clear()

        let actor2 = CacheActor(diskDirectoryURL: tempDir)
        let v1 = await actor2.get("key1")
        let v2 = await actor2.get("key2")
        XCTAssertNil(v1)
        XCTAssertNil(v2)
    }
}
