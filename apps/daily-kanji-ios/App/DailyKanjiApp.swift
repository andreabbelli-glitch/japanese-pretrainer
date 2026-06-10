import SwiftUI

@main
struct DailyKanjiApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = DailyKanjiAppModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .onOpenURL { url in
                    model.openDeepLink(url)
                }
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active {
                        model.activate()
                    }
                }
        }
    }
}
