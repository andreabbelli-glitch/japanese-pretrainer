import Foundation

struct DailyKanjiSyncPolicy {
    static let maximumTrackedFailureCount = 17

    let refreshInterval: TimeInterval
    let failureBackoff: TimeInterval
    let maximumFailureBackoff: TimeInterval
    private let calendar: Calendar

    init(
        refreshInterval: TimeInterval = 4 * 60 * 60,
        failureBackoff: TimeInterval = 15 * 60,
        maximumFailureBackoff: TimeInterval = 24 * 60 * 60,
        calendar: Calendar = DailyKanjiSyncPolicy.defaultCalendar()
    ) {
        self.refreshInterval = refreshInterval
        self.failureBackoff = failureBackoff
        self.maximumFailureBackoff = maximumFailureBackoff
        self.calendar = calendar
    }

    func shouldSync(
        now: Date,
        metadata: DailyKanjiCachedDatasetMetadata?,
        lastFailureAt: Date?,
        consecutiveFailureCount: Int,
        force: Bool
    ) -> Bool {
        if force {
            return true
        }

        if let lastFailureAt, consecutiveFailureCount > 0 {
            let elapsedSinceFailure = now.timeIntervalSince(lastFailureAt)
            if elapsedSinceFailure >= 0,
               elapsedSinceFailure < failureDelay(
                   consecutiveFailureCount: consecutiveFailureCount
               ) {
                return false
            }
        }

        guard let metadata else {
            return true
        }

        if metadata.cachedAt > now {
            return true
        }

        if !calendar.isDate(metadata.cachedAt, inSameDayAs: now) {
            return true
        }

        return now.timeIntervalSince(metadata.cachedAt) >= refreshInterval
    }

    private func failureDelay(consecutiveFailureCount: Int) -> TimeInterval {
        let exponent = min(
            max(consecutiveFailureCount - 1, 0),
            Self.maximumTrackedFailureCount - 1
        )
        let delay = failureBackoff * pow(2, Double(exponent))

        return min(delay, maximumFailureBackoff)
    }

    private static func defaultCalendar() -> Calendar {
        .autoupdatingCurrent
    }
}
