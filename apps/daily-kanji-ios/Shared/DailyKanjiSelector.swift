import Foundation

enum DailyKanjiSelectionMode {
    case appOpen
    case widgetTimeline
}

struct DailyKanjiSelector {
    static let defaultHistoryLookbackDays = 3
    static let defaultWidgetRotationWindow = 8
    static let widgetSlotDuration: TimeInterval = 6 * 60 * 60

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
}
