import Foundation
import SwiftUI
import WidgetKit

enum DailyKanjiSyncState: Equatable {
    case unavailable
    case idle(source: DailyKanjiDatasetSource)
    case syncing(source: DailyKanjiDatasetSource)
    case failed(message: String, source: DailyKanjiDatasetSource)
}

struct DailyKanjiLiveReviewRefreshPolicy {
    static let maximumTrackedFailureCount = 8

    let freshnessInterval: TimeInterval
    let initialFailureBackoff: TimeInterval
    let maximumFailureBackoff: TimeInterval

    init(
        freshnessInterval: TimeInterval = 5 * 60,
        initialFailureBackoff: TimeInterval = 60,
        maximumFailureBackoff: TimeInterval = 15 * 60
    ) {
        self.freshnessInterval = max(freshnessInterval, 0)
        self.initialFailureBackoff = max(initialFailureBackoff, 0)
        self.maximumFailureBackoff = max(maximumFailureBackoff, 0)
    }

    func shouldRefresh(
        now: Date,
        lastSuccessAt: Date?,
        lastFailureAt: Date?,
        consecutiveFailureCount: Int,
        force: Bool
    ) -> Bool {
        if force {
            return true
        }

        if let lastFailureAt {
            let exponent = max(min(consecutiveFailureCount, Self.maximumTrackedFailureCount) - 1, 0)
            let backoff = min(
                initialFailureBackoff * pow(2, Double(exponent)),
                maximumFailureBackoff
            )
            if now.timeIntervalSince(lastFailureAt) < backoff {
                return false
            }
        }

        guard let lastSuccessAt else {
            return true
        }

        return now.timeIntervalSince(lastSuccessAt) >= freshnessInterval
    }
}

@MainActor
final class DailyKanjiAppModel: ObservableObject {
    @Published private(set) var cards: [DailyKanjiCard]
    @Published private(set) var glossaryEntries: [DailyKanjiGlossaryEntry]
    @Published private(set) var selectedCard: DailyKanjiCard?
    @Published private(set) var selectedHistoryContext: DailyKanjiPresentationHistoryItem?
    @Published private(set) var selectedMediaSlug: String?
    @Published private(set) var selectedStudyMode: DailyKanjiStudyMode = .daily
    @Published private(set) var draftMediaSlug: String?
    @Published private(set) var draftStudyMode: DailyKanjiStudyMode = .daily
    @Published private(set) var recentHistory: [DailyKanjiPresentationHistoryItem] = []
    @Published private(set) var syncState: DailyKanjiSyncState
    @Published private(set) var liveReviewState: DailyKanjiLiveReviewState
    @Published private(set) var selectedTab: DailyKanjiAppTab
    @Published private(set) var notificationAuthorizationState:
        DailyKanjiNotificationAuthorizationState

    private let cacheWriter: any DailyKanjiCacheWriting
    private let historyStore: DailyKanjiHistoryStore
    private let widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore
    private let scopeStore: DailyKanjiStudyScopeStore
    private let syncPolicy: DailyKanjiSyncPolicy
    private let liveReviewRefreshPolicy: DailyKanjiLiveReviewRefreshPolicy
    private let syncer: DailyKanjiSyncing?
    private let liveReviewClient: DailyKanjiLiveReviewing?
    private let notificationRegistrar: DailyKanjiNotificationRegistering?
    private let reloadTimelines: () -> Void
    private let liveReviewNow: () -> Date
    private let deepLinkActivationSuppressionInterval: TimeInterval = 5
    private var datasetSource: DailyKanjiDatasetSource
    private var glossarySnapshot: DailyKanjiGlossarySnapshot?
    private var requiresStudyModeAwareSync: Bool
    private var activeSyncId: UUID?
    private var syncTask: Task<Void, Never>?
    private var liveReviewFetchTask: Task<Void, Never>?
    private var activeLiveReviewFetchId: UUID?
    private var liveReviewGradeTask: Task<Void, Never>?
    private var activeLiveReviewGradeId: UUID?
    private var pendingForcedLiveReviewFetch = false
    private var notificationAuthorizationRefreshTask: Task<Void, Never>?
    private var notificationRegistrationTask: Task<Void, Never>?
    private var deviceTokenTask: Task<Void, Never>?
    private var lastFailureAt: Date?
    private var consecutiveFailureCount = 0
    private var suppressActivationUntil: Date?
    private var pendingPreparedSelectionCardId: String?
    private var recentSelectionHistory: [DailyKanjiHistoryItem] = []
    private var transientInitialActivationEvent: DailyKanjiHistoryItem?
    private var liveCardPresentedAt: Date?
    private var pendingLiveReviewResponseRetry: LiveReviewResponseRetry?
    private var lastLiveReviewSuccessAt: Date?
    private var lastLiveReviewFailureAt: Date?
    private var liveReviewConsecutiveFailureCount = 0

    private struct LiveReviewFetchContext {
        let id: UUID
        let staleSession: DailyKanjiLiveReviewSession?
        let visibleCardId: String?
        let visibleReviewStateUpdatedAt: String?
        let presentedAt: Date?
    }

    private struct LiveReviewGradeContext {
        let id: UUID
        let card: DailyKanjiLiveReviewCard
        let rating: DailyKanjiLiveReviewRating
        let originalSession: DailyKanjiLiveReviewSession
        let originalPresentedAt: Date?
        let optimisticSession: DailyKanjiLiveReviewSession?
        let optimisticPresentedAt: Date?
        let responseMs: Int?
    }

    private struct LiveReviewResponseRetry {
        let cardId: String
        let reviewStateUpdatedAt: String?
        let responseMs: Int?

        func matches(_ card: DailyKanjiLiveReviewCard) -> Bool {
            cardId == card.cardId && reviewStateUpdatedAt == card.reviewStateUpdatedAt
        }
    }

    init(
        repository: DailyKanjiRepository? = nil,
        initialRepositorySnapshot: DailyKanjiRepositorySnapshot? = nil,
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore(),
        cacheWriter: (any DailyKanjiCacheWriting)? = nil,
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore =
            DailyKanjiWidgetTimelineHistoryStore(),
        scopeStore: DailyKanjiStudyScopeStore = DailyKanjiStudyScopeStore(),
        syncPolicy: DailyKanjiSyncPolicy = DailyKanjiSyncPolicy(),
        liveReviewRefreshPolicy: DailyKanjiLiveReviewRefreshPolicy =
            DailyKanjiLiveReviewRefreshPolicy(),
        syncer: DailyKanjiSyncing? = DailyKanjiSyncClient(),
        liveReviewClient: DailyKanjiLiveReviewing? = DailyKanjiLiveReviewClient(),
        notificationRegistrar: DailyKanjiNotificationRegistering? =
            DailyKanjiPushNotificationRegistrar(),
        reloadTimelines: @escaping () -> Void = {
            WidgetCenter.shared.reloadAllTimelines()
        },
        liveReviewNow: @escaping () -> Date = { .now },
        now: Date = .now
    ) {
        let resolvedRepository = repository ?? DailyKanjiRepository(cacheStore: cacheStore)
        let repositorySnapshot = initialRepositorySnapshot
            ?? resolvedRepository.loadSnapshot(now: now)
        self.cacheWriter = cacheWriter ?? resolvedRepository.makeCacheWriter()
        self.cards = repositorySnapshot.cards
        self.glossaryEntries = repositorySnapshot.glossaryEntries
        self.historyStore = historyStore
        self.widgetHistoryStore = widgetHistoryStore
        self.scopeStore = scopeStore
        self.syncPolicy = syncPolicy
        self.liveReviewRefreshPolicy = liveReviewRefreshPolicy
        self.syncer = syncer
        self.liveReviewClient = liveReviewClient
        self.notificationRegistrar = notificationRegistrar
        self.reloadTimelines = reloadTimelines
        self.liveReviewNow = liveReviewNow
        self.datasetSource = repositorySnapshot.source
        self.glossarySnapshot = repositorySnapshot.dataset?.glossary
        self.requiresStudyModeAwareSync = repositorySnapshot.requiresStudyModeAwareSync
        self.syncState = Self.initialSyncState(
            syncer: syncer,
            source: repositorySnapshot.source
        )
        self.liveReviewState = Self.initialLiveReviewState(liveReviewClient: liveReviewClient)
        self.selectedTab = liveReviewClient == nil ? .widget : .review
        self.notificationAuthorizationState = Self.initialNotificationAuthorizationState(
            liveReviewClient: liveReviewClient,
            notificationRegistrar: notificationRegistrar
        )
        let restoredScopeWasCorrected = restoreSavedScope()
        resetStudyScopeDraft()
        persistCurrentScope()
        prepareInitialSelection(now: now)
        if restoredScopeWasCorrected {
            reloadTimelines()
        }
    }

    init(
        cards: [DailyKanjiCard],
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore =
            DailyKanjiWidgetTimelineHistoryStore.emptyTransientStore(),
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore(),
        cacheWriter: (any DailyKanjiCacheWriting)? = nil,
        scopeStore: DailyKanjiStudyScopeStore = DailyKanjiStudyScopeStore(),
        syncPolicy: DailyKanjiSyncPolicy = DailyKanjiSyncPolicy(),
        liveReviewRefreshPolicy: DailyKanjiLiveReviewRefreshPolicy =
            DailyKanjiLiveReviewRefreshPolicy(),
        syncer: DailyKanjiSyncing? = nil,
        liveReviewClient: DailyKanjiLiveReviewing? = nil,
        notificationRegistrar: DailyKanjiNotificationRegistering? = nil,
        reloadTimelines: @escaping () -> Void = {
            WidgetCenter.shared.reloadAllTimelines()
        },
        liveReviewNow: @escaping () -> Date = { .now },
        now: Date = .now
    ) {
        self.cacheWriter = cacheWriter ?? cacheStore.makeWriter()
        self.cards = cards
        self.glossaryEntries = []
        self.historyStore = historyStore
        self.widgetHistoryStore = widgetHistoryStore
        self.scopeStore = scopeStore
        self.syncPolicy = syncPolicy
        self.liveReviewRefreshPolicy = liveReviewRefreshPolicy
        self.syncer = syncer
        self.liveReviewClient = liveReviewClient
        self.notificationRegistrar = notificationRegistrar
        self.reloadTimelines = reloadTimelines
        self.liveReviewNow = liveReviewNow
        self.datasetSource = .sample
        self.glossarySnapshot = nil
        self.requiresStudyModeAwareSync = cards.contains {
            $0.studyModes != nil
        }
        self.syncState = Self.initialSyncState(syncer: syncer, source: .sample)
        self.liveReviewState = Self.initialLiveReviewState(liveReviewClient: liveReviewClient)
        self.selectedTab = liveReviewClient == nil ? .widget : .review
        self.notificationAuthorizationState = Self.initialNotificationAuthorizationState(
            liveReviewClient: liveReviewClient,
            notificationRegistrar: notificationRegistrar
        )
        let restoredScopeWasCorrected = restoreSavedScope()
        resetStudyScopeDraft()
        persistCurrentScope()
        prepareInitialSelection(now: now)
        if restoredScopeWasCorrected {
            reloadTimelines()
        }
    }

    var availableMedia: [DailyKanjiMediaOption] {
        DailyKanjiSelector.mediaOptions(cards: cards)
    }

    var mediaPickerOptions: [DailyKanjiMediaOption] {
        guard draftStudyMode.usesMediaSelection else {
            return availableMedia
        }

        return DailyKanjiSelector.mediaOptions(
            cards: cards,
            studyMode: draftStudyMode
        )
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

    var draftStudyModeUsesMediaSelection: Bool {
        draftStudyMode.usesMediaSelection
    }

    var hasStudyScopeDraftChanges: Bool {
        selectedStudyMode != draftStudyMode || selectedMediaSlug != draftMediaSlug
    }

    func activate(now: Date = .now) {
        refreshHistory(now: now)
        refreshNotificationAuthorizationState()
        startLiveReviewFetchTask(now: now)
        defer {
            startSyncTask(now: now, force: false)
        }

        guard selectedTab == .widget else {
            return
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

    func refreshLiveReviewNow() {
        startLiveReviewFetchTask(now: liveReviewNow(), force: true)
    }

    func openAndRefreshLiveReview() {
        selectedTab = .review
        startLiveReviewFetchTask(now: liveReviewNow(), force: true)
    }

    func selectTab(_ tab: DailyKanjiAppTab, now: Date = .now) {
        let previousTab = selectedTab
        selectedTab = tab

        if tab == .review {
            startLiveReviewFetchTask(now: now)
        } else {
            cancelLiveReviewFetch()
        }

        guard
            previousTab != .widget,
            tab == .widget,
            let selectedCard
        else {
            return
        }

        pendingPreparedSelectionCardId = nil
        select(card: selectedCard, shownAt: now)
    }

    func syncNow(now: Date = .now, force: Bool = false) async {
        guard activeSyncId == nil else {
            return
        }
        guard let syncer else {
            syncState = .unavailable
            return
        }

        let source = datasetSource
        guard
            syncPolicy.shouldSync(
                now: now,
                metadata: currentCacheMetadata,
                lastFailureAt: lastFailureAt,
                consecutiveFailureCount: consecutiveFailureCount,
                force: force
            )
        else {
            syncState = .idle(source: source)
            return
        }

        let syncId = UUID()
        activeSyncId = syncId
        defer {
            if activeSyncId == syncId {
                activeSyncId = nil
            }
        }
        syncState = .syncing(source: source)

        do {
            let dataset = try await syncer.fetchDataset()
            guard dataset.version == DailyKanjiDataset.supportedVersion else {
                throw DailyKanjiAppSyncError.unsupportedDatasetVersion
            }
            guard !dataset.cards.isEmpty else {
                throw DailyKanjiAppSyncError.emptyDataset
            }
            guard
                !requiresStudyModeAwareSync
                    || dataset.supportsMediaStudyModes
            else {
                throw DailyKanjiAppSyncError.missingStudyModes
            }

            let mergedDataset = dataset.replacingGlossary(
                dataset.glossary ?? glossarySnapshot
            )
            let metadata = try await cacheWriter.write(
                dataset: mergedDataset,
                cachedAt: now
            )
            guard activeSyncId == syncId else {
                return
            }

            let visibleCardId = selectedCard?.cardId
            let dirtyDraftScope = hasStudyScopeDraftChanges
                ? DailyKanjiStudyScope(
                    studyMode: draftStudyMode,
                    mediaSlug: draftMediaSlug
                )
                : nil
            cards = mergedDataset.cards
            glossarySnapshot = mergedDataset.glossary
            glossaryEntries = mergedDataset.glossary?.entries ?? []
            datasetSource = .cache(metadata: metadata)
            requiresStudyModeAwareSync = requiresStudyModeAwareSync
                || dataset.supportsMediaStudyModes
            lastFailureAt = nil
            consecutiveFailureCount = 0
            normalizeSelectedStudyScope()
            if let dirtyDraftScope {
                draftStudyMode = dirtyDraftScope.studyMode
                draftMediaSlug = dirtyDraftScope.mediaSlug
                normalizeDraftStudyScope()
            } else {
                resetStudyScopeDraft()
            }
            persistCurrentScope()
            updateVisibleSelection(
                preferredCardId: visibleCardId,
                now: now,
                recordsReplacement: selectedTab == .widget,
                recordsPreparedSelection: false
            )
            syncState = .idle(source: datasetSource)
            reloadTimelines()
        } catch {
            lastFailureAt = now
            consecutiveFailureCount = min(
                consecutiveFailureCount + 1,
                DailyKanjiSyncPolicy.maximumTrackedFailureCount
            )
            syncState = .failed(
                message: Self.syncFailureMessage(for: error),
                source: datasetSource
            )
        }
    }

    func fetchLiveReviewSession() async {
        let task = startLiveReviewFetchTask(now: liveReviewNow(), force: true)
        await task?.value
    }

    func gradeLiveReview(_ rating: DailyKanjiLiveReviewRating) {
        guard
            liveReviewState.canGrade,
            let card = liveReviewState.session?.selectedCard
        else {
            return
        }

        startLiveReviewGradeTask(card: card, rating: rating)
    }

    func gradeLiveReviewNow(
        card: DailyKanjiLiveReviewCard,
        rating: DailyKanjiLiveReviewRating
    ) async {
        let task = startLiveReviewGradeTask(card: card, rating: rating)
        await task?.value
    }

    func requestNotificationRegistration() {
        guard notificationRegistrationTask == nil else {
            return
        }
        guard notificationAuthorizationState == .notDetermined else {
            return
        }
        guard liveReviewClient != nil,
              let notificationRegistrar,
              notificationRegistrar.isAvailable else {
            notificationAuthorizationState = .unavailable
            return
        }

        notificationAuthorizationRefreshTask?.cancel()
        notificationAuthorizationRefreshTask = nil
        notificationRegistrationTask = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            let state = await notificationRegistrar.requestAuthorizationAndRegister()
            guard !Task.isCancelled else {
                return
            }

            self.notificationAuthorizationState = state
            self.notificationRegistrationTask = nil
        }
    }

    func refreshNotificationAuthorizationState() {
        guard notificationAuthorizationRefreshTask == nil,
              notificationRegistrationTask == nil else {
            return
        }
        guard liveReviewClient != nil,
              let notificationRegistrar,
              notificationRegistrar.isAvailable else {
            notificationAuthorizationState = .unavailable
            return
        }

        notificationAuthorizationRefreshTask = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            let state = await notificationRegistrar.authorizationState()
            guard !Task.isCancelled else {
                return
            }

            self.notificationAuthorizationState = state
            if state == .authorized {
                await notificationRegistrar.registerForRemoteNotifications()
            }
            self.notificationAuthorizationRefreshTask = nil
        }
    }

    func registerDeviceToken(_ deviceToken: String) {
        guard let liveReviewClient else {
            return
        }

        deviceTokenTask?.cancel()
        deviceTokenTask = Task { [liveReviewClient] in
            try? await liveReviewClient.registerDeviceToken(deviceToken)
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
        draftMediaSlug = nil
        normalizeDraftStudyScope()
    }

    func setDraftSelectedMediaSlug(_ mediaSlug: String?) {
        guard draftMediaSlug != mediaSlug else {
            return
        }

        draftMediaSlug = mediaSlug
        normalizeDraftStudyScope()
    }

    func applyStudyScope(now: Date = .now) {
        normalizeDraftStudyScope()
        guard hasStudyScopeDraftChanges else {
            return
        }

        selectedStudyMode = draftStudyMode
        selectedMediaSlug = draftMediaSlug
        transientInitialActivationEvent = nil
        persistCurrentScope()
        updateVisibleSelection(
            preferredCardId: nil,
            now: now,
            recordsReplacement: true,
            recordsPreparedSelection: true
        )
        reloadTimelines()
    }

    func resetStudyScopeDraft() {
        draftStudyMode = selectedStudyMode
        draftMediaSlug = selectedMediaSlug
        normalizeDraftStudyScope()
    }

    func openDeepLink(_ url: URL, now: Date = .now) {
        guard let cardId = DailyKanjiDeepLink.cardId(from: url) else {
            return
        }

        cancelLiveReviewFetch()

        guard let card = cards.first(where: { $0.cardId == cardId }) else {
            selectedTab = .widget
            pendingPreparedSelectionCardId = nil
            removeTransientInitialActivationIfNeeded(now: now)
            if let selectedCard {
                select(card: selectedCard, shownAt: now)
            }
            suppressActivationUntil = now.addingTimeInterval(deepLinkActivationSuppressionInterval)
            return
        }

        selectedTab = .widget
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

    private func updateVisibleSelection(
        preferredCardId: String?,
        now: Date,
        recordsReplacement: Bool,
        recordsPreparedSelection: Bool
    ) {
        refreshHistory(now: now)
        let preferredCard = preferredCardId.flatMap { cardId in
            cards.first { $0.cardId == cardId }
        }
        let nextCard = preferredCard ?? DailyKanjiSelector.select(
            cards: cards,
            history: selectionHistoryItems(),
            now: now,
            mode: .appOpen,
            mediaSlug: selectedMediaSlug,
            studyMode: selectedStudyMode
        )

        guard let nextCard else {
            selectedCard = nil
            selectedHistoryContext = nil
            pendingPreparedSelectionCardId = nil
            transientInitialActivationEvent = nil
            return
        }

        let previousCardId = selectedCard?.cardId
        let isPreparedSelection = pendingPreparedSelectionCardId == nextCard.cardId
        let defersReplacementUntilActivation = !recordsPreparedSelection
            && pendingPreparedSelectionCardId != nil
        let defersHiddenReplacement = !recordsReplacement

        if previousCardId != nextCard.cardId
            && (defersReplacementUntilActivation || defersHiddenReplacement) {
            selectedCard = nextCard
            selectedHistoryContext = DailyKanjiPresentationHistoryItem(
                cardId: nextCard.cardId,
                shownAt: now,
                source: .app
            )
            pendingPreparedSelectionCardId = nextCard.cardId
            transientInitialActivationEvent = nil
            return
        }

        if recordsReplacement
            && (previousCardId != nextCard.cardId
                || (recordsPreparedSelection && isPreparedSelection)) {
            pendingPreparedSelectionCardId = nil
            select(card: nextCard, shownAt: now)
            return
        }

        selectedCard = nextCard
        if previousCardId != nextCard.cardId || selectedHistoryContext == nil {
            selectedHistoryContext = DailyKanjiPresentationHistoryItem(
                cardId: nextCard.cardId,
                shownAt: now,
                source: .app
            )
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

    @discardableResult
    private func startLiveReviewFetchTask(
        now: Date,
        force: Bool = false
    ) -> Task<Void, Never>? {
        guard selectedTab == .review else {
            return nil
        }
        guard liveReviewClient != nil else {
            liveReviewState = .unavailable
            return nil
        }
        guard liveReviewGradeTask == nil else {
            if force {
                pendingForcedLiveReviewFetch = true
            }
            return nil
        }
        guard liveReviewFetchTask == nil || force else {
            return nil
        }
        guard
            liveReviewRefreshPolicy.shouldRefresh(
                now: now,
                lastSuccessAt: lastLiveReviewSuccessAt,
                lastFailureAt: lastLiveReviewFailureAt,
                consecutiveFailureCount: liveReviewConsecutiveFailureCount,
                force: force
            )
        else {
            return nil
        }

        let previousTask = liveReviewFetchTask
        let staleSession = liveReviewState.session
        let context = LiveReviewFetchContext(
            id: UUID(),
            staleSession: staleSession,
            visibleCardId: staleSession?.selectedCard?.cardId,
            visibleReviewStateUpdatedAt: staleSession?.selectedCard?.reviewStateUpdatedAt,
            presentedAt: liveCardPresentedAt
        )
        activeLiveReviewFetchId = context.id
        liveReviewState = .loading(staleSession: staleSession)

        let task = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            await self.performLiveReviewFetch(context: context)
            self.finishLiveReviewFetch(id: context.id)
        }
        liveReviewFetchTask = task
        previousTask?.cancel()
        return task
    }

    private func performLiveReviewFetch(context: LiveReviewFetchContext) async {
        guard let liveReviewClient else {
            return
        }

        do {
            let session = try await liveReviewClient.fetchSession()
            try Task.checkCancellation()
            guard activeLiveReviewFetchId == context.id else {
                return
            }

            liveReviewState = .ready(session: session)
            lastLiveReviewSuccessAt = liveReviewNow()
            lastLiveReviewFailureAt = nil
            liveReviewConsecutiveFailureCount = 0
            updateLiveCardPresentationAfterFetch(session: session, context: context)
        } catch {
            guard activeLiveReviewFetchId == context.id else {
                return
            }
            guard !Task.isCancelled, !Self.isCancellation(error) else {
                return
            }

            liveReviewState = .failed(
                message: Self.liveReviewFailureMessage(for: error),
                staleSession: context.staleSession
            )
            lastLiveReviewFailureAt = liveReviewNow()
            liveReviewConsecutiveFailureCount = min(
                liveReviewConsecutiveFailureCount + 1,
                DailyKanjiLiveReviewRefreshPolicy.maximumTrackedFailureCount
            )
        }
    }

    private func finishLiveReviewFetch(id: UUID) {
        guard activeLiveReviewFetchId == id else {
            return
        }

        activeLiveReviewFetchId = nil
        liveReviewFetchTask = nil
    }

    private func cancelLiveReviewFetch() {
        guard liveReviewFetchTask != nil else {
            return
        }

        activeLiveReviewFetchId = nil
        liveReviewFetchTask?.cancel()
        liveReviewFetchTask = nil
        if case .loading(let staleSession) = liveReviewState, let staleSession {
            liveReviewState = .ready(session: staleSession)
        }
    }

    private func updateLiveCardPresentationAfterFetch(
        session: DailyKanjiLiveReviewSession,
        context: LiveReviewFetchContext
    ) {
        guard let selectedCard = session.selectedCard else {
            liveCardPresentedAt = nil
            pendingLiveReviewResponseRetry = nil
            return
        }

        if pendingLiveReviewResponseRetry?.matches(selectedCard) != true {
            pendingLiveReviewResponseRetry = nil
        }

        if selectedCard.cardId == context.visibleCardId
            && selectedCard.reviewStateUpdatedAt == context.visibleReviewStateUpdatedAt {
            liveCardPresentedAt = context.presentedAt ?? liveReviewNow()
        } else {
            liveCardPresentedAt = liveReviewNow()
        }
    }

    @discardableResult
    private func startLiveReviewGradeTask(
        card: DailyKanjiLiveReviewCard,
        rating: DailyKanjiLiveReviewRating
    ) -> Task<Void, Never>? {
        guard let liveReviewClient else {
            liveReviewState = .unavailable
            return nil
        }
        guard
            liveReviewGradeTask == nil,
            liveReviewState.canGrade,
            let originalSession = liveReviewState.session,
            originalSession.selectedCard?.cardId == card.cardId
        else {
            return nil
        }

        let submittedAt = liveReviewNow()
        let originalPresentedAt = liveCardPresentedAt
        let optimisticSession = originalSession.optimisticallyAdvancingAfterGrade()
        let optimisticPresentedAt = optimisticSession?.selectedCard == nil ? nil : submittedAt
        let responseMs: Int?
        if let retry = pendingLiveReviewResponseRetry, retry.matches(card) {
            responseMs = retry.responseMs
        } else {
            responseMs = originalPresentedAt.map {
                max(Int(submittedAt.timeIntervalSince($0) * 1000), 0)
            }
        }
        pendingLiveReviewResponseRetry = nil
        let context = LiveReviewGradeContext(
            id: UUID(),
            card: card,
            rating: rating,
            originalSession: originalSession,
            originalPresentedAt: originalPresentedAt,
            optimisticSession: optimisticSession,
            optimisticPresentedAt: optimisticPresentedAt,
            responseMs: responseMs
        )

        activeLiveReviewFetchId = nil
        liveReviewFetchTask?.cancel()
        liveReviewFetchTask = nil
        activeLiveReviewGradeId = context.id

        if let optimisticSession {
            liveReviewState = .submitting(session: optimisticSession, rating: rating)
            liveCardPresentedAt = optimisticPresentedAt
        } else {
            liveReviewState = .submitting(session: originalSession, rating: rating)
        }

        let task = Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            await self.performLiveReviewGrade(
                client: liveReviewClient,
                context: context
            )
            self.finishLiveReviewGrade(id: context.id)
        }
        liveReviewGradeTask = task
        return task
    }

    private func performLiveReviewGrade(
        client: DailyKanjiLiveReviewing,
        context: LiveReviewGradeContext
    ) async {
        do {
            let result = try await client.grade(
                cardId: context.card.cardId,
                rating: context.rating,
                expectedUpdatedAt: context.card.reviewStateUpdatedAt,
                hasBufferedSuccessor: context.optimisticSession != nil,
                responseMs: context.responseMs
            )
            try Task.checkCancellation()
            guard activeLiveReviewGradeId == context.id else {
                return
            }

            guard let acceptedSession = result.session ?? context.optimisticSession else {
                throw DailyKanjiLiveReviewClientError.invalidResponse
            }

            pendingLiveReviewResponseRetry = nil
            liveReviewState = .ready(session: acceptedSession)
            updateLiveCardPresentationAfterGrade(
                session: acceptedSession,
                context: context
            )
        } catch {
            guard activeLiveReviewGradeId == context.id else {
                return
            }

            pendingLiveReviewResponseRetry = LiveReviewResponseRetry(
                cardId: context.card.cardId,
                reviewStateUpdatedAt: context.card.reviewStateUpdatedAt,
                responseMs: context.responseMs
            )
            if Task.isCancelled || Self.isCancellation(error) {
                liveReviewState = .ready(session: context.originalSession)
            } else {
                liveReviewState = .failed(
                    message: Self.liveReviewFailureMessage(for: error),
                    staleSession: context.originalSession
                )
            }
            liveCardPresentedAt = context.originalPresentedAt
        }
    }

    private func finishLiveReviewGrade(id: UUID) {
        guard activeLiveReviewGradeId == id else {
            return
        }

        activeLiveReviewGradeId = nil
        liveReviewGradeTask = nil

        guard pendingForcedLiveReviewFetch else {
            return
        }

        pendingForcedLiveReviewFetch = false
        startLiveReviewFetchTask(now: liveReviewNow(), force: true)
    }

    private func updateLiveCardPresentationAfterGrade(
        session: DailyKanjiLiveReviewSession,
        context: LiveReviewGradeContext
    ) {
        guard let selectedCard = session.selectedCard else {
            liveCardPresentedAt = nil
            return
        }

        if selectedCard.cardId == context.optimisticSession?.selectedCard?.cardId,
           let optimisticPresentedAt = context.optimisticPresentedAt {
            liveCardPresentedAt = optimisticPresentedAt
        } else {
            liveCardPresentedAt = liveReviewNow()
        }
    }

    private func shouldStartSync(now: Date, force: Bool) -> Bool {
        guard activeSyncId == nil else {
            return false
        }
        guard syncer != nil else {
            syncState = .unavailable
            return false
        }

        let source = datasetSource
        guard
            syncPolicy.shouldSync(
                now: now,
                metadata: currentCacheMetadata,
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
        let availableCardIds = Set(cards.map(\.cardId))
        let appItems = historyStore
            .recentItems(
                now: now,
                days: DailyKanjiSelector.defaultHistoryLookbackDays
            )
            .filter { availableCardIds.contains($0.cardId) }
        let widgetItems = widgetHistoryStore
            .recentPresentationItems(
                now: now,
                days: DailyKanjiSelector.defaultHistoryLookbackDays
            )
            .filter { availableCardIds.contains($0.cardId) }
        let widgetSelectionItems = widgetHistoryStore
            .recentSelectionItems(now: now)
            .filter { availableCardIds.contains($0.cardId) }

        recentHistory = DailyKanjiPresentationHistory.merge(
            appItems: appItems,
            widgetItems: widgetItems
        )
        recentSelectionHistory = appItems + widgetSelectionItems
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

    @discardableResult
    private func normalizeSelectedStudyScope() -> Bool {
        let currentScope = DailyKanjiStudyScope(
            studyMode: selectedStudyMode,
            mediaSlug: selectedMediaSlug
        )
        let resolvedScope = resolveStudyScope(currentScope)

        selectedStudyMode = resolvedScope.studyMode
        selectedMediaSlug = resolvedScope.mediaSlug

        return currentScope != resolvedScope
    }

    @discardableResult
    private func normalizeDraftStudyScope() -> Bool {
        let currentScope = DailyKanjiStudyScope(
            studyMode: draftStudyMode,
            mediaSlug: draftMediaSlug
        )
        let resolvedScope = resolveStudyScope(currentScope)

        draftStudyMode = resolvedScope.studyMode
        draftMediaSlug = resolvedScope.mediaSlug

        return currentScope != resolvedScope
    }

    private func restoreSavedScope() -> Bool {
        let scope = scopeStore.load()
        let resolvedScope = resolveStudyScope(scope)

        selectedStudyMode = resolvedScope.studyMode
        selectedMediaSlug = resolvedScope.mediaSlug

        return scope != resolvedScope
    }

    private func resolveStudyScope(
        _ scope: DailyKanjiStudyScope
    ) -> DailyKanjiStudyScope {
        DailyKanjiStudyScopeResolver.resolve(scope, cards: cards)
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

    private var currentCacheMetadata: DailyKanjiCachedDatasetMetadata? {
        guard case .cache(let metadata) = datasetSource else {
            return nil
        }

        return metadata
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

    private static func initialLiveReviewState(
        liveReviewClient: DailyKanjiLiveReviewing?
    ) -> DailyKanjiLiveReviewState {
        guard liveReviewClient != nil else {
            return .unavailable
        }

        return .loading(staleSession: nil)
    }

    private static func initialNotificationAuthorizationState(
        liveReviewClient: DailyKanjiLiveReviewing?,
        notificationRegistrar: DailyKanjiNotificationRegistering?
    ) -> DailyKanjiNotificationAuthorizationState {
        guard liveReviewClient != nil,
              notificationRegistrar?.isAvailable == true else {
            return .unavailable
        }

        return .notDetermined
    }

    private static func syncFailureMessage(for error: Error) -> String {
        if let description = (error as? LocalizedError)?.errorDescription,
           !description.isEmpty {
            return description
        }

        return "Could not refresh Daily Kanji."
    }

    private static func liveReviewFailureMessage(for error: Error) -> String {
        if let description = (error as? LocalizedError)?.errorDescription,
           !description.isEmpty {
            return description
        }

        return "Could not refresh live review."
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError {
            return true
        }

        return (error as? URLError)?.code == .cancelled
    }
}

private enum DailyKanjiAppSyncError: LocalizedError {
    case emptyDataset
    case missingStudyModes
    case unsupportedDatasetVersion

    var errorDescription: String? {
        switch self {
        case .emptyDataset:
            return "Downloaded dataset has no cards."
        case .missingStudyModes:
            return "Downloaded dataset does not include Daily Kanji study modes."
        case .unsupportedDatasetVersion:
            return "Downloaded dataset version is not supported."
        }
    }
}
