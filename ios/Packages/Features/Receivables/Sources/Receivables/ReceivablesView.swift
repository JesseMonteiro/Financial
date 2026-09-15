import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct ReceivablesView: View {
    @State private var viewModel: ReceivablesViewModel
    @State private var showEditor = false
    @State private var selectedDetail: LineItemDetail?

    public init(repository: any ReceivablesRepository) {
        _viewModel = State(initialValue: ReceivablesViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: ReceivablesViewModel())
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .dashboard)
                case .empty:
                    emptyContent
                case .failed(let message):
                    ErrorState(message: message) { Task { await viewModel.retry() } }
                case .loaded:
                    content
                }
            }
        }
        .meuFluxPageTitle("Valores a Receber")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.resetDraft()
                    showEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nova entrada")
            }
        }
        .sheet(isPresented: $showEditor) {
            editorSheet
        }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                onTogglePaid: {
                    if let number = item.installmentNumber {
                        Task {
                            await viewModel.markInstallmentPaid(receivableID: item.sourceId, number: number)
                            selectedDetail = nil
                        }
                    }
                },
                onEdit: {
                    if let receivable = viewModel.receivables.first(where: { $0.id == item.sourceId }) {
                        viewModel.beginEdit(receivable)
                        selectedDetail = nil
                        showEditor = true
                    }
                },
                onDelete: {
                    if let receivable = viewModel.receivables.first(where: { $0.id == item.sourceId }) {
                        viewModel.pendingDelete = receivable
                        selectedDetail = nil
                    }
                }
            )
        }
        .confirmationDialog(
            "Remover lançamento?",
            isPresented: Binding(
                get: { viewModel.pendingDelete != nil },
                set: { if !$0 { viewModel.pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remover", role: .destructive) {
                if let item = viewModel.pendingDelete {
                    Task { await viewModel.delete(item) }
                }
            }
            Button("Cancelar", role: .cancel) { viewModel.pendingDelete = nil }
        } message: {
            if let item = viewModel.pendingDelete {
                Text("Remover “\(item.description)”?")
            }
        }
    }

    // MARK: - Empty / Content

    private var emptyContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                kpiGrid
                EmptyState(
                    title: "Nenhum lançamento ainda",
                    message: "Registre compras do cartão emprestadas a terceiros e valores avulsos.",
                    systemImage: "person.crop.circle.badge.plus",
                    actionTitle: "Nova Entrada",
                    action: {
                        viewModel.resetDraft()
                        showEditor = true
                    }
                )
            }
            .meuFluxPageGutter()
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(MeuFluxColors.danger)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(MeuFluxColors.dangerBackground, in: RoundedRectangle(cornerRadius: Radius().md, style: .continuous))
                }

                kpiGrid

                ForEach(viewModel.personGroups) { group in
                    personCard(group)
                }
            }
            .meuFluxPageGutter()
        }
    }

    private var header: some View {
        Text("Controle compras do cartão emprestadas a terceiros e valores avulsos.")
            .font(.subheadline)
            .foregroundStyle(MeuFluxColors.textMuted)
    }

    private var kpiGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            kpiCard(
                title: "Total a receber",
                value: viewModel.totalToReceive.formatted(),
                subtitle: "Pendente de recebimento",
                tint: MeuFluxColors.primary,
                icon: "dollarsign.circle"
            )
            kpiCard(
                title: "Total recebido",
                value: viewModel.totalReceived.formatted(),
                subtitle: "Já recebido até hoje",
                tint: MeuFluxColors.success,
                icon: "checkmark.circle.fill"
            )
            kpiCard(
                title: "Nº de pessoas",
                value: "\(viewModel.peopleCount)",
                subtitle: viewModel.peopleCount == 1 ? "pessoa com débito" : "pessoas com débito",
                tint: MeuFluxColors.info,
                icon: "person.2.fill"
            )
            kpiCard(
                title: "Próximo recebimento",
                value: viewModel.nextDueDate?.formatted(template: "d MMM") ?? "—",
                subtitle: viewModel.nextDueDate == nil ? "Sem parcelas pendentes" : "Próxima parcela pendente",
                tint: viewModel.nextDueDate == nil ? MeuFluxColors.textMuted : MeuFluxColors.warning,
                icon: "calendar.badge.clock"
            )
        }
    }

    private func kpiCard(
        title: String,
        value: String,
        subtitle: String,
        tint: Color,
        icon: String
    ) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(title.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Spacer()
                    Image(systemName: icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(tint)
                }
                Text(value)
                    .font(.title3.weight(.bold).monospacedDigit())
                    .foregroundStyle(tint)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
        }
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(
                topLeadingRadius: Radius().lg,
                bottomLeadingRadius: Radius().lg,
                bottomTrailingRadius: 0,
                topTrailingRadius: 0,
                style: .continuous
            )
            .fill(tint)
            .frame(width: 4)
        }
    }

    // MARK: - Person card

    private func personCard(_ group: ReceivablePersonGroup) -> some View {
        let expanded = viewModel.expandedPersonIDs.contains(group.id)
        let color = Color(hexString: group.personColor) ?? MeuFluxColors.primary

        return VStack(spacing: 0) {
            Button {
                viewModel.togglePerson(group.id)
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    Text(initials(group.personName))
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 48, height: 48)
                        .background(color, in: Circle())
                        .shadow(color: color.opacity(0.35), radius: 6, y: 2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(group.personName)
                            .font(.body.weight(.bold))
                            .foregroundStyle(MeuFluxColors.textPrimary)
                        Text("\(group.totalReceived.formatted()) recebido até hoje")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 4) {
                        HStack {
                            Text("\(group.progressPercent)% recebido")
                                .font(.system(size: 10))
                                .foregroundStyle(MeuFluxColors.textMuted)
                            Text(group.totalPending.formatted())
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(group.progressPercent == 100 ? MeuFluxColors.success : MeuFluxColors.primary)
                        }
                        progressBar(percent: group.progressPercent, tint: group.progressPercent == 100 ? MeuFluxColors.success : color)
                            .frame(width: 120)
                    }

                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
                .padding(16)
                .background(
                    LinearGradient(
                        colors: expanded ? [color.opacity(0.12), .clear] : [.clear, .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    Button {
                        viewModel.resetDraft(prefillPerson: group.personName)
                        showEditor = true
                    } label: {
                        Label("Lançamento", systemImage: "plus")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)

                    ForEach(group.receivables) { receivable in
                        receivableRow(receivable, personColor: color)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) {
                    Divider()
                }
            }
        }
        .background(MeuFluxColors.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius().xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius().xl, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
        .shadow(color: MeuFluxColors.cardShadow, radius: 8, y: 2)
    }

    private func receivableRow(_ receivable: Receivable, personColor: Color) -> some View {
        let expanded = viewModel.expandedReceivableIDs.contains(receivable.id)
        let paid = receivable.installmentHistory.filter(\.isPaid).count
        let total = receivable.installmentHistory.count
        let pct = receivable.progressPercent
        let settled = pct == 100 && !receivable.isContinuous

        return VStack(spacing: 0) {
            Button {
                selectedDetail = LineItemDetail.from(receivable: receivable)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(receivable.description)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(MeuFluxColors.textPrimary)
                                if settled {
                                    StatusBadge("Quitado", style: .success)
                                }
                                if receivable.isContinuous {
                                    StatusBadge("Mensal Recorrente", style: .info)
                                }
                                if receivable.linkedTransactionId != nil {
                                    StatusBadge("Vinculado ao Cartão", style: .info)
                                }
                            }
                            HStack(spacing: 10) {
                                Text(
                                    receivable.isContinuous
                                        ? "\((receivable.installmentHistory.first?.amount ?? .zero).formatted())/mês"
                                        : "\(receivable.amount.formatted()) total"
                                )
                                Text(
                                    receivable.isContinuous
                                        ? "\(paid) parcelas recebidas"
                                        : "\(paid)/\(total) parcelas pagas"
                                )
                                if let next = receivable.nextPendingDue {
                                    Text("Próx: \(next.formatted(template: "d MMM"))")
                                        .foregroundStyle(MeuFluxColors.warning)
                                }
                            }
                            .font(.caption2)
                            .foregroundStyle(MeuFluxColors.textMuted)
                        }

                        Spacer(minLength: 4)

                        VStack(alignment: .trailing, spacing: 6) {
                            Text(
                                receivable.isContinuous
                                    ? "\((receivable.installmentHistory.first?.amount ?? .zero).formatted()) /mês"
                                    : "\(receivable.receivedAmount.formatted()) / \(receivable.amount.formatted())"
                            )
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(MeuFluxColors.textPrimary)

                            HStack(spacing: 10) {
                                Button {
                                    viewModel.beginEdit(receivable)
                                    showEditor = true
                                } label: {
                                    Image(systemName: "pencil")
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    viewModel.pendingDelete = receivable
                                } label: {
                                    Image(systemName: "trash")
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    viewModel.toggleReceivable(receivable.id)
                                } label: {
                                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                                        .font(.caption)
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(expanded ? "Recolher parcelas" : "Ver parcelas")
                            }
                        }
                    }

                    progressBar(
                        percent: pct,
                        tint: settled ? MeuFluxColors.success : personColor
                    )
                }
                .padding(12)
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(spacing: 0) {
                    ForEach(receivable.installmentHistory.sorted { $0.installmentNumber < $1.installmentNumber }) { installment in
                        installmentRow(receivable: receivable, installment: installment, total: total)
                    }
                }
                .overlay(alignment: .top) { Divider() }
            }
        }
        .background(MeuFluxColors.bgTertiary)
        .clipShape(RoundedRectangle(cornerRadius: Radius().lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .strokeBorder(
                    settled ? MeuFluxColors.success.opacity(0.35) : MeuFluxColors.border,
                    lineWidth: 1
                )
        }
    }

    private func installmentRow(
        receivable: Receivable,
        installment: ReceivableInstallment,
        total: Int
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Parcela \(installment.installmentNumber)/\(total)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textSecondary)
                Text("Vence \(installment.dueDate.formatted(template: "d MMM yyyy"))")
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture {
                selectedDetail = LineItemDetail.from(receivable: receivable, installment: installment)
            }
            Spacer()
            Text(installment.amount.formatted())
                .font(.subheadline.weight(.bold).monospacedDigit())
            if installment.isPaid {
                StatusBadge("Recebido", style: .success)
            } else {
                Button("Marcar Recebido") {
                    Task {
                        await viewModel.markInstallmentPaid(
                            receivableID: receivable.id,
                            number: installment.installmentNumber
                        )
                    }
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(installment.isPaid ? MeuFluxColors.success.opacity(0.05) : Color.clear)
    }

    private func progressBar(percent: Int, tint: Color) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(MeuFluxColors.bgTertiary)
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, geo.size.width * CGFloat(percent) / 100))
            }
        }
        .frame(height: 6)
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }

    // MARK: - Editor

    private var editorSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nome do devedor / amigo", text: $viewModel.draftPerson)
                        .disabled(viewModel.personNameLocked)
                    TextField("Descrição / identificador", text: $viewModel.draftDescription)
                    TextField(
                        viewModel.draftRecurrence == .continuous ? "Valor por mês (R$)" : "Valor total (R$)",
                        text: $viewModel.draftAmount
                    )
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                }

                Section("Recorrência") {
                    Picker("Tipo", selection: $viewModel.draftRecurrence) {
                        ForEach(ReceivableRecurrence.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.inline)

                    DatePicker(
                        viewModel.draftRecurrence == .single ? "Data de vencimento" : "Data da 1ª parcela",
                        selection: $viewModel.draftFirstDue,
                        displayedComponents: .date
                    )

                    if viewModel.draftRecurrence == .parcelado {
                        TextField("Nº de parcelas", text: $viewModel.draftInstallments)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                    }
                }

                Section("Observações") {
                    TextField("Detalhes adicionais", text: $viewModel.draftNotes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle(viewModel.editingID == nil ? "Novo Lançamento" : "Editar Lançamento")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        viewModel.resetDraft()
                        showEditor = false
                    }
                    .disabled(viewModel.isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            if await viewModel.saveDraft() {
                                showEditor = false
                            }
                        }
                    }
                    .disabled(viewModel.isSaving)
                }
            }
        }
    }
}

private extension Color {
    init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        self.init(hex: value)
    }
}

#Preview {
    NavigationStack { ReceivablesView() }
}
