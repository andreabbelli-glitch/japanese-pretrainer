import Foundation

enum DailyKanjiSelectionMode {
    case appOpen
    case widgetTimeline
}

struct DailyKanjiSelector {
    static let defaultHistoryLookbackDays = 3
    static let defaultWidgetRotationWindow = 8
    static let defaultWidgetSelectionHistoryMaxItems = 1
    static let widgetSlotDuration: TimeInterval = 6 * 60 * 60
    static let defaultWidgetHistoryMaxItems = 16
    static let defaultWidgetTimelineEntryCount = 12

    static func select(
        cards: [DailyKanjiCard],
        history: [DailyKanjiHistoryItem],
        now: Date,
        mode: DailyKanjiSelectionMode,
        historyLookbackDays: Int = defaultHistoryLookbackDays,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> DailyKanjiCard? {
        let ordered = rank(cards)
        guard !ordered.isEmpty else {
            return nil
        }

        let cutoff = Calendar.current.date(byAdding: .day, value: -historyLookbackDays, to: now) ?? now
        let recentCardIds = Set(history.filter { $0.shownAt >= cutoff }.map(\.cardId))
        let freshCandidates = ordered.filter { !recentCardIds.contains($0.cardId) }
        let candidates = freshCandidates.isEmpty ? ordered : freshCandidates

        switch mode {
        case .appOpen:
            return candidates.first
        case .widgetTimeline:
            let windowSize = min(max(widgetRotationWindow, 1), candidates.count)
            let window = Array(candidates.prefix(windowSize))
            let slot = Int((now.timeIntervalSince1970 / widgetSlotDuration).rounded(.down))
            let index = abs(slot) % window.count
            return window[index]
        }
    }

    static func nextWidgetRefreshDate(
        after date: Date,
        slotDuration: TimeInterval = widgetSlotDuration
    ) -> Date {
        let currentSlot = floor(date.timeIntervalSince1970 / slotDuration)
        return Date(timeIntervalSince1970: (currentSlot + 1) * slotDuration)
    }

    static func widgetTimelineDates(
        startingAt now: Date,
        count: Int = defaultWidgetTimelineEntryCount
    ) -> [Date] {
        guard count > 0 else {
            return []
        }

        var dates = [now]
        var nextDate = nextWidgetRefreshDate(after: now)

        while dates.count < count {
            dates.append(nextDate)
            nextDate = nextDate.addingTimeInterval(widgetSlotDuration)
        }

        return dates
    }

    static func recentWidgetTimelineItems(
        cards: [DailyKanjiCard],
        now: Date,
        days: Int = defaultHistoryLookbackDays,
        maxItems: Int = defaultWidgetHistoryMaxItems,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> [DailyKanjiPresentationHistoryItem] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: now) ?? now
        var slotStart = currentWidgetSlotStart(for: now)
        var items: [DailyKanjiPresentationHistoryItem] = []

        while slotStart >= cutoff && items.count < maxItems {
            if
                let card = select(
                    cards: cards,
                    history: [],
                    now: slotStart,
                    mode: .widgetTimeline,
                    widgetRotationWindow: widgetRotationWindow
                )
            {
                items.append(
                    DailyKanjiPresentationHistoryItem(
                        cardId: card.cardId,
                        shownAt: slotStart,
                        source: .widget
                    )
                )
            }

            slotStart = slotStart.addingTimeInterval(-widgetSlotDuration)
        }

        return items
    }

    static func recentWidgetSelectionItems(
        cards: [DailyKanjiCard],
        now: Date,
        maxItems: Int = defaultWidgetSelectionHistoryMaxItems
    ) -> [DailyKanjiHistoryItem] {
        recentWidgetTimelineItems(
            cards: cards,
            now: now,
            maxItems: maxItems
        ).map {
            DailyKanjiHistoryItem(cardId: $0.cardId, shownAt: $0.shownAt)
        }
    }

    static func rank(_ cards: [DailyKanjiCard]) -> [DailyKanjiCard] {
        cards.sorted { lhs, rhs in
            if lhs.srs.priorityScore != rhs.srs.priorityScore {
                return lhs.srs.priorityScore > rhs.srs.priorityScore
            }

            let lhsStability = lhs.srs.stability ?? Double.greatestFiniteMagnitude
            let rhsStability = rhs.srs.stability ?? Double.greatestFiniteMagnitude
            if lhsStability != rhsStability {
                return lhsStability < rhsStability
            }

            if lhs.srs.recentHardAgainCount != rhs.srs.recentHardAgainCount {
                return lhs.srs.recentHardAgainCount > rhs.srs.recentHardAgainCount
            }

            if lhs.srs.lastHardAgainAt != rhs.srs.lastHardAgainAt {
                return (lhs.srs.lastHardAgainAt ?? "") > (rhs.srs.lastHardAgainAt ?? "")
            }

            return lhs.cardId < rhs.cardId
        }
    }

    private static func currentWidgetSlotStart(for date: Date) -> Date {
        let slot = floor(date.timeIntervalSince1970 / widgetSlotDuration)
        return Date(timeIntervalSince1970: slot * widgetSlotDuration)
    }
}
