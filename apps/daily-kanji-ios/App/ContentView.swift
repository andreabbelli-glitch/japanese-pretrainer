import Combine
import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: DailyKanjiAppModel
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @StateObject private var glossarySearch: DailyKanjiGlossarySearchModel
    @State private var selectedGlossaryEntry: DailyKanjiGlossaryEntry?
    @State private var liveReviewAnswerRevealed = false
    private let liveReviewBaseURL = DailyKanjiMobileReviewConfiguration.load().endpointURL

    @MainActor
    init(model: DailyKanjiAppModel) {
        _model = ObservedObject(wrappedValue: model)
        _glossarySearch = StateObject(
            wrappedValue: DailyKanjiGlossarySearchModel(entries: model.glossaryEntries)
        )
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.selectedTab {
                case .widget:
                    DailyKanjiWidgetHomeView(model: model, openSettings: openSettings)
                case .review, .search:
                    legacyContent
                }
            }
            .onChange(of: model.selectedTab) { _, tab in
                if tab != .search {
                    selectedGlossaryEntry = nil
                } else {
                    glossarySearch.prepareIndex()
                }
                resetAndPreloadCurrentLiveReviewAudio()
            }
            .onChange(of: currentLiveReviewCardKey) { _, _ in
                liveReviewAnswerRevealed = false
                guard model.selectedTab == .review else {
                    return
                }
                resetAndPreloadCurrentLiveReviewAudio()
            }
            .onAppear {
                resetAndPreloadCurrentLiveReviewAudio()
            }
            .onDisappear {
                audioPlayer.suspend()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    resetAndPreloadCurrentLiveReviewAudio()
                } else {
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
        }
    }

    private var legacyContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                switch model.selectedTab {
                case .review:
                    liveReviewView
                case .search:
                    glossaryView
                case .widget:
                    EmptyView()
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 36)
        }
        .navigationTitle("Daily Kanji")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker(
                    "Modalità",
                    selection: Binding(
                        get: { model.selectedTab },
                        set: { model.selectTab($0) }
                    )
                ) {
                    ForEach(DailyKanjiAppTab.allCases) { tab in
                        Label(tab.label, systemImage: tab.systemImage).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 320)
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

    private var liveReviewView: some View {
        let presentation = DailyKanjiLiveReviewStatusPresentation(
            state: model.liveReviewState
        )

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: presentation.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 2) {
                    Text(presentation.title)
                        .font(.subheadline.weight(.semibold))

                    Text(presentation.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 12)

                Button {
                    model.refreshLiveReviewNow()
                } label: {
                    if presentation.isRefreshing {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Aggiorna review", systemImage: "arrow.clockwise")
                            .labelStyle(.iconOnly)
                    }
                }
                .buttonStyle(.bordered)
                .disabled(!presentation.canRefresh)
                .accessibilityLabel("Aggiorna review")
            }

            if let card = model.liveReviewState.session?.selectedCard {
                liveReviewCardView(card)
            } else {
                Text(presentation.emptyText)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func liveReviewCardView(_ card: DailyKanjiLiveReviewCard) -> some View {
        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: liveReviewAnswerRevealed
        )

        return VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                Text(card.mediaTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 0)

                Text("\(model.liveReviewState.session?.queue.queueCount ?? 0) in coda")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            Text(presentation.frontText)
                .font(.system(size: 78, weight: .semibold))
                .minimumScaleFactor(0.32)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            if presentation.shouldShowAnswer {
                liveReviewAnswerView(presentation)
                liveReviewGradeGrid(presentation)
            } else {
                Button {
                    revealLiveReviewAnswer(for: card)
                } label: {
                    Label("Rivela", systemImage: "eye.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!model.liveReviewState.canReveal)
            }
        }
        .opacity(model.liveReviewState.canGrade || model.liveReviewState.isSubmitting ? 1 : 0.72)
    }

    @ViewBuilder
    private func liveReviewAnswerView(
        _ presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                if let readingText = presentation.readingText {
                    Text(readingText)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                if let pitchAccentText = presentation.pitchAccentText {
                    Text(pitchAccentText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Button {
                    playLiveReviewAudio(presentation)
                } label: {
                    Label("Audio", systemImage: "speaker.wave.2.fill")
                        .labelStyle(.iconOnly)
                }
                .buttonStyle(.bordered)
                .disabled(presentation.primaryAudioURL(baseURL: liveReviewBaseURL) == nil)
                .accessibilityLabel("Audio")
            }

            if let pitchAccent = presentation.pitchAccent {
                DailyKanjiLiveReviewPitchAccentView(pitchAccent: pitchAccent)
            }

            Text(presentation.backText)
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)

            if let exampleJp = presentation.card.exampleJp, !exampleJp.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(exampleJp))
                    .font(.body)
            }

            if let exampleIt = presentation.card.exampleIt, !exampleIt.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(exampleIt))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            if let notes = presentation.card.notes, !notes.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(notes))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func liveReviewGradeGrid(
        _ presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 8),
                GridItem(.flexible(), spacing: 8)
            ],
            spacing: 8
        ) {
            ForEach(DailyKanjiLiveReviewRating.reviewDisplayOrder, id: \.self) { rating in
                liveReviewGradeButton(rating, presentation: presentation)
            }
        }
    }

    @ViewBuilder
    private func liveReviewGradeButton(
        _ rating: DailyKanjiLiveReviewRating,
        presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        let isSubmitting = model.liveReviewState.submittingRating == rating

        if rating == .good || rating == .easy {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                liveReviewGradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: isSubmitting
                )
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.liveReviewState.canGrade || !liveReviewAnswerRevealed)
        } else {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                liveReviewGradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: isSubmitting
                )
            }
            .buttonStyle(.bordered)
            .disabled(!model.liveReviewState.canGrade || !liveReviewAnswerRevealed)
        }
    }

    private func liveReviewGradeButtonLabel(
        _ rating: DailyKanjiLiveReviewRating,
        nextReviewLabel: String?,
        isSubmitting: Bool
    ) -> some View {
        VStack(spacing: 3) {
            if isSubmitting {
                ProgressView()
                    .controlSize(.small)
            } else {
                Text(rating.label)
                    .font(.headline)
                    .lineLimit(1)
            }

            Text(rating.detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)

            if let nextReviewLabel {
                Text(nextReviewLabel)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 72)
    }

    private var currentLiveReviewCardKey: String? {
        guard let card = model.liveReviewState.session?.selectedCard else {
            return nil
        }

        return "\(card.cardId):\(card.reviewStateUpdatedAt ?? "")"
    }

    private func revealLiveReviewAnswer(for card: DailyKanjiLiveReviewCard) {
        liveReviewAnswerRevealed = true
        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: true
        )
        playLiveReviewAudio(presentation)
    }

    private func playLiveReviewAudio(_ presentation: DailyKanjiLiveReviewCardPresentation) {
        guard let url = presentation.primaryAudioURL(baseURL: liveReviewBaseURL) else {
            return
        }

        audioPlayer.play(url: url)
    }

    private func resetAndPreloadCurrentLiveReviewAudio() {
        audioPlayer.stopPlayback()
        guard scenePhase == .active,
              model.selectedTab == .review,
              let card = model.liveReviewState.session?.selectedCard
        else {
            audioPlayer.preload(url: nil)
            return
        }

        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: true
        )
        audioPlayer.preload(url: presentation.primaryAudioURL(baseURL: liveReviewBaseURL))
    }

    private func openSettings() {}
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

private struct DailyKanjiLiveReviewPitchAccentView: View {
    let pitchAccent: DailyKanjiLiveReviewCard.Pronunciation.Audio.PitchAccent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(pitchAccent.morae.enumerated()), id: \.offset) { index, mora in
                    VStack(spacing: 4) {
                        Circle()
                            .fill(isHigh(index: index) ? Color.accentColor : Color.secondary)
                            .frame(width: 7, height: 7)
                            .offset(y: isHigh(index: index) ? -9 : 0)

                        Text(mora)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .frame(minWidth: 20)
                }
            }
            .padding(.top, 8)

            if let source = pitchAccentSourceText {
                Text(source)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var pitchAccentSourceText: String? {
        guard let shape = pitchAccent.shape else {
            return nil
        }

        return "\(shape.capitalized) pattern"
    }

    private func isHigh(index: Int) -> Bool {
        if let level = pitchAccent.levels?[safe: index] {
            return level == "high"
        }

        let moraIndex = index + 1

        if pitchAccent.downstep == 0 {
            return moraIndex > 1
        }

        if pitchAccent.downstep == 1 {
            return moraIndex == 1
        }

        return moraIndex > 1 && moraIndex <= pitchAccent.downstep
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
