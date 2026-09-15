import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct ImportReviewSheet: View {
    @State private var viewModel: ImportReviewViewModel
    @Environment(\.dismiss) private var dismiss

    public init(
        recordId: String,
        importer: any NotificationImporting,
        mealBenefits: any MealBenefitsRepository,
        accounts: any AccountsRepository
    ) {
        _viewModel = State(
            initialValue: ImportReviewViewModel(
                recordId: recordId,
                importer: importer,
                mealBenefits: mealBenefits,
                accounts: accounts
            )
        )
    }

    public var body: some View {
        NavigationStack {
            Form {
                if let parsed = viewModel.record?.parsed {
                    Section("Notificação") {
                        Text(parsed.combinedText)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                }
                Section("Lançamento") {
                    TextField("Descrição", text: $viewModel.merchant)
                    TextField("Valor", text: $viewModel.amountText)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                    DatePicker("Data", selection: $viewModel.date, displayedComponents: .date)
                    Picker("Categoria", selection: $viewModel.selectedCategory) {
                        ForEach(ExpenseCategoryKind.allCases) { kind in
                            Text(kind.labelPT).tag(kind)
                        }
                    }
                }
                Section("Destino") {
                    Picker("Conta", selection: $viewModel.selectedDestinationId) {
                        Text("Escolher").tag(String?.none)
                        ForEach(viewModel.destinationOptions) { option in
                            Text(option.label).tag(Optional(option.id))
                        }
                    }
                }
                if let error = viewModel.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                }
                if viewModel.record?.createdEntityId != nil {
                    Section {
                        Button("Desfazer importação", role: .destructive) {
                            Task {
                                if await viewModel.undo() { dismiss() }
                            }
                        }
                    }
                }
            }
            .meuFluxPageTitle("Revisar compra")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            if await viewModel.save() { dismiss() }
                        }
                    }
                    .disabled(viewModel.isSaving || viewModel.destinationOptions.isEmpty)
                }
            }
            .task { await viewModel.load() }
        }
    }
}
