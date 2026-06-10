import Foundation
import SwiftUI
import WidgetKit

@MainActor
final class DailyKanjiAppModel: ObservableObject {
    @Published private(set) var cards: [DailyKanjiCard]
    @Published private(set) var selectedCard: DailyKanjiCard?
    @Published private(set) var recentHistory: [DailyKanjiHistoryItem] = []

    private let historyStore: DailyKanjiHistoryStore

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
            history: recentHistory,
            now: now,
            mode: .appOpen
        )
    }

    func activate(now: Date = .now) {
        refreshHistory(now: now)
        guard
            let card = DailyKanjiSelector.select(
                cards: cards,
                history: recentHistory,
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

    func card(for historyItem: DailyKanjiHistoryItem) -> DailyKanjiCard? {
        cards.first { $0.cardId == historyItem.cardId }
    }

    private func select(card: DailyKanjiCard, shownAt: Date) {
        selectedCard = card
        historyStore.record(cardId: card.cardId, shownAt: shownAt)
        refreshHistory(now: shownAt)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func refreshHistory(now: Date) {
        recentHistory = historyStore.recentItems(now: now, days: DailyKanjiSelector.defaultHistoryLookbackDays)
    }
}
