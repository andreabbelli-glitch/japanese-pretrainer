import Foundation

struct DailyKanjiHistoryItem: Codable, Equatable, Identifiable {
    var id: String { "\(cardId)-\(shownAt.timeIntervalSince1970)" }

    let cardId: String
    let shownAt: Date
}

final class DailyKanjiHistoryStore {
    private let defaults: UserDefaults
    private let key: String
    private let maxItems: Int

    init(
        defaults: UserDefaults = .standard,
        key: String = "daily-kanji.history.v1",
        maxItems: Int = 80
    ) {
        self.defaults = defaults
        self.key = key
        self.maxItems = maxItems
    }

    func record(cardId: String, shownAt: Date = .now) {
        var items = allItems().filter { $0.cardId != cardId }
        items.insert(DailyKanjiHistoryItem(cardId: cardId, shownAt: shownAt), at: 0)
        save(Array(items.prefix(maxItems)))
    }

    func recentItems(now: Date = .now, days: Int = 3) -> [DailyKanjiHistoryItem] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: now) ?? now

        return allItems()
            .filter { $0.shownAt >= cutoff }
            .sorted { $0.shownAt > $1.shownAt }
    }

    func allItems() -> [DailyKanjiHistoryItem] {
        guard let data = defaults.data(forKey: key) else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([DailyKanjiHistoryItem].self, from: data)) ?? []
    }

    private func save(_ items: [DailyKanjiHistoryItem]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(items) else {
            return
        }

        defaults.set(data, forKey: key)
    }
}
