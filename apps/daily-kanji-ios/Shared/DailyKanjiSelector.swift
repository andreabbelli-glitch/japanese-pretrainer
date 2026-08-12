import Foundation

enum DailyKanjiSelectionMode {
    case appOpen
    case widgetTimeline
}

struct DailyKanjiSelector {
    static let defaultHistoryLookbackDays = 3
    static let defaultWidgetRotationWindow = 8
    static let defaultWidgetNoRepeatLookbackDays = 1
    static let widgetSlotDuration: TimeInterval = 60 * 60
    static let defaultWidgetTimelineEntryCount = 24
    static let defaultWidgetRotationPoolSize = 96

    static func select(
        cards: [DailyKanjiCard],
        history: [DailyKanjiHistoryItem],
        now: Date,
        mode: DailyKanjiSelectionMode,
        mediaSlug: String? = nil,
        studyMode: DailyKanjiStudyMode = .daily,
        historyLookbackDays: Int = defaultHistoryLookbackDays,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> DailyKanjiCard? {
        let ordered = order(
            scopedCards(cards, mediaSlug: mediaSlug, studyMode: studyMode),
            for: studyMode
        )
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

        let currentSlotStart = currentWidgetSlotStart(for: now)
        var dates = [currentSlotStart]
        var nextDate = currentSlotStart.addingTimeInterval(widgetSlotDuration)

        while dates.count < count {
            dates.append(nextDate)
            nextDate = nextDate.addingTimeInterval(widgetSlotDuration)
        }

        return dates
    }

    static func widgetTimelineCards(
        cards: [DailyKanjiCard],
        dates: [Date],
        mediaSlug: String? = nil,
        studyMode: DailyKanjiStudyMode = .daily,
        historyLookbackDays: Int = defaultWidgetNoRepeatLookbackDays,
        widgetRotationWindow: Int = defaultWidgetRotationWindow
    ) -> [DailyKanjiCard] {
        widgetTimelineSelections(
            cards: cards,
            dates: dates,
            mediaSlug: mediaSlug,
            studyMode: studyMode,
            historyLookbackDays: historyLookbackDays,
            widgetRotationWindow: widgetRotationWindow
        ).map { $0.card }
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

    static func mediaOptions(
        cards: [DailyKanjiCard],
        studyMode: DailyKanjiStudyMode? = nil
    ) -> [DailyKanjiMediaOption] {
        var bySlug: [String: DailyKanjiMediaOption] = [:]

        for card in cards {
            if let studyMode, !card.supportsStudyMode(studyMode) {
                continue
            }

            bySlug[card.media.slug] = DailyKanjiMediaOption(
                slug: card.media.slug,
                title: card.media.title
            )
        }

        return bySlug.values.sorted { lhs, rhs in
            if lhs.title != rhs.title {
                return lhs.title < rhs.title
            }

            return lhs.slug < rhs.slug
        }
    }

    static func scopedCards(
        _ cards: [DailyKanjiCard],
        mediaSlug: String?,
        studyMode: DailyKanjiStudyMode
    ) -> [DailyKanjiCard] {
        let scopedMediaSlug = studyMode.usesMediaSelection ? mediaSlug : nil

        return cards.filter { card in
            if let scopedMediaSlug, card.media.slug != scopedMediaSlug {
                return false
            }

            return card.supportsStudyMode(studyMode)
        }
    }

    static func order(
        _ cards: [DailyKanjiCard],
        for studyMode: DailyKanjiStudyMode
    ) -> [DailyKanjiCard] {
        switch studyMode {
        case .daily, .lastLessonsHardAgain:
            return rank(cards)
        case .prestudy:
            return cards.sorted { lhs, rhs in
                let lhsLessonOrder = lhs.lesson.orderIndex ?? Int.max
                let rhsLessonOrder = rhs.lesson.orderIndex ?? Int.max
                if lhsLessonOrder != rhsLessonOrder {
                    return lhsLessonOrder < rhsLessonOrder
                }

                let lhsOrder = lhs.studyModeOrder(for: .prestudy)
                let rhsOrder = rhs.studyModeOrder(for: .prestudy)
                if lhsOrder != rhsOrder {
                    return lhsOrder < rhsOrder
                }

                return lhs.cardId < rhs.cardId
            }
        }
    }

    static func currentWidgetSlotStart(for date: Date) -> Date {
        let slot = floor(date.timeIntervalSince1970 / widgetSlotDuration)
        return Date(timeIntervalSince1970: slot * widgetSlotDuration)
    }

    private static func widgetTimelineSelections(
        cards: [DailyKanjiCard],
        dates: [Date],
        mediaSlug: String?,
        studyMode: DailyKanjiStudyMode,
        historyLookbackDays: Int,
        widgetRotationWindow: Int
    ) -> [(date: Date, card: DailyKanjiCard)] {
        let ordered = order(
            scopedCards(cards, mediaSlug: mediaSlug, studyMode: studyMode),
            for: studyMode
        )
        guard !ordered.isEmpty else {
            return []
        }

        let targetPoolSize = min(
            ordered.count,
            max(widgetRotationWindow, defaultWidgetRotationPoolSize)
        )
        let pool = pitchPreferredTimelinePool(
            ordered,
            targetPoolSize: targetPoolSize
        )

        return dates.map { date in
            let slot = Int(floor(date.timeIntervalSince1970 / widgetSlotDuration))
            let index = positiveModulo(slot, pool.count)
            return (date: date, card: pool[index])
        }
    }

    private static func pitchPreferredTimelinePool(
        _ ordered: [DailyKanjiCard],
        targetPoolSize: Int
    ) -> [DailyKanjiCard] {
        let poolSize = min(ordered.count, max(targetPoolSize, 0))
        guard poolSize > 0 else {
            return []
        }

        let pitchKnownCards = ordered.filter { $0.entry.pitchAccent != nil }
        guard !pitchKnownCards.isEmpty else {
            return Array(ordered.prefix(poolSize))
        }

        var seenCardIds = Set<String>()
        var pool: [DailyKanjiCard] = []

        for card in pitchKnownCards {
            guard seenCardIds.insert(card.cardId).inserted else {
                continue
            }

            pool.append(card)
            if pool.count == poolSize {
                return pool
            }
        }

        for card in ordered {
            guard seenCardIds.insert(card.cardId).inserted else {
                continue
            }

            pool.append(card)
            if pool.count == poolSize {
                return pool
            }
        }

        return pool
    }

    private static func lookbackCutoff(for date: Date, days: Int) -> Date {
        date.addingTimeInterval(-TimeInterval(days) * 24 * 60 * 60)
    }

    private static func positiveModulo(_ value: Int, _ divisor: Int) -> Int {
        ((value % divisor) + divisor) % divisor
    }
}
