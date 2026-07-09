import Foundation
import SwiftUI

@MainActor
final class DailyKanjiGlossarySearchModel: ObservableObject {
    typealias DebounceSleep = @Sendable () async throws -> Void

    @Published private(set) var query: String
    @Published private(set) var results: [DailyKanjiGlossaryEntry]

    private let debounceSleep: DebounceSleep
    private var entries: [DailyKanjiGlossaryEntry]
    private var generation = 0
    private var indexTask: Task<DailyKanjiGlossaryIndex, Never>?
    private var searchTask: Task<Void, Never>?

    init(
        entries: [DailyKanjiGlossaryEntry],
        query: String = "",
        debounceSleep: @escaping DebounceSleep = {
            try await Task.sleep(nanoseconds: 150_000_000)
        }
    ) {
        self.entries = entries
        self.query = query
        self.results = entries
        self.debounceSleep = debounceSleep

        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            startSearch(for: query, waitsForDebounce: false)
        }
    }

    func prepareIndex() {
        _ = makeIndexTaskIfNeeded()
    }

    func updateQuery(_ query: String) {
        self.query = query
        generation += 1
        searchTask?.cancel()

        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            results = entries
            searchTask = nil
            return
        }

        startSearch(for: query, waitsForDebounce: true)
    }

    func replaceEntries(_ entries: [DailyKanjiGlossaryEntry]) {
        generation += 1
        searchTask?.cancel()
        searchTask = nil
        indexTask?.cancel()
        indexTask = nil

        self.entries = entries
        if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            results = entries
        } else {
            results = []
            startSearch(for: query, waitsForDebounce: false)
        }
    }

    func waitForPendingSearch() async {
        await searchTask?.value
    }

    private func startSearch(for query: String, waitsForDebounce: Bool) {
        let requestGeneration = generation
        let requestIndexTask = makeIndexTaskIfNeeded()
        let debounceSleep = debounceSleep

        searchTask = Task { @MainActor [weak self] in
            if waitsForDebounce {
                do {
                    try await debounceSleep()
                } catch {
                    return
                }
            }

            guard !Task.isCancelled else {
                return
            }

            let requestIndex = await requestIndexTask.value
            guard !Task.isCancelled else {
                return
            }

            let matches = await Task.detached(priority: .userInitiated) {
                requestIndex.search(query: query)
            }.value

            guard
                let self,
                !Task.isCancelled,
                self.generation == requestGeneration
            else {
                return
            }

            self.results = matches
            self.searchTask = nil
        }
    }

    private func makeIndexTaskIfNeeded() -> Task<DailyKanjiGlossaryIndex, Never> {
        if let indexTask {
            return indexTask
        }

        let entries = entries
        let locale = Locale.current
        let task = Task.detached(priority: .userInitiated) {
            DailyKanjiGlossaryIndex(entries: entries, locale: locale)
        }
        indexTask = task
        return task
    }
}
