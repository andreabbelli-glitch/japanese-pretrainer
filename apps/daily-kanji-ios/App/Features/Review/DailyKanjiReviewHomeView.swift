import SwiftUI

struct DailyKanjiReviewHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @State private var answerRevealed = false

    private let liveReviewBaseURL = DailyKanjiMobileReviewConfiguration.load().endpointURL

    var body: some View {
        Group {
            if let card = model.liveReviewState.session?.selectedCard {
                reviewSession(card: card)
            } else {
                reviewEmptyState
            }
        }
        .navigationTitle("Ripasso")
        .toolbar(content: reviewToolbar)
        .onChange(of: currentLiveReviewCardKey) { _, _ in
            answerRevealed = false
            resetAndPreloadCurrentLiveReviewAudio()
        }
        .onAppear(perform: resetAndPreloadCurrentLiveReviewAudio)
        .onDisappear(perform: audioPlayer.suspend)
        .onChange(of: model.selectedTab) { _, selectedTab in
            if selectedTab == .review {
                resetAndPreloadCurrentLiveReviewAudio()
            } else {
                audioPlayer.suspend()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                resetAndPreloadCurrentLiveReviewAudio()
            } else {
                audioPlayer.suspend()
            }
        }
    }

    private func reviewSession(card: DailyKanjiLiveReviewCard) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DailyKanjiDesign.sectionSpacing) {
                if let staleFailure = staleFailurePresentation {
                    staleFailureNotice(staleFailure)
                }

                if let loading = loadingPresentation {
                    loadingNotice(loading)
                }

                DailyKanjiReviewCardView(
                    model: model,
                    card: card,
                    answerRevealed: $answerRevealed,
                    audioPlayer: audioPlayer,
                    liveReviewBaseURL: liveReviewBaseURL
                )
                .id(currentLiveReviewCardKey)
            }
            .padding(.horizontal, DailyKanjiDesign.pageInset)
            .padding(.vertical, 16)
            .padding(.bottom, 32)
        }
        .background(Color(.systemGroupedBackground))
    }

    private var reviewEmptyState: some View {
        let presentation = DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState)

        return ContentUnavailableView {
            Label(presentation.title, systemImage: presentation.systemImage)
        } description: {
            VStack(spacing: 10) {
                if presentation.isRefreshing {
                    ProgressView()
                }
                Text(presentation.emptyText)
            }
        } actions: {
            if model.liveReviewState == .unavailable {
                Button("Apri Impostazioni", action: openSettings)
            } else if presentation.canRefresh {
                Button("Riprova", action: model.refreshLiveReviewNow)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }

    private func staleFailureNotice(
        _ presentation: DailyKanjiLiveReviewStatusPresentation
    ) -> some View {
        DailyKanjiCardSurface {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: presentation.systemImage)
                    .font(.title3)
                    .foregroundStyle(.orange)

                VStack(alignment: .leading, spacing: 4) {
                    Text(presentation.title)
                        .font(.headline)
                    Text(presentation.subtitle)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Button("Riprova", action: model.refreshLiveReviewNow)
                    .frame(minHeight: 44)
            }
        }
    }

    private func loadingNotice(
        _ presentation: DailyKanjiLiveReviewStatusPresentation
    ) -> some View {
        HStack(spacing: 10) {
            ProgressView()
            Text(presentation.title)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    @ToolbarContentBuilder
    private func reviewToolbar() -> some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Aggiorna", systemImage: "arrow.clockwise") {
                model.refreshLiveReviewNow()
            }
            .labelStyle(.iconOnly)
            .disabled(!DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState).canRefresh)
            .accessibilityLabel("Aggiorna ripasso")
            .frame(width: 44, height: 44)

            DailyKanjiSettingsToolbarButton(action: openSettings)
        }
    }

    private var staleFailurePresentation: DailyKanjiLiveReviewStatusPresentation? {
        guard case .failed(_, let staleSession) = model.liveReviewState,
              staleSession?.selectedCard != nil
        else {
            return nil
        }

        return DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState)
    }

    private var loadingPresentation: DailyKanjiLiveReviewStatusPresentation? {
        guard case .loading(let staleSession) = model.liveReviewState,
              staleSession?.selectedCard != nil
        else {
            return nil
        }

        return DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState)
    }

    private var currentLiveReviewCardKey: String? {
        guard let card = model.liveReviewState.session?.selectedCard else {
            return nil
        }

        return "\(card.cardId):\(card.reviewStateUpdatedAt ?? "")"
    }

    private func resetAndPreloadCurrentLiveReviewAudio() {
        audioPlayer.stopPlayback()
        guard model.selectedTab == .review,
              scenePhase == .active,
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
}
