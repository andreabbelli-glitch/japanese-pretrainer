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

            if let exampleJp = card.exampleJp {
                Text(exampleJp)
                    .font(.body)
            }

            if let notes = card.notes {
                Text(notes)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Text(card.sourceText)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
