import Foundation
import FinancialCore

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

public struct APIRequest: Sendable {
    public var path: String
    public var method: HTTPMethod
    public var queryItems: [URLQueryItem]
    public var body: Data?
    public var requiresAuth: Bool
    public var correlationID: CorrelationID

    public init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        requiresAuth: Bool = true,
        correlationID: CorrelationID = .make()
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.body = body
        self.requiresAuth = requiresAuth
        self.correlationID = correlationID
    }
}

public protocol APIClientProtocol: Sendable {
    func send<T: Decodable & Sendable>(_ request: APIRequest, as type: T.Type) async throws -> T
    func sendRaw(_ request: APIRequest) async throws -> Data
}

public final class APIClient: APIClientProtocol, @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let authSession: any AuthSessionActor
    private let tokenRefresher: (any TokenRefreshing)?
    private let logger: AppLogger

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        authSession: any AuthSessionActor,
        tokenRefresher: (any TokenRefreshing)? = nil,
        logger: AppLogger = AppLogger()
    ) {
        self.baseURL = baseURL
        self.session = session
        self.authSession = authSession
        self.tokenRefresher = tokenRefresher
        self.logger = logger
    }

    public func send<T: Decodable & Sendable>(_ request: APIRequest, as type: T.Type) async throws -> T {
        let data = try await sendRaw(request)
        do {
            return try JSONDecoder.financial.decode(T.self, from: data)
        } catch {
            throw AppError.decodingFailed(String(describing: error))
        }
    }

    public func sendRaw(_ request: APIRequest) async throws -> Data {
        try await sendRaw(request, allowRefreshRetry: true)
    }

    private func sendRaw(_ request: APIRequest, allowRefreshRetry: Bool) async throws -> Data {
        let url = try makeURL(for: request)

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.httpBody = request.body
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.setValue(request.correlationID.value, forHTTPHeaderField: "X-Correlation-ID")

        if request.requiresAuth {
            let token = try await resolveAccessToken()
            if let token {
                urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        logger.debug("\(request.method.rawValue) \(request.path)", category: .network, correlationID: request.correlationID.value)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch let urlError as URLError {
            throw mapURLError(urlError)
        }

        guard let http = response as? HTTPURLResponse else {
            throw AppError.unknown("Resposta inválida")
        }
        switch http.statusCode {
        case 200...299:
            return data
        case 401:
            if request.requiresAuth, allowRefreshRetry, let refresher = tokenRefresher {
                logger.info("HTTP 401 — refreshing session and retrying \(request.path)", category: .auth)
                _ = try await refresher.refreshAccessToken()
                return try await sendRaw(request, allowRefreshRetry: false)
            }
            throw AppError.unauthorized
        case 404:
            throw AppError.notFound
        case 546:
            throw AppError.unknown(
                "O servidor precisou de mais recursos para consolidar a conta conjunta. Tente novamente em instantes."
            )
        default:
            throw AppError.unknown("HTTP \(http.statusCode)")
        }
    }

    private func resolveAccessToken() async throws -> String? {
        if let tokenRefresher {
            return try await tokenRefresher.validAccessToken()
        }
        return await authSession.accessToken()
    }

    private func makeURL(for request: APIRequest) throws -> URL {
        if baseURL.host == nil || baseURL.host?.contains("example") == true {
            throw AppError.configuration(
                "API_BASE_URL não configurada. Rode npm run ios:secrets e faça um clean build no Xcode."
            )
        }

        var url = baseURL.appending(path: request.path)
        if !request.queryItems.isEmpty {
            url.append(queryItems: request.queryItems)
        }
        return url
    }

    private func mapURLError(_ error: URLError) -> AppError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
            return .networkUnavailable
        case .timedOut:
            return .unknown("A requisição demorou demais. Tente de novo.")
        default:
            return .unknown(error.localizedDescription)
        }
    }
}

public extension JSONDecoder {
    static let financial: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

public extension JSONEncoder {
    static let financial: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}
