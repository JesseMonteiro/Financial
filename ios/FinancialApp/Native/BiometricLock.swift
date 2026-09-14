import LocalAuthentication
import Foundation
import FinancialCore

/// Device biometric lock gate for sensitive surfaces.
@MainActor
public final class BiometricLock {
    private let logger: AppLogger

    public init(logger: AppLogger = AppLogger()) {
        self.logger = logger
    }

    public var biometryTypeName: String {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return "Senha do dispositivo"
        }
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        @unknown default: return "Biometria"
        }
    }

    public func unlock(reason: String = "Desbloquear o Financial") async -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            logger.info("Biometria indisponível: \(error?.localizedDescription ?? "n/d")", category: .auth)
            return false
        }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            logger.error("Falha na biometria: \(error.localizedDescription)", category: .auth)
            return false
        }
    }
}

