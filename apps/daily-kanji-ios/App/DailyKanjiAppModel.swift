import Foundation
import SwiftUI
import WidgetKit

enum DailyKanjiSyncState: Equatable {
    case unavailable
    case idle(source: DailyKanjiDatasetSource)
    case syncing(source: DailyKanjiDatasetSource)
    case failed(message: String, source: DailyKanjiDatasetSource)
}

@MainActor
final class DailyKanjiAppModel: ObservableObject {
    @Published private(set) var cards: [DailyKanjiCard]
    @Published private(set) var selectedCard: DailyKanjiCard?
    @Published private(set) var selectedHistoryContext: DailyKanjiPresentationHistoryItem?
    @Published private(set) var selectedMediaSlug: String?
    @Published private(set) var selectedStudyMode: DailyKanjiStudyMode = .daily
    @Published private(set) var draftMediaSlug: String?
    @Published private(set) var draftStudyMode: DailyKanjiStudyMode = .daily
    @Published private(set) var recentHistory: [DailyKanjiPresentationHistoryItem] = []
    @Published private(set) var syncState: DailyKanjiSyncState

    private let repository: DailyKanjiRepository
    private let cacheStore: DailyKanjiCacheStore
    private let historyStore: DailyKanjiHistoryStore
    private let scopeStore: DailyKanjiStudyScopeStore
    private let syncPolicy: DailyKanjiSyncPolicy
    private let syncer: DailyKanjiSyncing?
    private let reloadTimelines: () -> Void
    private let deepLinkActivationSuppressionInterval: TimeInterval = 5
    private var syncTask: Task<Void, Never>?
    private var lastFailureAt: Date?
    private var consecutiveFailureCount = 0
    private var suppressActivationUntil: Date?
    private var pendingPreparedSelectionCardId: String?
    private var recentSelectionHistory: [DailyKanjiHistoryItem] = []
    private var transientInitialActivationEvent: DailyKanjiHistoryItem?

    init(
        repository: DailyKanjiRepository? = nil,
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore(),
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        scopeStore: DailyKanjiStudyScopeStore = DailyKanjiStudyScopeStore(),
        syncPolicy: DailyKanjiSyncPolicy = DailyKanjiSyncPolicy(),
        syncer: DailyKanjiSyncing? = DailyKanjiSyncClient(),
        reloadTimelines: @escaping () -> Void = {
            WidgetCenter.shared.reloadAllTimelines()
        },
        now: Date = .now
    ) {
        let resolvedRepository = repository ?? DailyKanjiRepository(cacheStore: cacheStore)
        self.repository = resolvedRepository
        self.cacheStore = cacheStore
        self.cards = resolvedRepository.loadCards()
        self.historyStore = historyStore
        self.scopeStore = scopeStore
        self.syncPolicy = syncPolicy
        self.syncer = syncer
        self.reloadTimelines = reloadTimelines
        self.syncState = Self.initialSyncState(
            syncer: syncer,
            source: resolvedRepository.loadDatasetSource()
        )
        restoreSavedScope()
        resetStudyScopeDraft()
        persistCurrentScope()
        prepareInitialSelection(now: now)
    }

    init(
        cards: [DailyKanjiCard],
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore(),
        scopeStore: DailyKanjiStudyScopeStore = DailyKanjiStudyScopeStore(),
        syncPolicy: DailyKanjiSyncPolicy = DailyKanjiSyncPolicy(),
        syncer: DailyKanjiSyncing? = nil,
        reloadTimelines: @escaping () -> Void = {
            WidgetCenter.shared.reloadAllTimelines()
        },
        now: Date = .now
    ) {
        self.repository = DailyKanjiRepository(cacheStore: cacheStore)
        self.cacheStore = cacheStore
        self.cards = cards
        self.historyStore = historyStore
        self.scopeStore = scopeStore
        self.syncPolicy = syncPolicy
        self.syncer = syncer
        self.reloadTimelines = reloadTimelines
        self.syncState = Self.initialSyncState(syncer: syncer, source: .sample)
        restoreSavedScope()
        resetStudyScopeDraft()
        persistCurrentScope()
        prepareInitialSelection(now: now)
    }

    var availableMedia: [DailyKanjiMediaOption] {
        DailyKanjiSelector.mediaOptions(cards: cards)
    }

    var mediaPickerOptions: [DailyKanjiMediaOption] {
        availableMedia
    }

    var availableMediaForCurrentMode: [DailyKanjiMediaOption] {
        DailyKanjiSelector.mediaOptions(cards: cards, studyMode: selectedStudyMode)
    }

    var scopedCardCount: Int {
        cardsForCurrentScope().count
    }

    var draftScopedCardCount: Int {
        cardsForScope(mediaSlug: draftMediaSlug, studyMode: draftStudyMode).count
    }

    var hasStudyScopeDraftChanges: Bool {
        selectedStudyMode != draftStudyMode || selectedMediaSlug != draftMediaSlug
    }

    func activate(now: Date = .now) {
        refreshHistory(now: now)
        defer {
            startSyncTask(now: now, force: false)
        }

        if shouldSuppressActivationSelection(now: now) {
            return
        }

        if let pendingPreparedSelectionCardId {
            self.pendingPreparedSelectionCardId = nil
            if let card = cards.first(where: { $0.cardId == pendingPreparedSelectionCardId }) {
                select(card: card, shownAt: now, tracksTransientInitialActivation: true)
                return
            }
        }

        guard
            let card = DailyKanjiSelector.select(
                cards: cards,
                history: selectionHistoryItems(),
                now: now,
                mode: .appOpen,
                mediaSlug: selectedMediaSlug,
                studyMode: selectedStudyMode
            )
        else {
            return
        }

        select(card: card, shownAt: now)
    }

    func refreshNow(now: Date = .now) {
        startSyncTask(now: now, force: true)
    }

    func syncNow(now: Date = .now, force: Bool = false) async {
        guard let syncer else {
            syncState = .unavailable
            return
        }

        let source = currentDatasetSource()
        guard
            syncPolicy.shouldSync(
                now: now,
                metadata: cacheStore.loadMetadata(),
                lastFailureAt: lastFailureAt,
                consecutiveFailureCount: consecutiveFailureCount,
                force: force
            )
        else {
            syncState = .idle(source: source)
            return
        }

        syncState = .syncing(source: source)

        do {
            let dataset = try await syncer.fetchDataset()
            guard !dataset.cards.isEmpty else {
                throw DailyKanjiAppSyncError.emptyDataset
            }
            guard
                !repository.requiresStudyModeAwareSync()
                    || dataset.supportsMediaStudyModes
            else {
                throw DailyKanjiAppSyncError.missingStudyModes
            }

            try cacheStore.write(dataset: dataset, cachedAt: now)
            cards = dataset.cards
            lastFailureAt = nil
            consecutiveFailureCount = 0
            pendingPreparedSelectionCardId = nil
            transientInitialActivationEvent = nil
            normalizeSelectedMediaForCurrentMode()
            resetStudyScopeDraft()
            persistCurrentScope()
            prepareInitialSelection(now: now)
            syncState = .idle(source: currentDatasetSource())
            reloadTimelines()
        } catch {
            lastFailureAt = now
            consecutiveFailureCount = min(
                consecutiveFailureCount + 1,
                DailyKanjiSyncPolicy.maximumTrackedFailureCount
            )
            syncState = .failed(
                message: Self.syncFailureMessage(for: error),
                source: currentDatasetSource()
            )
        }
    }

    func selectHistoryItem(_ item: DailyKanjiPresentationHistoryItem, now: Date = .now) {
        guard
            let card = cards.first(where: { $0.cardId == item.cardId })
        else {
            return
        }

        pendingPreparedSelectionCardId = nil
        select(card: card, shownAt: now, context: item)
    }

    func setDraftStudyMode(_ mode: DailyKanjiStudyMode) {
        guard draftStudyMode != mode else {
            return
        }

        draftStudyMode = mode
        draftMediaSlug = defaultMediaSlug(for: mode)
    }

    func setDraftSelectedMediaSlug(_ mediaSlug: String?) {
        guard draftMediaSlug != mediaSlug else {
            return
        }

        draftMediaSlug = mediaSlug
        normalizeDraftMediaForCurrentMode(preferCurrentModeMatch: false)
    }

    func applyStudyScope(now: Date = .now) {
        normalizeDraftMediaForCurrentMode(preferCurrentModeMatch: false)
        guard hasStudyScopeDraftChanges else {
            return
        }

        selectedStudyMode = draftStudyMode
        selectedMediaSlug = draftMediaSlug
        pendingPreparedSelectionCardId = nil
        transientInitialActivationEvent = nil
        persistCurrentScope()
        prepareInitialSelection(now: now)
        reloadTimelines()
    }

    func resetStudyScopeDraft() {
        draftStudyMode = selectedStudyMode
        draftMediaSlug = selectedMediaSlug
        normalizeDraftMediaForCurrentMode(preferCurrentModeMatch: false)
    }

    func openDeepLink(_ url: URL, now: Date = .now) {
        guard
            let cardId = DailyKanjiDeepLink.cardId(from: url),
            let card = cards.first(where: { $0.cardId == cardId })
        else {
            return
        }

        pendingPreparedSelectionCardId = nil
        removeTransientInitialActivationIfNeeded(now: now)
        select(
            card: card,
            shownAt: now,
            context: DailyKanjiPresentationHistoryItem(
                cardId: card.cardId,
                shownAt: DailyKanjiSelector.currentWidgetSlotStart(for: now),
                source: .widget
            )
        )
        suppressActivationUntil = now.addingTimeInterval(deepLinkActivationSuppressionInterval)
    }

    func card(for historyItem: DailyKanjiPresentationHistoryItem) -> DailyKanjiCard? {
        cards.first { $0.cardId == historyItem.cardId }
    }

    private func prepareInitialSelection(now: Date) {
        refreshHistory(now: now)
        selectedCard = DailyKanjiSelector.select(
            cards: cards,
            history: selectionHistoryItems(),
            now: now,
            mode: .appOpen,
            mediaSlug: selectedMediaSlug,
            studyMode: selectedStudyMode
        )
        if let selectedCard {
            selectedHistoryContext = DailyKanjiPresentationHistoryItem(
                cardId: selectedCard.cardId,
                shownAt: now,
                source: .app
            )
            pendingPreparedSelectionCardId = selectedCard.cardId
        } else {
            pendingPreparedSelectionCardId = nil
        }
    }

    private func select(
        card: DailyKanjiCard,
        shownAt: Date,
        context: DailyKanjiPresentationHistoryItem? = nil,
        tracksTransientInitialActivation: Bool = false
    ) {
        selectedCard = card
        selectedHistoryContext = context ?? DailyKanjiPresentationHistoryItem(
            cardId: card.cardId,
            shownAt: shownAt,
            source: .app
        )
        let historyItem = historyStore.record(cardId: card.cardId, shownAt: shownAt)
        transientInitialActivationEvent = tracksTransientInitialActivation ? historyItem : nil
        refreshHistory(now: shownAt)
        reloadTimelines()
    }

    private func startSyncTask(now: Date, force: Bool) {
        guard syncTask == nil else {
            return
        }
        guard shouldStartSync(now: now, force: force) else {
            return
        }

        syncTask = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            await self.syncNow(now: now, force: force)
            self.syncTask = nil
        }
    }

    private func shouldStartSync(now: Date, force: Bool) -> Bool {
        guard syncer != nil else {
            syncState = .unavailable
            return false
        }

        let source = currentDatasetSource()
        guard
            syncPolicy.shouldSync(
                now: now,
                metadata: cacheStore.loadMetadata(),
                lastFailureAt: lastFailureAt,
                consecutiveFailureCount: consecutiveFailureCount,
                force: force
            )
        else {
            syncState = .idle(source: source)
            return false
        }

        return true
    }

    private func removeTransientInitialActivationIfNeeded(now: Date) {
        guard let transientInitialActivationEvent else {
            return
        }

        self.transientInitialActivationEvent = nil

        guard
            now.timeIntervalSince(transientInitialActivationEvent.shownAt)
                <= deepLinkActivationSuppressionInterval
        else {
            return
        }

        historyStore.remove(eventId: transientInitialActivationEvent.eventId)
    }

    private func shouldSuppressActivationSelection(now: Date) -> Bool {
        guard let suppressActivationUntil else {
            return false
        }

        self.suppressActivationUntil = nil
        return now <= suppressActivationUntil
    }

    private func refreshHistory(now: Date) {
        let appItems = historyStore.recentItems(
            now: now,
            days: DailyKanjiSelector.defaultHistoryLookbackDays
        )
        let widgetItems = DailyKanjiSelector.recentWidgetTimelineItems(
            cards: cards,
            now: now,
            mediaSlug: selectedMediaSlug,
            studyMode: selectedStudyMode,
            days: DailyKanjiSelector.defaultHistoryLookbackDays
        )

        recentHistory = DailyKanjiPresentationHistory.merge(
            appItems: appItems,
            widgetItems: widgetItems
        )
        recentSelectionHistory = appItems + DailyKanjiSelector.recentWidgetSelectionItems(
            cards: cards,
            now: now,
            mediaSlug: selectedMediaSlug,
            studyMode: selectedStudyMode
        )
    }

    private func cardsForCurrentScope() -> [DailyKanjiCard] {
        cardsForScope(mediaSlug: selectedMediaSlug, studyMode: selectedStudyMode)
    }

    private func cardsForScope(
        mediaSlug: String?,
        studyMode: DailyKanjiStudyMode
    ) -> [DailyKanjiCard] {
        DailyKanjiSelector.scopedCards(
            cards,
            mediaSlug: mediaSlug,
            studyMode: studyMode
        )
    }

    private func normalizeSelectedMediaForCurrentMode(
        preferCurrentModeMatch: Bool = false
    ) {
        selectedMediaSlug = normalizedMediaSlug(
            selectedMediaSlug,
            for: selectedStudyMode,
            preferCurrentModeMatch: preferCurrentModeMatch
        )
    }

    private func normalizeDraftMediaForCurrentMode(
        preferCurrentModeMatch: Bool = false
    ) {
        draftMediaSlug = normalizedMediaSlug(
            draftMediaSlug,
            for: draftStudyMode,
            preferCurrentModeMatch: preferCurrentModeMatch
        )
    }

    private func normalizedMediaSlug(
        _ mediaSlug: String?,
        for studyMode: DailyKanjiStudyMode,
        preferCurrentModeMatch: Bool
    ) -> String? {
        let pickerOptions = mediaPickerOptions
        let modeOptions = DailyKanjiSelector.mediaOptions(
            cards: cards,
            studyMode: studyMode
        )

        if studyMode == .daily && mediaSlug == nil {
            return nil
        }

        if let mediaSlug,
           pickerOptions.contains(where: { $0.slug == mediaSlug }) {
            let selectedHasCurrentModeCards = modeOptions.contains {
                $0.slug == mediaSlug
            }

            if !preferCurrentModeMatch
                || selectedHasCurrentModeCards
                || modeOptions.isEmpty {
                return mediaSlug
            }
        }

        return modeOptions.first?.slug ?? pickerOptions.first?.slug
    }

    private func defaultMediaSlug(for studyMode: DailyKanjiStudyMode) -> String? {
        if studyMode == .daily {
            return nil
        }

        return DailyKanjiSelector.mediaOptions(
            cards: cards,
            studyMode: studyMode
        ).first?.slug ?? mediaPickerOptions.first?.slug
    }

    private func restoreSavedScope() {
        let scope = scopeStore.load()
        selectedStudyMode = scope.studyMode
        selectedMediaSlug = scope.mediaSlug
        normalizeSelectedMediaForCurrentMode(preferCurrentModeMatch: false)
    }

    private func persistCurrentScope() {
        scopeStore.save(
            DailyKanjiStudyScope(
                studyMode: selectedStudyMode,
                mediaSlug: selectedMediaSlug
            )
        )
    }

    private func selectionHistoryItems() -> [DailyKanjiHistoryItem] {
        recentSelectionHistory
    }

    private func currentDatasetSource() -> DailyKanjiDatasetSource {
        repository.loadDatasetSource()
    }

    private static func initialSyncState(
        syncer: DailyKanjiSyncing?,
        source: DailyKanjiDatasetSource
    ) -> DailyKanjiSyncState {
        guard syncer != nil else {
            return .unavailable
        }

        return .idle(source: source)
    }

    private static func syncFailureMessage(for error: Error) -> String {
        if let description = (error as? LocalizedError)?.errorDescription,
           !description.isEmpty {
            return description
        }

        return "Could not refresh Daily Kanji."
    }
}

private enum DailyKanjiAppSyncError: LocalizedError {
    case emptyDataset
    case missingStudyModes

    var errorDescription: String? {
        switch self {
        case .emptyDataset:
            return "Downloaded dataset has no cards."
        case .missingStudyModes:
            return "Downloaded dataset does not include Daily Kanji study modes."
        }
    }
}
