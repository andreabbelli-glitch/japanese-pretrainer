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

struct DailyKanjiStudyScopeResolver {
    static func resolve(
        _ scope: DailyKanjiStudyScope,
        cards: [DailyKanjiCard]
    ) -> DailyKanjiStudyScope {
        let normalizedScope = normalize(scope, cards: cards)

        if cards.isEmpty || hasCards(normalizedScope, cards: cards) {
            return normalizedScope
        }

        return firstNonEmptyScope(cards: cards) ?? normalizedScope
    }

    private static func normalize(
        _ scope: DailyKanjiStudyScope,
        cards: [DailyKanjiCard]
    ) -> DailyKanjiStudyScope {
        guard scope.studyMode.usesMediaSelection else {
            return DailyKanjiStudyScope(
                studyMode: scope.studyMode,
                mediaSlug: nil
            )
        }

        let mediaOptions = DailyKanjiSelector.mediaOptions(
            cards: cards,
            studyMode: scope.studyMode
        )

        if let mediaSlug = scope.mediaSlug,
           mediaOptions.contains(where: { $0.slug == mediaSlug }) {
            return DailyKanjiStudyScope(
                studyMode: scope.studyMode,
                mediaSlug: mediaSlug
            )
        }

        return DailyKanjiStudyScope(
            studyMode: scope.studyMode,
            mediaSlug: mediaOptions.first?.slug
        )
    }

    private static func firstNonEmptyScope(
        cards: [DailyKanjiCard]
    ) -> DailyKanjiStudyScope? {
        for studyMode in fallbackStudyModes {
            if !studyMode.usesMediaSelection {
                let scope = DailyKanjiStudyScope(
                    studyMode: studyMode,
                    mediaSlug: nil
                )

                if hasCards(scope, cards: cards) {
                    return scope
                }

                continue
            }

            for mediaOption in DailyKanjiSelector.mediaOptions(
                cards: cards,
                studyMode: studyMode
            ) {
                let scope = DailyKanjiStudyScope(
                    studyMode: studyMode,
                    mediaSlug: mediaOption.slug
                )

                if hasCards(scope, cards: cards) {
                    return scope
                }
            }
        }

        return nil
    }

    private static func hasCards(
        _ scope: DailyKanjiStudyScope,
        cards: [DailyKanjiCard]
    ) -> Bool {
        !DailyKanjiSelector.scopedCards(
            cards,
            mediaSlug: scope.mediaSlug,
            studyMode: scope.studyMode
        ).isEmpty
    }

    private static let fallbackStudyModes: [DailyKanjiStudyMode] = [
        .daily,
        .lastLessonsHardAgain,
        .prestudy
    ]
}
