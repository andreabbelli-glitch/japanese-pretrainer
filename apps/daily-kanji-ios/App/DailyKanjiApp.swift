import SwiftUI

@main
struct DailyKanjiApp: App {
    @UIApplicationDelegateAdaptor(DailyKanjiAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = DailyKanjiAppModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .task {
                    await MainActor.run {
                        DailyKanjiPushTokenDispatcher.shared.onDeviceToken = { token in
                            model.registerDeviceToken(token)
                        }
                        model.requestNotificationRegistration()
                    }
                }
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
