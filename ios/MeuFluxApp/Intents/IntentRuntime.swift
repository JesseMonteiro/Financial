import Foundation
import MeuFluxDomain

@MainActor
final class IntentRuntime {
    static let shared = IntentRuntime()

    weak var composition: AppCompositionRoot?

    func bind(_ composition: AppCompositionRoot) {
        self.composition = composition
    }

    func open(_ route: AppRoute) {
        composition?.selectedRoute = route
    }

    func syncAllBanks() async -> String {
        guard let composition else {
            return "Abra o MeuFlux para sincronizar os bancos."
        }
        do {
            let items = try await composition.bankConnectionsRepository.fetchItems(force: true)
            guard !items.isEmpty else {
                return "Nenhuma conexão bancária encontrada."
            }
            var ok = 0
            for item in items {
                do {
                    try await composition.syncBankItem.execute(itemId: item.id)
                    ok += 1
                } catch {
                    composition.logger.error(
                        "Sync intent failed for \(item.id): \(error.localizedDescription)",
                        category: .sync
                    )
                }
            }
            await composition.refreshWidgetSnapshot(force: true)
            return "Sincronizamos \(ok) de \(items.count) conexão(ões)."
        } catch {
            return (error as? FinancialError)?.messagePT ?? "Não foi possível sincronizar agora."
        }
    }

    func addManualExpense(amount: Decimal, description: String, category: ExpenseCategoryKind) async -> String {
        guard let composition else {
            return "Abra o MeuFlux para lançar a despesa."
        }
        do {
            let accounts = try await composition.accountsRepository.fetchAccounts(force: false)
            guard let account = accounts.first(where: \.isManual) ?? accounts.first else {
                composition.selectedRoute = .manualExpenses
                return "Crie uma conta manual no app para lançar esta despesa."
            }
            let expense = ManualExpense(
                id: UUID().uuidString,
                description: description,
                amount: Money(amount: amount),
                date: InstantDate(from: Date()),
                category: category.rawValue,
                accountId: account.id,
                isPaid: true,
                paidAt: InstantDate(from: Date())
            )
            _ = try await composition.manualExpensesRepository.createExpense(expense)
            return "Lancei \(Money(amount: amount).formatted()) em \(description) (\(category.labelPT))."
        } catch {
            return (error as? FinancialError)?.messagePT ?? "Não consegui lançar a despesa."
        }
    }
}
