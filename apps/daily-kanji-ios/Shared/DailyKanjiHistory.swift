import Foundation

struct DailyKanjiHistoryItem: Codable, Equatable, Identifiable {
    var id: String { eventId }

    let eventId: String
    let cardId: String
    let shownAt: Date

    init(eventId: String = UUID().uuidString, cardId: String, shownAt: Date) {
        self.eventId = eventId
        self.cardId = cardId
        self.shownAt = shownAt
    }

    private enum CodingKeys: String, CodingKey {
        case eventId
        case cardId
        case shownAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        cardId = try container.decode(String.self, forKey: .cardId)
        shownAt = try container.decode(Date.self, forKey: .shownAt)
        eventId = try container.decodeIfPresent(String.self, forKey: .eventId)
            ?? "\(cardId)-\(shownAt.timeIntervalSince1970)"
    }
}

enum DailyKanjiPresentationSource: String, Equatable {
    case app
    case widget

    var label: String {
        switch self {
        case .app:
            return "App"
        case .widget:
            return "Widget slot"
        }
    }
}

struct DailyKanjiPresentationHistoryItem: Equatable, Identifiable {
    var id: String {
        if let eventId {
            return "\(source.rawValue)-\(eventId)"
        }

        return "\(source.rawValue)-\(cardId)-\(shownAt.timeIntervalSince1970)"
    }

    let eventId: String?
    let cardId: String
    let shownAt: Date
    let source: DailyKanjiPresentationSource

    init(
        eventId: String? = nil,
        cardId: String,
        shownAt: Date,
        source: DailyKanjiPresentationSource
    ) {
        self.eventId = eventId
        self.cardId = cardId
        self.shownAt = shownAt
        self.source = source
    }

    func shownAtText(now: Date = .now) -> String {
        let elapsedSeconds = max(0, now.timeIntervalSince(shownAt))

        if elapsedSeconds < 60 {
            return "Just now"
        }

        if elapsedSeconds < 60 * 60 {
            return "\(Int(elapsedSeconds / 60))m ago"
        }

        if elapsedSeconds < 24 * 60 * 60 {
            return "\(Int(elapsedSeconds / (60 * 60)))h ago"
        }

        return "\(Int(elapsedSeconds / (24 * 60 * 60)))d ago"
    }
}

enum DailyKanjiPresentationHistory {
    static let defaultMaxItems = 24

    static func merge(
        appItems: [DailyKanjiHistoryItem],
        widgetItems: [DailyKanjiPresentationHistoryItem],
        maxItems: Int = defaultMaxItems
    ) -> [DailyKanjiPresentationHistoryItem] {
        let appPresentationItems = appItems.map {
            DailyKanjiPresentationHistoryItem(
                eventId: $0.id,
                cardId: $0.cardId,
                shownAt: $0.shownAt,
                source: .app
            )
        }

        let sorted = (appPresentationItems + widgetItems).sorted { lhs, rhs in
            if lhs.shownAt != rhs.shownAt {
                return lhs.shownAt > rhs.shownAt
            }

            if lhs.source != rhs.source {
                return lhs.source == .app
            }

            return lhs.cardId < rhs.cardId
        }

        return Array(sorted.prefix(maxItems))
    }
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
        var items = allItems()
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
