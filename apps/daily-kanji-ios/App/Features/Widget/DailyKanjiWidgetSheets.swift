import SwiftUI

struct DailyKanjiWidgetScopeSheet: View {
    @ObservedObject var model: DailyKanjiAppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Modalità") {
                    Picker(
                        "Percorso",
                        selection: Binding(
                            get: { model.draftStudyMode },
                            set: { model.setDraftStudyMode($0) }
                        )
                    ) {
                        ForEach(DailyKanjiStudyMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                }

                Section("Media") {
                    if model.draftStudyModeUsesMediaSelection {
                        Picker(
                            "Media",
                            selection: Binding(
                                get: { model.draftMediaSlug },
                                set: { model.setDraftSelectedMediaSlug($0) }
                            )
                        ) {
                            ForEach(model.mediaPickerOptions) { option in
                                Text(option.title).tag(Optional(option.slug))
                            }
                        }
                    } else {
                        Label("Tutti i media", systemImage: "rectangle.stack")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Text(cardCountText)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Percorso widget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", action: cancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Applica", action: apply)
                        .disabled(!model.hasStudyScopeDraftChanges)
                }
            }
        }
        .onAppear(perform: model.resetStudyScopeDraft)
        .onDisappear(perform: model.resetStudyScopeDraft)
    }

    private var cardCountText: String {
        let count = model.draftScopedCardCount
        let noun = count == 1 ? "scheda" : "schede"
        let availability = count == 1 ? "disponibile" : "disponibili"
        return "\(count) \(noun) \(availability)"
    }

    private func cancel() {
        model.resetStudyScopeDraft()
        dismiss()
    }

    private func apply() {
        model.applyStudyScope()
        dismiss()
    }
}

struct DailyKanjiWidgetHistorySheet: View {
    @ObservedObject var model: DailyKanjiAppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if model.recentHistory.isEmpty {
                    ContentUnavailableView(
                        "Nessuna scheda recente",
                        systemImage: "clock",
                        description: Text("Le schede visualizzate appariranno qui.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(model.recentHistory) { item in
                        if let card = model.card(for: item) {
                            Button {
                                select(item)
                            } label: {
                                DailyKanjiWidgetHistoryRow(card: card, item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .navigationTitle("Cronologia")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", action: dismiss.callAsFunction)
                }
            }
        }
    }

    private func select(_ item: DailyKanjiPresentationHistoryItem) {
        model.selectHistoryItem(item)
        dismiss()
    }
}

struct DailyKanjiWidgetHistoryRow: View {
    let card: DailyKanjiCard
    let item: DailyKanjiPresentationHistoryItem

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(card.displayFront)
                .font(.title2.weight(.semibold))
                .lineLimit(2)
                .frame(width: 92, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(card.back)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                Text(card.readingText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(item.metadataText())
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
