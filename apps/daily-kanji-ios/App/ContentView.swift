import SwiftUI

struct ContentView: View {
    @ObservedObject var model: DailyKanjiAppModel
    private let audioPlayer = DailyKanjiAudioPlayer()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    syncStatusView

                    if let card = model.selectedCard {
                        selectedCardView(card)
                    }

                    historyView
                }
                .padding(20)
            }
            .navigationTitle("Daily Kanji")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground))
        }
    }

    private var syncStatusView: some View {
        let presentation = DailyKanjiSyncStatusPresentation(syncState: model.syncState)

        return HStack(alignment: .center, spacing: 12) {
            Image(systemName: presentation.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 2) {
                Text(presentation.title)
                    .font(.subheadline.weight(.semibold))

                Text(presentation.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                if let lastSyncAt = presentation.lastSyncAt {
                    Text("Ultimo sync \(lastSyncAt, style: .relative)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer(minLength: 12)

            Button {
                model.refreshNow()
            } label: {
                if presentation.isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Label("Aggiorna ora", systemImage: "arrow.clockwise")
                        .labelStyle(.iconOnly)
                }
            }
            .buttonStyle(.bordered)
            .disabled(!presentation.canRefresh)
            .accessibilityLabel("Aggiorna ora")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func selectedCardView(_ card: DailyKanjiCard) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(card.displayFront)
                .font(.system(size: 84, weight: .semibold, design: .serif))
                .minimumScaleFactor(0.32)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                Text(card.back)
                    .font(.title3.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)

                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text(card.readingText)
                        .font(.body)
                        .foregroundStyle(.secondary)

                    Text(card.pitchAccentText)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 10) {
                Label(card.priorityText, systemImage: "target")
                    .font(.caption.weight(.medium))

                Spacer(minLength: 0)

                Button {
                    audioPlayer.play(card: card)
                } label: {
                    Label("Audio", systemImage: "speaker.wave.2.fill")
                }
                .buttonStyle(.bordered)
                .disabled(!audioPlayer.hasBundledAudio(card: card))
            }

            if let selectedHistoryContext = model.selectedHistoryContext {
                Label(selectedHistoryContext.metadataText(), systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !card.detailExampleLines.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(card.detailExampleLines.enumerated()), id: \.offset) { index, line in
                        Text(line)
                            .font(index == 0 ? .body : .callout)
                            .foregroundStyle(index == 0 ? .primary : .secondary)
                    }
                }
            }

            if let notes = card.notes {
                Text(notes)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            studySignalsView(card)

            Text(card.sourceText)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func studySignalsView(_ card: DailyKanjiCard) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            metricRow("Difficulty", value: card.srs.difficultyText)
            metricRow("Stability", value: card.srs.stabilityText)
            metricRow("Hard/again", value: "\(card.srs.recentHardAgainCount)")
            metricRow("Lapses", value: "\(card.srs.lapses)")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.top, 2)
    }

    private func metricRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
            Spacer(minLength: 12)
            Text(value)
                .fontWeight(.medium)
        }
    }

    private var historyView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent")
                .font(.headline)

            if model.recentHistory.isEmpty {
                Text("No recent cards yet.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(model.recentHistory) { item in
                        if let card = model.card(for: item) {
                            Button {
                                model.selectHistoryItem(item)
                            } label: {
                                HStack(alignment: .firstTextBaseline, spacing: 12) {
                                    Text(card.displayFront)
                                        .font(.system(size: 26, weight: .semibold, design: .serif))
                                        .frame(width: 72, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(card.back)
                                            .font(.subheadline.weight(.medium))
                                            .lineLimit(1)

                                        Text(card.readingText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)

                                        Text(item.metadataText())
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    ContentView(model: DailyKanjiAppModel())
}

struct DailyKanjiSyncStatusPresentation: Equatable {
    let title: String
    let subtitle: String
    let lastSyncAt: Date?
    let systemImage: String
    let isRefreshing: Bool
    let canRefresh: Bool

    init(syncState: DailyKanjiSyncState) {
        switch syncState {
        case .unavailable:
            self.title = "Sync non configurato"
            self.subtitle = "Uso cache o bundle locale"
            self.lastSyncAt = nil
            self.systemImage = "wifi.slash"
            self.isRefreshing = false
            self.canRefresh = false
        case .idle(let source):
            self.title = Self.title(for: source)
            self.subtitle = Self.subtitle(for: source)
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = Self.systemImage(for: source)
            self.isRefreshing = false
            self.canRefresh = true
        case .syncing(let source):
            self.title = "Sincronizzo"
            self.subtitle = Self.subtitle(for: source)
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = "arrow.clockwise"
            self.isRefreshing = true
            self.canRefresh = false
        case .failed(let message, let source):
            self.title = "Cache non aggiornata"
            self.subtitle = message
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = "exclamationmark.triangle"
            self.isRefreshing = false
            self.canRefresh = true
        }
    }

    private static func title(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache:
            return "Sincronizzato"
        case .bundle:
            return "Bundle"
        case .sample:
            return "Sample"
        }
    }

    private static func subtitle(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache(let metadata):
            guard let metadata else {
                return "Cache condivisa"
            }

            return "Cache condivisa - \(metadata.cardCount) card"
        case .bundle:
            return "Snapshot incluso"
        case .sample:
            return "Dataset non esportato"
        }
    }

    private static func lastSyncAt(for source: DailyKanjiDatasetSource) -> Date? {
        switch source {
        case .cache(let metadata):
            return metadata?.cachedAt
        case .bundle, .sample:
            return nil
        }
    }

    private static func systemImage(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache:
            return "checkmark.icloud"
        case .bundle:
            return "shippingbox"
        case .sample:
            return "exclamationmark.circle"
        }
    }
}

private extension DailyKanjiCard.SRS {
    var difficultyText: String {
        guard let difficulty else {
            return "-"
        }

        return String(format: "%.1f", difficulty)
    }

    var stabilityText: String {
        guard let stability else {
            return "-"
        }

        return String(format: "%.1fd", stability)
    }
}
