import Foundation
import SwiftUI
import WidgetKit

@MainActor
final class DailyKanjiAppModel: ObservableObject {
    @Published private(set) var cards: [DailyKanjiCard]
    @Published private(set) var selectedCard: DailyKanjiCard?
    @Published private(set) var recentHistory: [DailyKanjiPresentationHistoryItem] = []

    private let historyStore: DailyKanjiHistoryStore
    private var recentSelectionHistory: [DailyKanjiHistoryItem] = []

    init(
        repository: DailyKanjiRepository = DailyKanjiRepository(),
        historyStore: DailyKanjiHistoryStore = DailyKanjiHistoryStore(),
        now: Date = .now
    ) {
        self.cards = repository.loadCards()
        self.historyStore = historyStore
        refreshHistory(now: now)
        selectedCard = DailyKanjiSelector.select(
            cards: cards,
            history: selectionHistoryItems(),
            now: now,
            mode: .appOpen
        )
    }

    func activate(now: Date = .now) {
        refreshHistory(now: now)
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

    func openDeepLink(_ url: URL, now: Date = .now) {
        guard
            let cardId = DailyKanjiDeepLink.cardId(from: url),
            let card = cards.first(where: { $0.cardId == cardId })
        else {
            return
        }

        select(card: card, shownAt: now)
    }

    func card(for historyItem: DailyKanjiPresentationHistoryItem) -> DailyKanjiCard? {
        cards.first { $0.cardId == historyItem.cardId }
    }

    private func select(card: DailyKanjiCard, shownAt: Date) {
        selectedCard = card
        historyStore.record(cardId: card.cardId, shownAt: shownAt)
        refreshHistory(now: shownAt)
        WidgetCenter.shared.reloadAllTimelines()
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
