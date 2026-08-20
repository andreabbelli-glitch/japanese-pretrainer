import SwiftUI

struct DailyKanjiWidgetHomeView: View {
    private enum Sheet: Identifiable {
        case scope
        case history

        var id: Self { self }
    }

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @State private var presentedSheet: Sheet?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DailyKanjiDesign.sectionSpacing) {
                scopeButton

                if let card = model.selectedCard {
                    DailyKanjiWidgetCardView(
                        card: card,
                        historyContext: model.selectedHistoryContext,
                        audioPlayer: audioPlayer
                    )
                    .id(card.cardId)
                } else {
                    emptyScope
                }

                recentSection
            }
            .padding(.horizontal, DailyKanjiDesign.pageInset)
            .padding(.vertical, 16)
            .padding(.bottom, 32)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Widget")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                DailyKanjiSettingsToolbarButton(action: openSettings)
            }
        }
        .sheet(item: $presentedSheet) { sheet in
            switch sheet {
            case .scope:
                DailyKanjiWidgetScopeSheet(model: model)
            case .history:
                DailyKanjiWidgetHistorySheet(model: model)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                audioPlayer.suspend()
            }
        }
        .onDisappear(perform: audioPlayer.suspend)
    }

    private var scopeButton: some View {
        let presentation = scopePresentation

        return DailyKanjiWidgetScopeButton(
            presentation: presentation,
            layout: presentation.rowLayout(for: dynamicTypeSize),
            action: showScope
        )
    }

    private var emptyScope: some View {
        ContentUnavailableView {
            Label("Nessuna scheda", systemImage: "rectangle.stack.badge.minus")
        } description: {
            Text("Scegli un altro percorso per continuare lo studio.")
        } actions: {
            Button("Cambia percorso", action: showScope)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("Recenti")
                    .font(.title3.weight(.bold))
                Spacer()
                if !model.recentHistory.isEmpty {
                    Button("Vedi tutte", action: showHistory)
                        .frame(minHeight: 44)
                }
            }

            if model.recentHistory.isEmpty {
                Text("Nessuna scheda recente.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.recentHistory.prefix(3))) { item in
                        if let card = model.card(for: item) {
                            Button {
                                selectHistoryItem(item)
                            } label: {
                                DailyKanjiWidgetHistoryRow(card: card, item: item)
                                    .padding(.vertical, 10)
                            }
                            .buttonStyle(.plain)

                            if item.id != model.recentHistory.prefix(3).last?.id {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }

    private var scopePresentation: DailyKanjiWidgetScopePresentation {
        let selectedMediaTitle = model.selectedMediaSlug.flatMap { selectedMediaSlug in
            model.availableMediaForCurrentMode.first { $0.slug == selectedMediaSlug }?.title
        }

        return DailyKanjiWidgetScopePresentation(
            studyMode: model.selectedStudyMode,
            selectedMediaTitle: selectedMediaTitle,
            availableCardCount: model.scopedCardCount
        )
    }

    private func showScope() {
        presentedSheet = .scope
    }

    private func showHistory() {
        presentedSheet = .history
    }

    private func selectHistoryItem(_ item: DailyKanjiPresentationHistoryItem) {
        model.selectHistoryItem(item)
    }
}

private struct DailyKanjiWidgetScopeButton: View {
    let presentation: DailyKanjiWidgetScopePresentation
    let layout: DailyKanjiWidgetScopeRowLayout
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if layout == .stacked {
                    VStack(alignment: .leading, spacing: 4) {
                        titleRow
                        summary
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    HStack(spacing: 12) {
                        Image(systemName: "rectangle.stack")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.tint)
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Percorso widget")
                                .font(.headline)
                            summary
                        }

                        Spacer(minLength: 8)
                        chevron
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Percorso widget, \(presentation.summary)")
        .accessibilityHint("Apre la scelta del percorso")
    }

    private var titleRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "rectangle.stack")
                .font(.body.weight(.semibold))
                .foregroundStyle(.tint)
                .frame(width: 28)

            Text("Percorso widget")
                .font(.headline)

            Spacer(minLength: 8)
            chevron
        }
    }

    private var summary: some View {
        Text(presentation.summary)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.tertiary)
    }
}
