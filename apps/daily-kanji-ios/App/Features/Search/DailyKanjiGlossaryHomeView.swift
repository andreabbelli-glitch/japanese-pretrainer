import Combine
import SwiftUI

struct DailyKanjiGlossaryHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void

    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @StateObject private var search: DailyKanjiGlossarySearchModel

    private var presentation: DailyKanjiGlossarySearchPresentation {
        DailyKanjiGlossarySearchPresentation(query: search.query)
    }

    private var fieldLayout: DailyKanjiGlossarySearchFieldLayout {
        presentation.fieldLayout(for: dynamicTypeSize)
    }

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
            if fieldLayout == .inline {
                inlineSearchField
                    .listRowBackground(Color.clear)
            }

            if model.glossaryEntries.isEmpty {
                ContentUnavailableView(
                    "Glossario non disponibile",
                    systemImage: "text.magnifyingglass",
                    description: Text("Aggiorna i dati per cercare termini e grammatica.")
                )
                .listRowBackground(Color.clear)
            } else if search.results.isEmpty {
                emptyResultsView
            } else {
                ForEach(search.results) { entry in
                    DailyKanjiGlossaryRow(entry: entry, audioPlayer: audioPlayer)
                }
            }
        }
        .listStyle(.plain)
        .modifier(
            DailyKanjiSystemSearchModifier(
                layout: fieldLayout,
                query: queryBinding
            )
        )
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

    private var inlineSearchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Termine, lettura o significato", text: queryBinding)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .padding(.horizontal, 12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private var emptyResultsView: some View {
        switch presentation.emptyResultsLayout(for: dynamicTypeSize) {
        case .system:
            ContentUnavailableView(
                presentation.emptyResultsTitle,
                systemImage: "magnifyingglass",
                description: Text(
                    presentation.emptyResultsDescription(for: dynamicTypeSize)
                )
            )
            .listRowBackground(Color.clear)

        case .accessibility:
            VStack(spacing: 20) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 56, weight: .regular))
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)

                Text(presentation.emptyResultsTitle)
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Text(presentation.emptyResultsDescription(for: dynamicTypeSize))
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.top, 32)
            .padding(.bottom, 72)
            .accessibilityElement(children: .combine)
            .listRowInsets(EdgeInsets(top: 0, leading: 24, bottom: 0, trailing: 24))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
    }
}

private struct DailyKanjiSystemSearchModifier: ViewModifier {
    let layout: DailyKanjiGlossarySearchFieldLayout
    let query: Binding<String>

    @ViewBuilder
    func body(content: Content) -> some View {
        if layout == .system {
            content.searchable(text: query, prompt: "Termine, lettura o significato")
        } else {
            content
        }
    }
}
