import Foundation

enum DailyKanjiSelectionMode {
    case appOpen
    case widgetTimeline
}

struct DailyKanjiSelector {
    static let defaultHistoryLookbackDays = 3
    static let defaultWidgetRotationWindow = 8
    static let defaultWidgetNoRepeatLookbackDays = 1
    static let defaultWidgetSelectionHistoryMaxItems = 96
    static let widgetSlotDuration: TimeInterval = 15 * 60
    static let defaultWidgetHistoryMaxItems = 96
    static let defaultWidgetTimelineEntryCount = 96

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

        let cutoff = lookbackCutoff(for: now, days: historyLookbackDays)
        let recentCardIds = Set(history.filter { $0.shownAt >= cutoff }.map(\.cardId))
        let freshCandidates = ordered.filter { !recentCardIds.contains($0.cardId) }
        let candidates = freshCandidates.isEmpty ? ordered : freshCandidates

        switch mode {
        case .appOpen:
            return candidates.first
        case .widgetTimeline:
            let pitchKnownCandidates = candidates.filter { $0.entry.pitchAccent != nil }
            let widgetCandidates = pitchKnownCandidates.isEmpty ? candidates : pitchKnownCandidates
            let windowSize = min(max(widgetRotationWindow, 1), widgetCandidates.count)
            let window = Array(widgetCandidates.prefix(windowSize))
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

    static func widgetTimelineCards(
        cards: [DailyKanjiCard],
        dates: [Date],
        historyLookbackDays: Int = defaultWidgetNoRepeatLookbackDays,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> [DailyKanjiCard] {
        widgetTimelineSelections(
            cards: cards,
            dates: dates,
            historyLookbackDays: historyLookbackDays,
            widgetRotationWindow: widgetRotationWindow
        ).map { $0.card }
    }

    static func recentWidgetTimelineItems(
        cards: [DailyKanjiCard],
        now: Date,
        days: Int = defaultWidgetNoRepeatLookbackDays,
        maxItems: Int = defaultWidgetHistoryMaxItems,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> [DailyKanjiPresentationHistoryItem] {
        let cutoff = lookbackCutoff(for: now, days: days)
        let currentSlotStart = currentWidgetSlotStart(for: now)
        var firstSlotStart = currentWidgetSlotStart(for: cutoff)
        if firstSlotStart < cutoff {
            firstSlotStart = firstSlotStart.addingTimeInterval(widgetSlotDuration)
        }

        var dates: [Date] = []
        var slotStart = firstSlotStart
        while slotStart <= currentSlotStart {
            dates.append(slotStart)
            slotStart = slotStart.addingTimeInterval(widgetSlotDuration)
        }

        var seenCardIds = Set<String>()
        let newestUniqueItems = widgetTimelineSelections(
            cards: cards,
            dates: dates,
            historyLookbackDays: days,
            widgetRotationWindow: widgetRotationWindow
        )
        .reversed()
        .compactMap { selection -> DailyKanjiPresentationHistoryItem? in
            guard seenCardIds.insert(selection.card.cardId).inserted else {
                return nil
            }

            return DailyKanjiPresentationHistoryItem(
                cardId: selection.card.cardId,
                shownAt: selection.date,
                source: .widget
            )
        }

        return Array(newestUniqueItems.prefix(maxItems))
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
            let lhsHasRecentHardAgain = lhs.srs.recentHardAgainCount > 0
            let rhsHasRecentHardAgain = rhs.srs.recentHardAgainCount > 0
            if lhsHasRecentHardAgain != rhsHasRecentHardAgain {
                return lhsHasRecentHardAgain
            }

            let lhsHasLowStability = lhs.srs.priorityReasons.contains(.lowStability)
            let rhsHasLowStability = rhs.srs.priorityReasons.contains(.lowStability)
            if lhsHasLowStability != rhsHasLowStability {
                return lhsHasLowStability
            }

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

            if lhs.srs.dueAt != rhs.srs.dueAt {
                return (lhs.srs.dueAt ?? "9999") < (rhs.srs.dueAt ?? "9999")
            }

            return lhs.cardId < rhs.cardId
        }
    }

    static func currentWidgetSlotStart(for date: Date) -> Date {
        let slot = floor(date.timeIntervalSince1970 / widgetSlotDuration)
        return Date(timeIntervalSince1970: slot * widgetSlotDuration)
    }

    private static func widgetTimelineSelections(
        cards: [DailyKanjiCard],
        dates: [Date],
        historyLookbackDays: Int,
        widgetRotationWindow: Int
    ) -> [(date: Date, card: DailyKanjiCard)] {
        let ordered = rank(cards)
        guard !ordered.isEmpty else {
            return []
        }

        let poolSize = min(
            ordered.count,
            max(widgetRotationWindow, defaultWidgetTimelineEntryCount)
        )
        let pool = Array(ordered.prefix(poolSize))

        return dates.map { date in
            let slot = Int(floor(date.timeIntervalSince1970 / widgetSlotDuration))
            let index = positiveModulo(slot, pool.count)
            return (date: date, card: pool[index])
        }
    }

    private static func lookbackCutoff(for date: Date, days: Int) -> Date {
        date.addingTimeInterval(-TimeInterval(days) * 24 * 60 * 60)
    }

    private static func positiveModulo(_ value: Int, _ divisor: Int) -> Int {
        ((value % divisor) + divisor) % divisor
    }
}
