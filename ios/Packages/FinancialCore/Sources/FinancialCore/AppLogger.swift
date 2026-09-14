import Foundation
import os.log

public enum LogCategory: String, Sendable {
    case network
    case auth
    case sync
    case ui
    case cache
    case general
}

public struct AppLogger: Sendable {
    private let subsystem: String
    private let enabled: Bool

    public init(subsystem: String = "com.financial.app", enabled: Bool = true) {
        self.subsystem = subsystem
        self.enabled = enabled
    }

    public func debug(_ message: String, category: LogCategory = .general, correlationID: String? = nil) {
        log(message, type: .debug, category: category, correlationID: correlationID)
    }

    public func info(_ message: String, category: LogCategory = .general, correlationID: String? = nil) {
        log(message, type: .info, category: category, correlationID: correlationID)
    }

    public func error(_ message: String, category: LogCategory = .general, correlationID: String? = nil) {
        log(message, type: .error, category: category, correlationID: correlationID)
    }

    private func log(
        _ message: String,
        type: OSLogType,
        category: LogCategory,
        correlationID: String?
    ) {
        guard enabled else { return }
        let prefix = correlationID.map { "[\($0)] " } ?? ""
        let line = "\(prefix)\(message)"
        let log = OSLog(subsystem: subsystem, category: category.rawValue)
        os_log("%{public}@", log: log, type: type, line)
    }
}
