import Combine
import SwiftUI

struct DailyKanjiGlossaryHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void

    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @StateObject private var search: DailyKanjiGlossarySearchModel

    @MainActor
    init(model: DailyKanjiAppModel, openSettings: @escaping () -> Void) {
        self.model = model
        self.openSettings = openSettings
        _search = StateObject(
            wrappedValue: DailyKanjiGlossarySearchModel(entries: model.glossaryEntries)
        )
    }

    var body: some View {
        List {
            if model.glossaryEntries.isEmpty {
                ContentUnavailableView(
                    "Glossario non disponibile",
                    systemImage: "text.magnifyingglass",
                    description: Text("Aggiorna i dati per cercare termini e grammatica.")
                )
                .listRowBackground(Color.clear)
            } else if search.results.isEmpty {
                ContentUnavailableView.search(text: search.query)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(search.results) { entry in
                    DailyKanjiGlossaryRow(entry: entry, audioPlayer: audioPlayer)
                }
            }
        }
        .listStyle(.plain)
        .searchable(text: queryBinding, prompt: "Termine, lettura o significato")
        .navigationTitle("Cerca")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                DailyKanjiSettingsToolbarButton(action: openSettings)
            }
        }
        .onAppear {
            search.prepareIndex()
        }
        .onChange(of: model.selectedTab) { _, tab in
            if tab == .search {
                search.prepareIndex()
            } else {
                audioPlayer.suspend()
            }
        }
        .onReceive(model.$glossaryEntries.dropFirst()) { entries in
            search.replaceEntries(entries)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                audioPlayer.suspend()
            }
        }
        .onDisappear {
            audioPlayer.suspend()
        }
    }

    private var queryBinding: Binding<String> {
        Binding(
            get: { search.query },
            set: { search.updateQuery($0) }
        )
    }
}
