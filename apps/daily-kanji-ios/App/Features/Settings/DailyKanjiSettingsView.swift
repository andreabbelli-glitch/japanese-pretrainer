import SwiftUI
import UIKit

struct DailyKanjiSettingsView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
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
        let notificationPresentation = DailyKanjiSettingsNotificationPresentation()

        return Section("Ripasso") {
            Label(presentation.title, systemImage: presentation.systemImage)
            Text(presentation.subtitle)
                .font(.callout)
                .foregroundStyle(.secondary)

            if presentation.canRefresh {
                Button("Aggiorna ripasso", action: model.refreshLiveReviewNow)
                    .disabled(presentation.isRefreshing)
            }

            Label(
                notificationPresentation.title,
                systemImage: notificationPresentation.isEnabled ? "bell" : "bell.slash"
            )
            Text(notificationPresentation.subtitle)
                .font(.callout)
                .foregroundStyle(.secondary)

            if let settingsActionTitle = notificationPresentation.settingsActionTitle {
                Button(settingsActionTitle) {
                    openURL(URL(string: UIApplication.openNotificationSettingsURLString)!)
                }
                .frame(minHeight: 44)
            }
        }
    }

    private var widgetSection: some View {
        let presentation = DailyKanjiSettingsWidgetPresentation(
            scope: DailyKanjiWidgetScopePresentation(
                studyMode: model.selectedStudyMode,
                selectedMediaTitle: selectedMediaTitle,
                availableCardCount: model.scopedCardCount
            )
        )

        return Section("Widget") {
            LabeledContent("Percorso attivo") {
                Text(presentation.scopeSummary)
                    .multilineTextAlignment(.trailing)
            }
            Text(presentation.cadenceText)
                .font(.callout)
                .foregroundStyle(.secondary)
            Button("Modifica percorso") {
                showsScope = true
            }
            .frame(minHeight: 44)
        }
    }

    private var aboutSection: some View {
        let presentation = DailyKanjiSettingsAboutPresentation()

        return Section("Informazioni") {
            Text("Daily Kanji")
            Text(presentation.versionText)
                .font(.callout)
                .foregroundStyle(.secondary)
            Text(presentation.offlineDescription)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private var selectedMediaTitle: String? {
        model.selectedMediaSlug.flatMap { slug in
            model.availableMediaForCurrentMode.first { $0.slug == slug }?.title
        }
    }
}
