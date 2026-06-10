import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Daily Kanji")
                .font(.largeTitle.bold())

            Text("Personal kanji recall")
                .font(.title3)
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text("学")
                    .font(.system(size: 88, weight: .semibold, design: .serif))

                VStack(alignment: .leading, spacing: 8) {
                    Text("study, learning")
                        .font(.headline)

                    Text("がく / まな.ぶ")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            }

            Text("Private iPhone app and widget for passive recall of difficult kanji-bearing flashcards.")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding(24)
    }
}

#Preview {
    ContentView()
}
