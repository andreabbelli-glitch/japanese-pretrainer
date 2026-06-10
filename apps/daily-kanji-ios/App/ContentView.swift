import SwiftUI

struct ContentView: View {
    @ObservedObject var model: DailyKanjiAppModel
    private let audioPlayer = DailyKanjiAudioPlayer()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
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

    private func selectedCardView(_ card: DailyKanjiCard) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text(card.displayFront)
                    .font(.system(size: 72, weight: .semibold, design: .serif))
                    .minimumScaleFactor(0.45)
                    .lineLimit(2)

                VStack(alignment: .leading, spacing: 8) {
                    Text(card.back)
                        .font(.title3.weight(.semibold))
                    Text(card.readingText)
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Text(card.pitchAccentText)
                        .font(.caption)
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
                                        HStack(spacing: 6) {
                                            Text(card.back)
                                                .font(.subheadline.weight(.medium))
                                                .lineLimit(1)

                                            Text(item.source.label)
                                                .font(.caption2.weight(.semibold))
                                                .foregroundStyle(.secondary)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(Color(.tertiarySystemGroupedBackground))
                                                .clipShape(Capsule())
                                        }
                                        Text(card.readingText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
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
