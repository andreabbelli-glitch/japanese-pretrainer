import Foundation
import SwiftUI
import WidgetKit

@MainActor
final class DailyKanjiAppModel: ObservableObject {
    @Published private(set) var cards: [DailyKanjiCard]
    @Published private(set) var selectedCard: DailyKanjiCard?
    @Published private(set) var selectedHistoryContext: DailyKanjiPresentationHistoryItem?
    @Published private(set) var recentHistory: [DailyKanjiPresentationHistoryItem] = []

    private let historyStore: DailyKanjiHistoryStore
    private let deepLinkActivationSuppressionInterval: TimeInterval = 5
    private var suppressActivationUntil: Date?
    private var recentSelectionHistory: [DailyKanjiHistoryItem] = []

    init(
        repository: DailyKanjiRepository = DailyKanjiRepository(),
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        now: Date = .now
    ) {
        self.cards = repository.loadCards()
        self.historyStore = historyStore
        prepareInitialSelection(now: now)
    }

    init(
        cards: [DailyKanjiCard],
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        now: Date = .now
    ) {
        self.cards = cards
        self.historyStore = historyStore
        prepareInitialSelection(now: now)
    }

    func activate(now: Date = .now) {
        refreshHistory(now: now)
        if shouldSuppressActivationSelection(now: now) {
            return
        }

        guard
            let card = DailyKanjiSelector.select(
                cards: cards,
                history: selectionHistoryItems(),
                now: now,
                mode: .appOpen
            )
        else {
            return
        }

        select(card: card, shownAt: now)
    }

    func selectHistoryItem(_ item: DailyKanjiPresentationHistoryItem, now: Date = .now) {
        guard
            let card = cards.first(where: { $0.cardId == item.cardId })
        else {
            return
        }

        select(card: card, shownAt: now, context: item)
    }

    func openDeepLink(_ url: URL, now: Date = .now) {
        guard
            let cardId = DailyKanjiDeepLink.cardId(from: url),
            let card = cards.first(where: { $0.cardId == cardId })
        else {
            return
        }

        select(card: card, shownAt: now)
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
            mode: .appOpen
        )
        if let selectedCard {
            selectedHistoryContext = DailyKanjiPresentationHistoryItem(
                cardId: selectedCard.cardId,
                shownAt: now,
                source: .app
            )
        }
    }

    private func select(
        card: DailyKanjiCard,
        shownAt: Date,
        context: DailyKanjiPresentationHistoryItem? = nil
    ) {
        selectedCard = card
        selectedHistoryContext = context ?? DailyKanjiPresentationHistoryItem(
            cardId: card.cardId,
            shownAt: shownAt,
            source: .app
        )
        historyStore.record(cardId: card.cardId, shownAt: shownAt)
        refreshHistory(now: shownAt)
        WidgetCenter.shared.reloadAllTimelines()
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
            days: DailyKanjiSelector.defaultHistoryLookbackDays
        )

        recentHistory = DailyKanjiPresentationHistory.merge(
            appItems: appItems,
            widgetItems: widgetItems
        )
        recentSelectionHistory = appItems + DailyKanjiSelector.recentWidgetSelectionItems(
            cards: cards,
            now: now
        )
    }

    private func selectionHistoryItems() -> [DailyKanjiHistoryItem] {
        recentSelectionHistory
    }
}
