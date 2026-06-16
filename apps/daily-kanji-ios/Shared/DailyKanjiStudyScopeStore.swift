import Foundation

struct DailyKanjiStudyScopeStore {
    private static let modeKey = "daily-kanji.study-scope.mode.v1"
    private static let mediaSlugKey = "daily-kanji.study-scope.media-slug.v1"

    private let defaults: UserDefaults

    init(
        defaults: UserDefaults =
            UserDefaults(suiteName: DailyKanjiCacheStore.appGroupIdentifier) ?? .standard
    ) {
        self.defaults = defaults
    }

    func load() -> DailyKanjiStudyScope {
        let studyMode = defaults.string(forKey: Self.modeKey)
            .flatMap(DailyKanjiStudyMode.init(rawValue:)) ?? .daily
        let mediaSlug = defaults.string(forKey: Self.mediaSlugKey).flatMap { value in
            value.isEmpty ? nil : value
        }

        return DailyKanjiStudyScope(studyMode: studyMode, mediaSlug: mediaSlug)
    }

    func save(_ scope: DailyKanjiStudyScope) {
        defaults.set(scope.studyMode.rawValue, forKey: Self.modeKey)

        if let mediaSlug = scope.mediaSlug, !mediaSlug.isEmpty {
            defaults.set(mediaSlug, forKey: Self.mediaSlugKey)
        } else {
            defaults.removeObject(forKey: Self.mediaSlugKey)
        }
    }
}
