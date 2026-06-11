import WidgetKit

enum DailyKanjiWidgetFamilies {
    static let supported: [WidgetFamily] = [
        .systemSmall,
        .systemMedium,
        .accessoryRectangular
    ]

    static let readingSupported: [WidgetFamily] = [
        .accessoryRectangular
    ]
}
