import Foundation
import MeuFluxCore

public struct OfflineMutation: Sendable, Identifiable, Codable {
    public let id: UUID
    public let path: String
    public let method: String
    public let body: Data?
    public let createdAt: Date

    public init(id: UUID = UUID(), path: String, method: String, body: Data? = nil, createdAt: Date = Date()) {
        self.id = id
        self.path = path
        self.method = method
        self.body = body
        self.createdAt = createdAt
    }
}

public actor OfflineMutationQueue {
    private var queue: [OfflineMutation] = []
    private let logger: AppLogger

    public init(logger: AppLogger = AppLogger()) {
        self.logger = logger
    }

    public func enqueue(_ mutation: OfflineMutation) {
        queue.append(mutation)
        logger.info("Enfileirada mutação offline \(mutation.path)", category: .sync)
    }

    public func pending() -> [OfflineMutation] {
        queue
    }

    public func dequeue() -> OfflineMutation? {
        guard !queue.isEmpty else { return nil }
        return queue.removeFirst()
    }

    public func flush(using api: APIClientProtocol) async {
        while let mutation = dequeue() {
            do {
                let method = HTTPMethod(rawValue: mutation.method) ?? .post
                _ = try await api.sendRaw(
                    APIRequest(path: mutation.path, method: method, body: mutation.body)
                )
            } catch {
                enqueue(mutation)
                logger.error("Falha ao enviar mutação offline: \(error)", category: .sync)
                break
            }
        }
    }
}
