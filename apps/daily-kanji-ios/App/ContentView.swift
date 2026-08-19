import Combine
import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: DailyKanjiAppModel
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @StateObject private var glossarySearch: DailyKanjiGlossarySearchModel
    @State private var selectedGlossaryEntry: DailyKanjiGlossaryEntry?
    @State private var showsSettings = false

    @MainActor
    init(model: DailyKanjiAppModel) {
        _model = ObservedObject(wrappedValue: model)
        _glossarySearch = StateObject(
            wrappedValue: DailyKanjiGlossarySearchModel(entries: model.glossaryEntries)
        )
    }

    var body: some View {
        TabView(selection: tabBinding) {
            NavigationStack {
                DailyKanjiWidgetHomeView(model: model, openSettings: showSettings)
            }
            .tabItem {
                Label(DailyKanjiAppTab.widget.label, systemImage: DailyKanjiAppTab.widget.systemImage)
            }
            .tag(DailyKanjiAppTab.widget)

            NavigationStack {
                DailyKanjiReviewHomeView(model: model, openSettings: showSettings)
            }
            .tabItem {
                Label(DailyKanjiAppTab.review.label, systemImage: DailyKanjiAppTab.review.systemImage)
            }
            .tag(DailyKanjiAppTab.review)

            NavigationStack {
                legacyContent
            }
            .tabItem {
                Label(DailyKanjiAppTab.search.label, systemImage: DailyKanjiAppTab.search.systemImage)
            }
            .tag(DailyKanjiAppTab.search)
        }
        .tint(.accentColor)
        .onChange(of: model.selectedTab) { _, tab in
            if tab != .search {
                selectedGlossaryEntry = nil
                audioPlayer.suspend()
            } else {
                glossarySearch.prepareIndex()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                audioPlayer.suspend()
            }
        }
        .onReceive(model.$glossaryEntries.dropFirst()) { entries in
            glossarySearch.replaceEntries(entries)
        }
        .sheet(item: $selectedGlossaryEntry) { entry in
            NavigationStack {
                glossaryDetailView(entry)
                    .navigationTitle("Glossario")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Chiudi") {
                                selectedGlossaryEntry = nil
                            }
                        }
                    }
            }
        }
        .sheet(isPresented: $showsSettings) {
            DailyKanjiSettingsView(model: model)
        }
    }

    private var legacyContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                glossaryView
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 36)
        }
        .navigationTitle("Cerca")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                DailyKanjiSettingsToolbarButton(action: showSettings)
            }
        }
        .background(Color(.systemBackground))
    }

    private var glossaryView: some View {
        let results = glossarySearch.results

        return VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "text.magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Glossario")
                        .font(.subheadline.weight(.semibold))

                    Text("\(results.count) / \(model.glossaryEntries.count) voci")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }

            TextField(
                "Cerca",
                text: Binding(
                    get: { glossarySearch.query },
                    set: { glossarySearch.updateQuery($0) }
                )
            )
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            if model.glossaryEntries.isEmpty {
                Text("Glossario non disponibile nello snapshot.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else if results.isEmpty {
                Text("Nessun risultato.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(results) { entry in
                        glossaryEntryRow(entry)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func glossaryEntryRow(_ entry: DailyKanjiGlossaryEntry) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Button {
                selectedGlossaryEntry = entry
            } label: {
                glossaryEntrySummary(entry)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel("Apri \(entry.label)")

            VStack(spacing: 8) {
                if let audioRef = entry.primaryAudioMedia {
                    Button {
                        playGlossaryAudio(audioRef)
                    } label: {
                        Label("Audio", systemImage: "speaker.wave.2.fill")
                            .labelStyle(.iconOnly)
                    }
                    .buttonStyle(.bordered)
                    .disabled(
                        !audioPlayer.hasBundledAudio(
                            mediaSlug: audioRef.mediaSlug,
                            audioSrc: audioRef.audioSrc
                        )
                    )
                    .accessibilityLabel("Riproduci audio di \(entry.label)")
                }

                Button {
                    selectedGlossaryEntry = entry
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Apri dettaglio di \(entry.label)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 16)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private func glossaryEntrySummary(_ entry: DailyKanjiGlossaryEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            glossaryTitleLine(entry)

            if let readingText = entry.readingLine {
                Text(readingText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            glossarySignalLine(entry)

            Text(entry.meaning)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)

            if let notes = entry.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !entry.media.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(entry.media, id: \.stableId) { media in
                            Label(media.displayText, systemImage: "rectangle.stack")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(.tertiarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func glossaryTitleLine(_ entry: DailyKanjiGlossaryEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(entry.label)
                    .font(.title3.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)

                Spacer(minLength: 0)

                Text(entry.kind.glossaryLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            if let title = entry.title, !title.isEmpty {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func glossarySignalLine(_ entry: DailyKanjiGlossaryEntry) -> some View {
        let hasAudio = entry.primaryAudioMedia?.audioSrc != nil
        let pitchText = entry.pitchAccentText

        if pitchText != nil || hasAudio {
            HStack(spacing: 10) {
                if let pitchText {
                    Label(pitchText, systemImage: "waveform.path.ecg")
                }

                if hasAudio {
                    Label("Audio", systemImage: "speaker.wave.2.fill")
                }
            }
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
        }
    }

    private func glossaryDetailView(_ entry: DailyKanjiGlossaryEntry) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(entry.kind.glossaryLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(entry.label)
                        .font(.system(size: 46, weight: .semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.55)

                    if let title = entry.title, !title.isEmpty {
                        Text(title)
                            .font(.title3.weight(.medium))
                            .foregroundStyle(.secondary)
                    }

                    if let readingText = entry.readingLine {
                        Text(readingText)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                }

                if entry.pitchAccent != nil || entry.primaryAudioMedia != nil {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .center, spacing: 10) {
                            if let pitchText = entry.pitchAccentText {
                                Label(pitchText, systemImage: "waveform.path.ecg")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            Spacer(minLength: 0)

                            if let audioRef = entry.primaryAudioMedia {
                                Button {
                                    playGlossaryAudio(audioRef)
                                } label: {
                                    Label("Audio", systemImage: "speaker.wave.2.fill")
                                }
                                .buttonStyle(.bordered)
                                .disabled(
                                    !audioPlayer.hasBundledAudio(
                                        mediaSlug: audioRef.mediaSlug,
                                        audioSrc: audioRef.audioSrc
                                    )
                                )
                            }
                        }

                        if let pattern = entry.pitchAccentPattern {
                            DailyKanjiGlossaryPitchAccentView(pattern: pattern)
                        }

                        if let source = entry.pitchAccentSourceText {
                            Text(source)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Significato")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(entry.meaning)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let notes = entry.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Note")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)

                        Text(notes)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if !entry.aliases.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Alias")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(entry.aliases, id: \.stableId) { alias in
                                    Text(alias.displayText)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color(.tertiarySystemGroupedBackground))
                                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                                }
                            }
                        }
                    }
                }

                if !entry.media.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Media")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)

                        ForEach(entry.media, id: \.stableId) { media in
                            HStack(alignment: .center, spacing: 10) {
                                Label(media.displayText, systemImage: "rectangle.stack")
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(.secondary)

                                Spacer(minLength: 0)

                                if media.audioSrc != nil {
                                    Button {
                                        playGlossaryAudio(media)
                                    } label: {
                                        Label("Audio", systemImage: "speaker.wave.2.fill")
                                            .labelStyle(.iconOnly)
                                    }
                                    .buttonStyle(.bordered)
                                    .disabled(
                                        !audioPlayer.hasBundledAudio(
                                            mediaSlug: media.mediaSlug,
                                            audioSrc: media.audioSrc
                                        )
                                    )
                                    .accessibilityLabel("Riproduci audio da \(media.displayText)")
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func playGlossaryAudio(_ media: DailyKanjiGlossaryEntry.MediaRef) {
        guard let audioSrc = media.audioSrc else {
            return
        }

        audioPlayer.play(mediaSlug: media.mediaSlug, audioSrc: audioSrc)
    }

    private var tabBinding: Binding<DailyKanjiAppTab> {
        Binding(
            get: { model.selectedTab },
            set: { model.selectTab($0) }
        )
    }

    private func showSettings() {
        showsSettings = true
    }
}

#Preview {
    ContentView(model: DailyKanjiAppModel())
}

private struct DailyKanjiGlossaryPitchAccentView: View {
    let pattern: DailyKanjiPitchAccentPattern

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(pattern.moras) { mora in
                VStack(spacing: 4) {
                    Circle()
                        .fill(mora.isHigh ? Color.accentColor : Color.secondary)
                        .frame(width: 7, height: 7)
                        .offset(y: mora.isHigh ? -9 : 0)

                    Text(mora.text)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .frame(minWidth: 20)
            }
        }
        .padding(.top, 8)
    }
}
