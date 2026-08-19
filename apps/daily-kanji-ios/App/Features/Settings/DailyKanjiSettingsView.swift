import SwiftUI

struct DailyKanjiSettingsView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var showsScope = false

    var body: some View {
        NavigationStack {
            Form {
                dataSection
                reviewSection
                widgetSection
                aboutSection
            }
            .navigationTitle("Impostazioni")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", action: dismiss.callAsFunction)
                }
            }
        }
        .sheet(isPresented: $showsScope) {
            DailyKanjiWidgetScopeSheet(model: model)
        }
    }

    private var dataSection: some View {
        let presentation = DailyKanjiSettingsDataPresentation(
            syncStatus: DailyKanjiSyncStatusPresentation(syncState: model.syncState)
        )

        return Section("Dati") {
            Label(
                presentation.syncStatus.title,
                systemImage: presentation.syncStatus.systemImage
            )
            Text(presentation.syncStatus.subtitle)
                .font(.callout)
                .foregroundStyle(.secondary)
            Text("\(model.cards.count) schede · \(model.glossaryEntries.count) voci")
                .font(.callout)
                .foregroundStyle(.secondary)

            if let lastSyncAt = presentation.lastSyncAt,
               let lastSyncLabel = presentation.lastSyncLabel {
                LabeledContent(lastSyncLabel) {
                    Text(lastSyncAt, format: .dateTime.day().month(.wide).year().hour().minute())
                        .multilineTextAlignment(.trailing)
                }
            }

            if presentation.syncStatus.canRefresh {
                Button("Aggiorna dati") {
                    model.refreshNow()
                }
                    .disabled(presentation.syncStatus.isRefreshing)
            }
        }
    }

    private var reviewSection: some View {
        let presentation = DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState)

        return Section("Ripasso") {
            Label(presentation.title, systemImage: presentation.systemImage)
            Text(presentation.subtitle)
                .font(.callout)
                .foregroundStyle(.secondary)

            if presentation.canRefresh {
                Button("Aggiorna ripasso", action: model.refreshLiveReviewNow)
                    .disabled(presentation.isRefreshing)
            }
        }
    }

    private var widgetSection: some View {
        Section("Widget") {
            Text(widgetScopeSummary)
                .foregroundStyle(.secondary)
            Button("Modifica percorso") {
                showsScope = true
            }
        }
    }

    private var aboutSection: some View {
        Section("Informazioni") {
            Text("Daily Kanji")
            Text("Companion locale per il ripasso e il widget.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private var widgetScopeSummary: String {
        let mediaTitle = model.selectedMediaSlug.flatMap { slug in
            model.availableMediaForCurrentMode.first { $0.slug == slug }?.title
        }
        return DailyKanjiWidgetScopePresentation(
            studyMode: model.selectedStudyMode,
            selectedMediaTitle: mediaTitle,
            availableCardCount: model.scopedCardCount
        ).summary
    }
}
