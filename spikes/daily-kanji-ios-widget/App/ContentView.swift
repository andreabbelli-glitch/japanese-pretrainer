import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Daily Kanji Spike")
                .font(.largeTitle.bold())

            Text("WidgetKit install test")
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

            Text("If this app and its widget install on the iPhone, the free sideloading path is viable enough for the real Daily Kanji app.")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding(24)
    }
}

#Preview {
    ContentView()
}

