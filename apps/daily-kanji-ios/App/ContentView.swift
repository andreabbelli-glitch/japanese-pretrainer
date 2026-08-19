import SwiftUI

struct ContentView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @State private var showsSettings = false

    var body: some View {
        TabView(selection: tabBinding) {
            NavigationStack {
                DailyKanjiWidgetHomeView(model: model, openSettings: showSettings)
            }
            .tabItem {
                Label(DailyKanjiAppTab.widget.label, systemImage: DailyKanjiAppTab.widget.systemImage)
            }
            .tag(DailyKanjiAppTab.widget)

            NavigationStack {
                DailyKanjiReviewHomeView(model: model, openSettings: showSettings)
            }
            .tabItem {
                Label(DailyKanjiAppTab.review.label, systemImage: DailyKanjiAppTab.review.systemImage)
            }
            .tag(DailyKanjiAppTab.review)

            NavigationStack {
                DailyKanjiGlossaryHomeView(model: model, openSettings: showSettings)
            }
            .tabItem {
                Label(DailyKanjiAppTab.search.label, systemImage: DailyKanjiAppTab.search.systemImage)
            }
            .tag(DailyKanjiAppTab.search)
        }
        .tint(.accentColor)
        .sheet(isPresented: $showsSettings) {
            DailyKanjiSettingsView(model: model)
        }
    }

    private var tabBinding: Binding<DailyKanjiAppTab> {
        Binding(
            get: { model.selectedTab },
            set: { model.selectTab($0) }
        )
    }

    private func showSettings() {
        showsSettings = true
    }
}

#Preview {
    ContentView(model: DailyKanjiAppModel())
}
