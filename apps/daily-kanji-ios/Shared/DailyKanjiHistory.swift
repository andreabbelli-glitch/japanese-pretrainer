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
            return "Widget"
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
            return "Adesso"
        }

        if elapsedSeconds < 60 * 60 {
            return Self.relativeText(
                Int(elapsedSeconds / 60),
                singular: "minuto",
                plural: "minuti"
            )
        }

        if elapsedSeconds < 24 * 60 * 60 {
            return Self.relativeText(
                Int(elapsedSeconds / (60 * 60)),
                singular: "ora",
                plural: "ore"
            )
        }

        return Self.relativeText(
            Int(elapsedSeconds / (24 * 60 * 60)),
            singular: "giorno",
            plural: "giorni"
        )
    }

    func metadataText(now: Date = .now) -> String {
        "\(source.label) - \(shownAtText(now: now))"
    }

    private static func relativeText(
        _ value: Int,
        singular: String,
        plural: String
    ) -> String {
        "\(value) \(value == 1 ? singular : plural) fa"
    }
}

enum DailyKanjiPresentationHistory {
    static let defaultMaxItems = 96

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

        var seenCardIds = Set<String>()
        var uniqueItems: [DailyKanjiPresentationHistoryItem] = []

        for item in sorted {
            guard seenCardIds.insert(item.cardId).inserted else {
                continue
            }

            uniqueItems.append(item)
            if uniqueItems.count == maxItems {
                break
            }
        }

        return uniqueItems
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

    @discardableResult
    func record(cardId: String, shownAt: Date = .now) -> DailyKanjiHistoryItem {
        let item = DailyKanjiHistoryItem(cardId: cardId, shownAt: shownAt)
        var items = allItems()
        items.insert(item, at: 0)
        save(Array(items.prefix(maxItems)))
        return item
    }

    func remove(eventId: String) {
        let remainingItems = allItems().filter { $0.eventId != eventId }
        save(remainingItems)
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

struct DailyKanjiWidgetTimelineHistoryItem: Codable, Equatable, Identifiable {
    let slotStart: Date
    let cardId: String

    var id: String {
        "widget-slot-\(Int(slotStart.timeIntervalSince1970))-\(cardId)"
    }
}

private struct DailyKanjiWidgetTimelineHistoryState: Codable {
    let version: Int
    let generatedAt: Date
    let items: [DailyKanjiWidgetTimelineHistoryItem]
}

final class DailyKanjiWidgetTimelineHistoryStore {
    private static let lock = NSLock()
    private static let stateVersion = 1

    private let defaults: UserDefaults
    private let key: String
    private let retentionDays: Int

    init(
        defaults: UserDefaults =
            UserDefaults(suiteName: DailyKanjiCacheStore.appGroupIdentifier) ?? .standard,
        key: String = "daily-kanji.widget-timeline-history.v1",
        retentionDays: Int = DailyKanjiSelector.defaultHistoryLookbackDays
    ) {
        self.defaults = defaults
        self.key = key
        self.retentionDays = retentionDays
    }

    static func emptyTransientStore() -> DailyKanjiWidgetTimelineHistoryStore {
        DailyKanjiWidgetTimelineHistoryStore(
            defaults: .standard,
            key: "daily-kanji.widget-timeline-history.transient.\(UUID().uuidString)"
        )
    }

    func replaceTimeline(
        entries: [DailyKanjiWidgetTimelineHistoryItem],
        generatedAt: Date
    ) {
        Self.lock.lock()
        defer { Self.lock.unlock() }

        let existingState = loadState()
        guard (existingState?.generatedAt ?? .distantPast) <= generatedAt else {
            return
        }

        let currentSlotStart = DailyKanjiSelector.currentWidgetSlotStart(for: generatedAt)
        let retentionCutoff = cutoff(now: generatedAt, days: retentionDays)
        var itemsById: [String: DailyKanjiWidgetTimelineHistoryItem] = [:]
        for item in existingState?.items ?? []
        where item.slotStart >= retentionCutoff && item.slotStart <= currentSlotStart {
            itemsById[item.id] = item
        }

        for entry in entries where entry.slotStart >= currentSlotStart {
            itemsById[entry.id] = entry
        }

        save(
            DailyKanjiWidgetTimelineHistoryState(
                version: Self.stateVersion,
                generatedAt: generatedAt,
                items: itemsById.values.sorted { lhs, rhs in
                    if lhs.slotStart != rhs.slotStart {
                        return lhs.slotStart < rhs.slotStart
                    }

                    return lhs.cardId < rhs.cardId
                }
            )
        )
    }

    func recentItems(
        now: Date = .now,
        days: Int = DailyKanjiSelector.defaultHistoryLookbackDays,
        maxItems: Int? = nil
    ) -> [DailyKanjiWidgetTimelineHistoryItem] {
        Self.lock.lock()
        defer { Self.lock.unlock() }

        let currentSlotStart = DailyKanjiSelector.currentWidgetSlotStart(for: now)
        let recentItems = (loadState()?.items ?? [])
            .filter {
                $0.slotStart >= cutoff(now: now, days: days)
                    && $0.slotStart <= currentSlotStart
            }
            .sorted { lhs, rhs in
                if lhs.slotStart != rhs.slotStart {
                    return lhs.slotStart > rhs.slotStart
                }

                return lhs.cardId < rhs.cardId
            }

        guard let maxItems else {
            return recentItems
        }

        return Array(recentItems.prefix(max(maxItems, 0)))
    }

    func recentPresentationItems(
        now: Date = .now,
        days: Int = DailyKanjiSelector.defaultHistoryLookbackDays
    ) -> [DailyKanjiPresentationHistoryItem] {
        recentItems(now: now, days: days).map {
            DailyKanjiPresentationHistoryItem(
                eventId: $0.id,
                cardId: $0.cardId,
                shownAt: $0.slotStart,
                source: .widget
            )
        }
    }

    func recentSelectionItems(
        now: Date = .now,
        days: Int = DailyKanjiSelector.defaultWidgetNoRepeatLookbackDays,
        maxItems: Int? = nil
    ) -> [DailyKanjiHistoryItem] {
        recentItems(now: now, days: days, maxItems: maxItems).map {
            DailyKanjiHistoryItem(
                eventId: $0.id,
                cardId: $0.cardId,
                shownAt: $0.slotStart
            )
        }
    }

    private func cutoff(now: Date, days: Int) -> Date {
        now.addingTimeInterval(-TimeInterval(max(days, 0)) * 24 * 60 * 60)
    }

    private func loadState() -> DailyKanjiWidgetTimelineHistoryState? {
        guard let data = defaults.data(forKey: key) else {
            return nil
        }

        let decoder = JSONDecoder()
        guard
            let state = try? decoder.decode(
                DailyKanjiWidgetTimelineHistoryState.self,
                from: data
            ),
            state.version == Self.stateVersion
        else {
            return nil
        }

        return state
    }

    private func save(_ state: DailyKanjiWidgetTimelineHistoryState) {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(state) else {
            return
        }

        defaults.set(data, forKey: key)
    }
}
